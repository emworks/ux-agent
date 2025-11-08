import { useState, useEffect } from "react";

export default function PlanningPokerRound({ user, isFacilitator, room, ws }) {
  const [round, setRound] = useState(null);
  const [taskInput, setTaskInput] = useState("");

  useEffect(() => {
    if (!ws) return;
    const handleMessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "round_update") setRound(message.round);
    };
    ws.addEventListener("message", handleMessage);
    return () => ws.removeEventListener("message", handleMessage);
  }, [ws]);

  const sendAction = (action, payload) => {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ action, payload }));
  };

  const startRound = () => {
    if (!taskInput.trim()) return;
    sendAction("start_round", { task: taskInput, userId: user.id });
    setTaskInput("");
  };
  const handleVote = (sp) => sendAction("vote", { userId: user.id, storyPoints: sp });
  const handleCognitiveLoad = (cl) => sendAction("cognitive_load", { userId: user.id, load: cl });
  const handleTeamEffectiveness = (score) => sendAction("team_effectiveness", { userId: user.id, score });
  const endRound = () => sendAction("end_round", { userId: user.id });
  const nextPhase = () => sendAction("next_phase", { userId: user.id });

  const status = round?.status || "ждет начала";
  const participants = round
    ? Array.from(new Set([...Object.keys(round.votes || {}), ...Object.keys(round.cognitiveLoad || {}), ...Object.keys(round.teamEffectiveness || {})]))
    : room.participants || [];

  const progressVotes = participants.length ? (Object.keys(round?.votes || {}).length / participants.length) * 100 : 0;
  const progressTeam = participants.length ? (Object.keys(round?.teamEffectiveness || {}).length / participants.length) * 100 : 0;

  const getInitials = (name) => name.slice(0, 2).toUpperCase();

  return (
    <div className="bg-white shadow-xl rounded-xl p-6 mt-6 border border-gray-200 max-w-4xl mx-auto">
      <h3 className="text-3xl font-bold mb-4 text-center">Planning Poker Round</h3>
      <p className="text-gray-700 mb-6 text-center">Status: <span className="font-semibold">{status}</span></p>

      {/* --- Фасилитатор стартует раунд --- */}
      {isFacilitator && (status === "ждет начала" || status === "completed") && (
        <div className="flex justify-center gap-3 mb-6">
          <input
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            placeholder="Task description"
            className="border border-gray-300 rounded-full px-4 py-2 w-80 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
          />
          <button
            onClick={startRound}
            className="bg-indigo-600 text-white px-6 py-2 rounded-full hover:bg-indigo-700 transition shadow-md"
          >
            Start Round
          </button>
        </div>
      )}

      {/* --- Фаза голосования --- */}
      {status === "voting" && !isFacilitator && (
        <div className="mb-6">
          <TaskCard task={round?.task} />
          <h4 className="text-lg font-semibold mb-2">Vote</h4>
          <div className="flex flex-wrap gap-3 mb-4 justify-center">
            {[1, 2, 3, 5, 8].map(sp => (
              <button
                key={sp}
                onClick={() => handleVote(sp)}
                className="bg-green-500 text-white px-4 py-2 rounded-full hover:bg-green-600 transition shadow-sm"
              >
                {sp} SP
              </button>
            ))}
          </div>
          <h4 className="text-lg font-semibold mb-2">Cognitive Load (1-7)</h4>
          <div className="flex flex-wrap gap-2 mb-2 justify-center">
            {[1, 2, 3, 4, 5, 6, 7].map(cl => (
              <button
                key={cl}
                onClick={() => handleCognitiveLoad(cl)}
                className="bg-yellow-400 text-black px-3 py-1 rounded-full hover:bg-yellow-500 transition shadow-sm"
              >
                {cl}
              </button>
            ))}
          </div>
          <ProgressBar progress={progressVotes} color="green" label={`${Object.keys(round?.votes || {}).length}/${participants.length} voted`} />
        </div>
      )}

      {/* --- Фаза командной эффективности --- */}
      {status === "teamEffectiveness" && !isFacilitator && (
        <div className="mb-6">
          <TaskCard task={round?.task} />
          <h4 className="text-lg font-semibold mb-2">Team Effectiveness (1-7)</h4>
          <div className="flex flex-wrap gap-2 justify-center mb-2">
            {[1, 2, 3, 4, 5, 6, 7].map(score => (
              <button
                key={score}
                onClick={() => handleTeamEffectiveness(score)}
                className="bg-blue-500 text-white px-3 py-1 rounded-full hover:bg-blue-600 transition shadow-sm"
              >
                {score}
              </button>
            ))}
          </div>
          <ProgressBar progress={progressTeam} color="blue" label={`${Object.keys(round?.teamEffectiveness || {}).length}/${participants.length} scored`} />
        </div>
      )}

      {/* --- Карточки участников --- */}
      <div className="mb-6">
        <h4 className="text-lg font-semibold mb-3 text-center">Participants</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {participants.map(id => (
            <div key={id} className="flex flex-col items-center bg-gray-50 p-4 rounded-2xl shadow hover:shadow-md transition">
              <div className="w-12 h-12 rounded-full bg-indigo-400 flex items-center justify-center text-white font-bold text-lg mb-2">
                {getInitials(id)}
              </div>
              <strong className="mb-1">{id}</strong>
              <div className="text-sm">Vote: {round?.votes?.[id] ?? "-"}</div>
              <div className="text-sm">Load: {round?.cognitiveLoad?.[id] ?? "-"}</div>
              <div className="text-sm">Team: {round?.teamEffectiveness?.[id] ?? "-"}</div>
            </div>
          ))}
        </div>
      </div>

      {/* --- Фасилитаторские кнопки --- */}
      {isFacilitator && status !== "ждет начала" && status !== "completed" && (
        <div className="flex justify-center gap-4 mb-4">
          <button onClick={nextPhase} className="bg-purple-500 text-white px-5 py-2 rounded-full hover:bg-purple-600 shadow-md transition">
            Next Phase
          </button>
          <button onClick={endRound} className="bg-red-500 text-white px-5 py-2 rounded-full hover:bg-red-600 shadow-md transition">
            End Round
          </button>
        </div>
      )}

      {status === "completed" && (
        <div className="text-center py-3 bg-gray-100 rounded-xl font-semibold shadow-inner">
          Round Completed
        </div>
      )}
    </div>
  );
}

function ProgressBar({ progress, color, label }) {
  const bgColor = color === "green" ? "bg-green-500" : "bg-blue-500";
  return (
    <div className="mt-2">
      <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
        <div className={`${bgColor} h-3 rounded-full transition-all`} style={{ width: `${progress}%` }} />
      </div>
      <small className="text-gray-600">{label}</small>
    </div>
  );
}

function TaskCard({ task }) {
  if (!task) return null;
  return (
    <div className="bg-gray-100 text-gray-800 p-4 rounded-lg mb-4 text-center font-medium shadow-sm">
      Task: {task}
    </div>
  );
}
