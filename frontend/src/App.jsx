import { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  Link
} from "react-router-dom";
import { createUser, getRooms, createRoom, deleteRoom } from "./api";
import Room from "./Room";
import getRoundStatusLabel from "./getRoundStatusLabel";

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
  const [isResearchMode, setIsResearchMode] = useState(false);
  const navigate = useNavigate();

  async function fetchRooms() {
    const data = await getRooms();
    setRooms(data);
  }

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 3000); // обновление каждые 3 сек
    return () => clearInterval(interval);
  }, []);

  async function handleLogin() {
    if (!name) return;
    const u = await createUser(name);
    localStorage.setItem("user", JSON.stringify(u));

    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get("roomId");

    if (roomId) {
      navigate(`/room/${roomId}`);
    }

    setUser(u);
    setName("");
  }

  async function handleCreateRoom() {
    if (!roomName || !user) return;
    await createRoom(roomName, user.id, isResearchMode);
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 w-full max-w-sm">
          <h2 className="text-2xl font-bold mb-4 text-center">Регистрация</h2>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ваше имя"
            className="w-full border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={handleLogin}
            className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
          >
            Войти
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Привет, {user.name}</h2>

      <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
        <h3 className="text-lg font-semibold mb-3">Новая комната</h3>
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <input
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="Название комнаты"
            className="flex-1 bg-white border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 w-full sm:w-auto"
          />

          <div className="flex items-center gap-2">
            <button
              title="Включить исследовательский режим"
              type="button"
              onClick={() => setIsResearchMode(!isResearchMode)}
              className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${isResearchMode ? "bg-indigo-600" : "bg-gray-300"
                }`}
            >
              <span
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${isResearchMode ? "translate-x-6" : "translate-x-0"
                  }`}
              />
            </button>
          </div>

          <button
            onClick={handleCreateRoom}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition"
          >
            Создать
          </button>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Все комнаты</h3>
        {rooms.length === 0 ? (
          <p className="text-gray-500">Нет ни одной комнаты</p>
        ) : (
          <ul className="space-y-4">
            {rooms.map((r) => (
              <li
                key={r.id}
                className="bg-white p-4 rounded-xl border border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
              >
                <div>
                  <div className="font-semibold text-gray-800">{r.name}</div>
                  <div className="text-gray-500 text-sm mt-1">Владелец: {r.owner.name}</div>
                  <div className="text-gray-600 text-sm mt-1">
                    Участники: {r.participants.length > 0 ? r.participants.map(({ name }) => name).join(", ") : "No one"}
                  </div>
                  <div className="text-gray-600 text-sm mt-1">
                    {r.rounds && r.rounds.length > 0 ? (
                      <>
                        Статус: <span className="font-medium">
                          {getRoundStatusLabel(r.rounds[r.rounds.length - 1].status)}
                        </span>
                      </>
                    ) : (
                      <>Нет активного раунда</>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-2 md:mt-0">
                  <button
                    onClick={() => handleGoToRoom(r.id)}
                    className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition"
                  >
                    Присоединиться
                  </button>
                  {r.ownerId === user.id && (
                    <button
                      onClick={() => handleDeleteRoom(r.id)}
                      className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition"
                    >
                      Удалить
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
