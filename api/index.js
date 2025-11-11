import express from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import swaggerUi from "swagger-ui-express";
import yaml from "js-yaml";
import fs from "fs";
import path from "path";
import http from "http";
import { WebSocketServer } from "ws";

import { getRole } from "./src/role.js";
import { generateRecommendation } from "./src/llm.js";
import { selectBestParticipant, updateBandit } from "./src/bandit.js";

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
    const { name, ownerId, researchMode = false } = req.body;
    if (!name || !ownerId) return res.status(400).json({ error: "Missing name or ownerId" });

    const db = readDB();
    const owner = db.users.find(u => u.id === ownerId);
    if (!owner) return res.status(404).json({ error: "Owner not found" });

    const room = {
        id: uuidv4(),
        name,
        ownerId,
        participants: [ownerId],
        researchMode,
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

app.get("/api/rooms/:id/messages", (req, res) => {
    const { id } = req.params;
    const db = readDB();
    const messages = (db.messages || []).filter(m => m.roomId === id);

    res.json(messages);
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
    if (!match) { ws.close(); return; }

    const roomId = match[1];
    if (!roomSockets.has(roomId)) roomSockets.set(roomId, new Set());
    roomSockets.get(roomId).add(ws);

    ws.on("message", async (raw) => {
        const { action, payload } = JSON.parse(raw);
        const db = readDB();
        const room = db.rooms.find(r => r.id === roomId);

        if (!room) return;

        // Гарантируем, что поле rounds существует
        if (!room.rounds) room.rounds = [];
        const currentRound = room.rounds.length > 0 ? room.rounds[room.rounds.length - 1] : null;

        switch (action) {
            case "start_round":
                if (room.ownerId !== payload.userId) return;

                const newRound = {
                    id: uuidv4(),
                    task: payload.task,
                    status: "cognitive_load", // первый этап голосования
                    cognitiveLoad: {},
                    votes: {},
                    votes2: {},               // второй голос
                    votes3: {},
                    teamEffectiveness: {},
                    recommendation: null,     // рекомендация от бэка
                    recommendationVotes: {},   // лайки/дизлайки
                    startedAt: new Date().toISOString(),
                };
                room.rounds.push(newRound);

                writeDB(db);
                broadcastRoundUpdate(roomId, newRound);
                break;

            case "vote":
                if (payload.userId === room.ownerId) return;
                if (!currentRound || !["voting", "recommendation", "final_voting"].includes(currentRound.status)) return;
                if (!room.participants.includes(payload.userId)) return;

                if (payload.voteNumber === 1) currentRound.votes[payload.userId] = payload.storyPoints;
                else if (payload.voteNumber === 2) currentRound.votes2[payload.userId] = payload.storyPoints;
                else if (payload.voteNumber === 3) currentRound.votes3[payload.userId] = payload.storyPoints;

                writeDB(db);
                broadcastRoundUpdate(roomId, currentRound);
                break;

            case "cognitive_load":
                if (payload.userId === room.ownerId) return;
                if (!currentRound || currentRound.status !== "cognitive_load") return;
                if (!room.participants.includes(payload.userId)) return;
                currentRound.cognitiveLoad[payload.userId] = payload.load;
                writeDB(db);
                broadcastRoundUpdate(roomId, currentRound);

                // Когда все участники отметили нагрузку
                const allLoads = Object.values(currentRound.cognitiveLoad);
                if (allLoads.length === room.participants.length) {
                    const avgLoad = allLoads.reduce((a, b) => a + b, 0) / allLoads.length;
                    currentRound.average_cognitive_load = Number(avgLoad.toFixed(2));
                    writeDB(db);
                    broadcastRoundUpdate(roomId, currentRound);
                }

                break;

            case "team_effectiveness":
                if (!currentRound || currentRound.status !== "teamEffectiveness") return;
                if (!room.participants.includes(payload.userId)) return;
                currentRound.teamEffectiveness[payload.userId] = payload.score;
                writeDB(db);
                broadcastRoundUpdate(roomId, currentRound);

                // когда все проголосовали — сохраняем среднюю эффективность
                const allScores = Object.values(currentRound.teamEffectiveness);
                if (allScores.length === room.participants.length) {
                    const avg = allScores.reduce((a, b) => a + b, 0) / allScores.length;
                    room.team_performance = Number(avg.toFixed(2));
                    writeDB(db);
                    broadcastRoomUpdate(roomId);
                }

                break;

            case "recommendation_vote":
                if (!currentRound || currentRound.status !== "recommendation") return;
                if (!room.participants.includes(payload.userId)) return;
                currentRound.recommendationVotes[payload.userId] = payload.like;
                writeDB(db);
                broadcastRoundUpdate(roomId, currentRound);

                const allVotes = Object.values(currentRound.recommendationVotes);
                if (allVotes.length === room.participants.length) {
                    const positive = allVotes.filter(v => v === true).length;
                    const acceptance = positive / allVotes.length;

                    // Обновляем доверие комнаты (глобальная метрика)
                    const prevReliance = room.reliance ?? 0.5;
                    const newReliance = (prevReliance * (room.rounds.length - 1) + acceptance) / room.rounds.length;

                    room.reliance = Number(newReliance.toFixed(2));
                    writeDB(db);
                    broadcastRoomUpdate(roomId);
                }

                // после recommendation_vote
                if (room.researchMode && payload.userId === currentRound.targetUserId) {
                    const reward = payload.like ? 1.0 : 0.0;
                    await updateBandit(room.participants.length - 1, currentRound.chosenIndex, reward);
                }

                break;

            case "next_phase":
                if (!currentRound || room.ownerId !== payload.userId) return;

                // включаем лоадер для фронта
                currentRound.loadingRecommendation = true;
                writeDB(db);
                broadcastRoundUpdate(roomId, currentRound);

                if (currentRound.status === "cognitive_load") {
                    currentRound.status = "voting";
                } else if (currentRound.status === "voting") {
                    currentRound.status = "voting_discussion";
                } else if (currentRound.status === "voting_discussion") {
                    // Генерируем рекомендацию для второго голосования, пока идет обсуждение
                    currentRound.status = "recommendation";

                    const context = {
                        round_id: currentRound.id,
                        task: currentRound.task,
                        votes: currentRound.votes,
                        cognitive_load: currentRound.average_cognitive_load,
                        team_performance: room.team_performance,
                        reliance: room.reliance
                    };

                    if (room.researchMode) {
                        const role = await getRole(context);
                        currentRound.role = role;
                    }

                    currentRound.recommendation = await generateRecommendation(context, currentRound.role);

                    const eligibleParticipants = room.participants.filter(p => p !== room.ownerId);

                    // 🧠 Режим исследования — выбираем "лучшего" участника
                    // 🎲 Обычный режим — выбираем случайного участника
                    currentRound.chosenIndex = room.researchMode ? await selectBestParticipant(eligibleParticipants.length) : Math.floor(Math.random() * eligibleParticipants.length);

                    const targetUser = eligibleParticipants[currentRound.chosenIndex];
                    currentRound.targetUserId = targetUser;
                } else if (currentRound.status === "recommendation") {
                    currentRound.status = "recommendation_discussion";
                } else if (currentRound.status === "recommendation_discussion") {
                    currentRound.status = "final_voting";
                } else if (currentRound.status === "final_voting") {
                    currentRound.status = "teamEffectiveness";
                } else if (currentRound.status === "teamEffectiveness") {
                    currentRound.status = "completed";
                    currentRound.completedAt = new Date().toISOString();
                }

                // выключаем лоадер
                currentRound.loadingRecommendation = false;

                writeDB(db);
                broadcastRoundUpdate(roomId, currentRound);
                break;

            case "end_round":
                if (!currentRound || room.ownerId !== payload.userId) return;
                currentRound.status = "completed";
                currentRound.completedAt = new Date().toISOString();
                writeDB(db);
                broadcastRoundUpdate(roomId, currentRound);
                break;

            case "send_message":
                const { text, roundId } = payload;
                if (!text || !payload.userId) return;

                const newMsg = {
                    id: uuidv4(),
                    roomId,
                    roundId: roundId || null,
                    userId: payload.userId,
                    text,
                    createdAt: new Date().toISOString()
                };

                // Сохраняем в DB
                db.messages = db.messages || [];
                db.messages.push(newMsg);
                writeDB(db);

                // Шлем всем клиентам в комнате
                const sockets = roomSockets.get(roomId);
                if (sockets) {
                    const msgPayload = JSON.stringify({ type: "chat_message", message: newMsg });
                    for (const s of sockets) {
                        if (s.readyState === 1) s.send(msgPayload);
                    }
                }
                break;
        }
    });

    ws.on("close", () => {
        const set = roomSockets.get(roomId);
        if (set) {
            set.delete(ws);
            if (set.size === 0) roomSockets.delete(roomId);
        }
    });
});

// ================= Broadcast =================
function broadcastRoundUpdate(roomId, round) {
    const sockets = roomSockets.get(roomId);
    if (!sockets) return;

    const message = JSON.stringify({ type: "round_update", round });
    for (const ws of sockets) {
        if (ws.readyState === 1) ws.send(message);
    }
}

function broadcastRoomUpdate(roomId) {
    const db = readDB();
    const room = db.rooms.find(r => r.id === roomId);
    if (!room) return;

    const message = JSON.stringify({ type: "room_update", room });
    const sockets = roomSockets.get(roomId);
    if (!sockets) return;

    for (const ws of sockets) {
        if (ws.readyState === 1) ws.send(message);
    }
}

// Запускаем HTTP + WS сервер
server.listen(PORT, () =>
    console.log(`✅ Server + WebSocket running on http://localhost:${PORT}`)
);
