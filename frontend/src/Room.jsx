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
      // Присоединяемся через API
      const joined = await joinRoom(id, user.id);
      setRoom(joined);

      // Подключаемся к WebSocket
      socket = new WebSocket(`ws://localhost:3000/rooms/${id}`);
      setWs(socket);

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "room_update") {
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

  if (!room) return <div className="text-center py-10 text-gray-500">Loading room...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Room: {room.name}</h2>
        <button
          onClick={handleLeave}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition"
        >
          Leave Room
        </button>
      </div>

      <div className="mb-6 p-4 bg-gray-50 rounded shadow">
        <strong className="text-gray-700">Participants:</strong>{" "}
        {room.participants.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {room.participants.map((p) => (
              <li key={p} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                {p}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-gray-400 ml-2">No one here yet</span>
        )}
      </div>

      <PlanningPokerRound
        user={user}
        isFacilitator={user.id === room.ownerId}
        room={room}
        ws={ws}
      />

      <div className="mt-6">
        <Link to="/" className="text-blue-500 hover:underline">
          ← Back to lobby
        </Link>
      </div>
    </div>
  );
}
