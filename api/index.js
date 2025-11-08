import express from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import swaggerUi from "swagger-ui-express";
import yaml from "js-yaml";
import fs from "fs";
import path from "path";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();
app.use(cors());
app.use(express.json());

// Swagger
const swaggerPath = path.join(process.cwd(), "./api/swagger.yaml");
const swaggerDocument = yaml.load(fs.readFileSync(swaggerPath, "utf8"));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const DB_FILE = path.join(process.cwd(), "./api/db.json");
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], rooms: [] }));

function readDB() {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// === USERS ===
app.get("/api/users", (req, res) => {
    const db = readDB();
    res.json(db.users);
});

app.post("/api/users", (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name required" });

    const user = { id: uuidv4(), name };
    const db = readDB();
    db.users.push(user);
    writeDB(db);

    res.status(201).json(user);
});

// === ROOMS ===
app.get("/api/rooms", (req, res) => {
    const db = readDB();
    res.json(db.rooms);
});

app.post("/api/rooms", (req, res) => {
    const { name, ownerId } = req.body;
    if (!name || !ownerId) return res.status(400).json({ error: "Missing name or ownerId" });

    const db = readDB();
    const owner = db.users.find(u => u.id === ownerId);
    if (!owner) return res.status(404).json({ error: "Owner not found" });

    const room = {
        id: uuidv4(),
        name,
        ownerId,
        participants: [ownerId],
        createdAt: new Date().toISOString(),
    };
    db.rooms.push(room);
    writeDB(db);

    res.status(201).json(room);
});

app.get("/api/rooms/:id", (req, res) => {
    const { id } = req.params;
    const db = readDB();
    const room = db.rooms.find(r => r.id === id);
    if (!room) return res.status(404).json({ error: "Room not found" });

    res.json(room);
});

app.put("/api/rooms/:id/join", (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "User is required" });

    const db = readDB();
    const user = db.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const { id } = req.params;
    const room = db.rooms.find(r => r.id === id);
    if (!room) return res.status(404).json({ error: "Room not found" });

    if (!room.participants.includes(userId)) room.participants.push(userId);
    writeDB(db);

    broadcastRoomUpdate(id);
    res.json(room);
});

app.put("/api/rooms/:id/leave", (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "User is required" });

  const { id } = req.params;
  const db = readDB();
  const room = db.rooms.find(r => r.id === id);
  if (!room) return res.status(404).json({ error: "Room not found" });

  room.participants = room.participants.filter(p => p !== userId);
  writeDB(db);

  broadcastRoomUpdate(id);
  res.json(room);
});

app.delete("/api/rooms/:id", (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "User is required" });

    const { id } = req.params;
    const db = readDB();
    const room = db.rooms.find(r => r.id === id);
    if (!room) return res.status(404).json({ error: "Room not found" });

    if (room.ownerId !== userId) return res.status(403).json({ error: "Only owner can delete this room" });

    db.rooms = db.rooms.filter(r => r.id !== id);
    writeDB(db);

    broadcastRoomUpdate(id);
    res.json({ message: "Room deleted" });
});

// === HEALTH ===
app.head("/api/status", (req, res) => {
    res.status(200).end();
});

// ROOM


const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => console.log(`✅ API running on port ${PORT}`));

// --- HTTP + WebSocket сервер ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Храним подключения: roomId → Set<WebSocket>
const roomSockets = new Map();

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const match = url.pathname.match(/^\/rooms\/(.+)$/);
  if (!match) {
    ws.close();
    return;
  }

  const roomId = match[1];
  console.log(`🔗 WebSocket connected to room ${roomId}`);

  if (!roomSockets.has(roomId)) roomSockets.set(roomId, new Set());
  roomSockets.get(roomId).add(ws);

  ws.on("close", () => {
    const set = roomSockets.get(roomId);
    if (set) {
      set.delete(ws);
      if (set.size === 0) roomSockets.delete(roomId);
    }
    console.log(`❌ WebSocket left room ${roomId}`);
  });
});

// Рассылка обновлений комнаты
function broadcastRoomUpdate(roomId) {
  const db = readDB();
  const room = db.rooms.find(r => r.id === roomId);
  const sockets = roomSockets.get(roomId);
  if (!room || !sockets) return;

  const message = JSON.stringify({ type: "room_update", room });
  for (const client of sockets) {
    if (client.readyState === 1) client.send(message);
  }
}

// Запускаем HTTP + WS сервер
server.listen(PORT, () =>
  console.log(`✅ Server + WebSocket running on http://localhost:${PORT}`)
);
