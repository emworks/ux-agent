import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { joinRoom, leaveRoom } from "./api";
import PlanningPokerRound from "./PlanningPokerRound";

export default function Room() {
  const { id } = useParams();
  const [user] = useState(JSON.parse(localStorage.getItem("user")));
  const [room, setRoom] = useState(null);
  const [ws, setWs] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }

    let socket;

    async function init() {
      // 1. Присоединяемся через API
      const joined = await joinRoom(id, user.id);
      setRoom(joined);

      // 2. Подключаемся к WebSocket
      socket = new WebSocket(`ws://localhost:3000/rooms/${id}`);
      setWs(socket);

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "room_update") {
          // Обновляем комнату при любых изменениях
          setRoom(message.room);
        }
      };

      socket.onclose = () => console.log("🔌 Disconnected from room");
    }

    init();

    return () => {
      if (socket) socket.close();
    };
  }, [id, user, navigate]);

  async function handleLeave() {
    if (!room || !user) return;

    const confirmLeave = window.confirm("Leave the room?");
    if (!confirmLeave) return;

    await leaveRoom(id, user.id);
    navigate("/");
  }

  if (!room) return <div>Loading room...</div>;

  return (
    <div style={{ padding: 20 }}>
      <h2>Room: {room.name}</h2>

      <div style={{ marginBottom: 10 }}>
        <strong>Participants:</strong>{" "}
        {room.participants.length > 0 ? room.participants.join(", ") : "No one here yet"}
      </div>

      <button onClick={handleLeave}>Leave Room</button>

      <PlanningPokerRound
        user={user}
        isFacilitator={user.id === room.ownerId}
        room={room}
        ws={ws} // Используем существующий WebSocket
      />

      <div style={{ marginTop: 20 }}>
        <Link to="/">← Back to lobby</Link>
      </div>
    </div>
  );
}
