import { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  useParams,
  Link
} from "react-router-dom";
import { createUser, getRooms, createRoom, joinRoom, deleteRoom } from "./api";
import Room from "./Room";

// ---------- Главный компонент ----------
export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/room/:id" element={<Room />} />
      </Routes>
    </Router>
  );
}

// ---------- Страница со списком комнат ----------
function Lobby() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user")));
  const [name, setName] = useState("");
  const [rooms, setRooms] = useState([]);
  const [roomName, setRoomName] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchRooms();
  }, []);

  async function fetchRooms() {
    const data = await getRooms();
    setRooms(data);
  }

  async function handleLogin() {
    if (!name) return;
    const u = await createUser(name);
    localStorage.setItem("user", JSON.stringify(u));
    setUser(u);
    setName("");
  }

  async function handleCreateRoom() {
    if (!roomName || !user) return;
    const room = await createRoom(roomName, user.id);
    setRoomName("");
    fetchRooms();
  }

  function handleGoToRoom(id) {
    navigate(`/room/${id}`);
  }

  async function handleDeleteRoom(id) {
    if (!user) return;
    await deleteRoom(id, user.id);
    fetchRooms();
  }

  if (!user) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Login / Register</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
        />
        <button onClick={handleLogin}>Login</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Welcome, {user.name}</h2>

      <h3>Create Room</h3>
      <input
        value={roomName}
        onChange={(e) => setRoomName(e.target.value)}
        placeholder="Room name"
      />
      <button onClick={handleCreateRoom}>Create</button>

      <h3>Rooms</h3>
      <ul>
        {rooms.map((r) => (
          <li key={r.id}>
            {r.name} (Owner: {r.ownerId}){" "}
            <button onClick={() => handleGoToRoom(r.id)}>Join</button>
            {r.ownerId === user.id && (
              <button onClick={() => handleDeleteRoom(r.id)}>Delete</button>
            )}
            <div>Participants: {r.participants.join(", ")}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}