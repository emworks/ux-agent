import { useEffect, useRef, useState } from "react";
import { getRoomMessages } from './api';
import getUserColor from "./getUserColor";

export default function Chat({ user, room, ws }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef();

  // --- Загрузка истории сообщений при монтировании ---
  useEffect(() => {
    async function loadMessages() {
      const messages = await getRoomMessages(room.id); // твоя функция API
      setMessages(messages);
    }
    loadMessages();
  }, [room.id]);

  // --- Подписка на WebSocket ---
  useEffect(() => {
    if (!ws) return;
    const handleMessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "chat_message" && msg.message.roomId === room.id) {
        setMessages(prev => [...prev, msg.message]);
      }
    };
    ws.addEventListener("message", handleMessage);
    return () => ws.removeEventListener("message", handleMessage);
  }, [ws, room.id]);

  // --- Автопрокрутка вниз при новых сообщениях ---
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    ws.send(JSON.stringify({
      action: "send_message",
      payload: {
        roomId: room.id,
        roundId: room.currentRoundId || null,
        userId: user.id,
        text: input
      }
    }));
    setInput("");
  };

  return (
    <div className="w-80 flex-shrink-0 flex flex-col bg-gray-50 rounded shadow p-3 h-[calc(100vh-190px)]">
      <div className="flex-1 overflow-y-auto mb-2">
        {messages.map((m) => (
          <div key={m.id} className={`mb-2 ${m.userId === user.id ? "text-right" : "text-left"}`}>
            <span style={{ color: getUserColor(m.userName), fontWeight: 500 }}>
              {m.userName}
            </span>
            {m.roundId && (
              <span className="text-xs text-gray-400 ml-1">[R {m.roundId.slice(0,4)}]</span>
            )}
            : {m.text}
            <div className="text-xs text-gray-400">{new Date(m.createdAt).toLocaleTimeString()}</div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          className="flex-1 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="Type a message..."
        />
        <button
          onClick={sendMessage}
          className="bg-indigo-600 text-white px-4 rounded hover:bg-indigo-700 transition"
        >
          Send
        </button>
      </div>
    </div>
  );
}
