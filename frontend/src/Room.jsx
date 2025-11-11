import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { joinRoom, leaveRoom } from "./api";
import PlanningPokerRound from "./PlanningPokerRound";
import Chat from './Chat';
import getUserColor from "./getUserColor";

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

  const getInitials = (name) => name.slice(0, 2).toUpperCase();

  return (
    <div className="w-full max-w-screen-xl mx-auto h-screen">
      <div className="flex justify-between items-center mb-3 h-[calc(60px)] py-3 px-6 sticky top-0 bg-white z-1">
        <h2 className="text-2xl font-bold text-gray-800">
          <Link to="/">←</Link>{' '}
          {room.name}
        </h2>
        {/* <button
          onClick={handleLeave}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition"
        >
          Покинуть комнату
        </button> */}
        {room.participants?.length > 0 && (
              <ul className="flex gap-2">
                {room.participants.map(({ id: pid, name }) => (
                  <li
                    key={pid}
                    title={name}
                    style={{ backgroundColor: getUserColor(name) }}
                    className="relative group w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-semibold text-sm select-none hover:shadow transition"
                  >
                    {/* avatar */}
                    <span>
                      {getInitials(name)}
                    </span>

                    {/* remove button (only for facilitator, and not self) */}
                    {user.id === room.ownerId && pid !== user.id && (
                      <button
                        onClick={async () => {
                          if (!window.confirm(`Remove ${name} from the room?`)) return;
                          try {
                            await leaveRoom(id, pid);
                            setRoom((prev) => ({
                              ...prev,
                              participants: prev.participants.filter((x) => x.id !== pid),
                            }));
                          } catch (err) {
                            console.error(err);
                            alert("Could not remove participant. Try again.");
                          }
                        }}
                        className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 bg-red-500 text-white w-4 h-4 rounded-full text-xs flex items-center justify-center hover:bg-red-600 transition"
                        title="Remove participant"
                      >
                        ×
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
      </div>

      {/* --- Основной контент --- */}
      <div className="flex gap-6 p-6">
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
        <div className="w-80 flex-shrink-0 h-full">
          <Chat user={user} room={room} ws={ws} />
        </div>
      </div>
    </div>
  );
}
