import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { joinRoom, leaveRoom } from "./api";
import PlanningPokerRound from "./PlanningPokerRound";
import Chat from './Chat';

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
      const joined = await joinRoom(id, user.id);
      setRoom(joined);

      socket = new WebSocket(`ws://localhost:3000/rooms/${id}`);
      setWs(socket);

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "room_update") setRoom(message.room);
      };

      socket.onclose = () => console.log("🔌 Disconnected from room");
    }

    init();

    return () => socket?.close();
  }, [id, user, navigate]);

  async function handleLeave() {
    if (!room || !user) return;
    if (!window.confirm("Leave the room?")) return;

    await leaveRoom(id, user.id);
    navigate("/");
  }

  if (!room) return <div className="text-center py-10 text-gray-500">Loading room...</div>;

  return (
    <div className="w-full max-w-screen-xl mx-auto p-6 h-screen">
      <div className="flex justify-between items-center mb-6 h-[calc(40px)]">
        <h2 className="text-2xl font-bold text-gray-800">Room: {room.name}</h2>
        <button
          onClick={handleLeave}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition"
        >
          Leave Room
        </button>
      </div>

      <div className="flex items-center gap-2 mb-6 p-4 bg-gray-50 rounded shadow h-[calc(60px)] overflow-y-auto">
        <strong className="text-gray-700">Participants:</strong>{" "}
        {room.participants?.length > 0 ? (
          <ul className="flex gap-2 text-nowrap">
            {room.participants.map((p) => (
              <li
                key={p}
                className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2"
              >
                {p}
                {user.id === room.ownerId && p !== user.id && (
                  <button
                    onClick={async () => {
                      if (!window.confirm(`Remove ${p} from the room?`)) return;
                      try {
                        await leaveRoom(id, p);
                        setRoom((prev) => ({
                          ...prev,
                          participants: prev.participants.filter((x) => x !== p),
                        }));
                      } catch (err) {
                        console.error(err);
                        alert("Could not remove participant. Try again.");
                      }
                    }}
                    className="bg-red-500 text-white px-2 py-0.5 rounded hover:bg-red-600 transition text-xs"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-gray-400 ml-2">No one here yet</span>
        )}
      </div>

      {/* --- Основной контент --- */}
      <div className="flex gap-6">

        
        {/* PlanningPokerRound растягивается и прокручивается */}
        <div className="flex-1 overflow-y-auto min-w-[600px]">
          <PlanningPokerRound
            user={user}
            isFacilitator={user.id === room.ownerId}
            room={room}
            ws={ws}
          />
        </div>

        {/* Chat фиксированной ширины, растягивается по высоте */}
        <div className="w-80 flex-shrink-0 h-full sticky top-5">
          <Chat user={user} room={room} ws={ws} />
        </div>
      </div>

      <div className="mt-6">
        <Link to="/" className="text-blue-500 hover:underline">
          ← Back to lobby
        </Link>
      </div>
    </div>
  );
}
