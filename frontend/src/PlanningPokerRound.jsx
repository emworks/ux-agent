import { useState, useEffect } from "react";

export default function PlanningPokerRound({ user, isFacilitator, room, ws }) {
  const [round, setRound] = useState(null);
  const [taskInput, setTaskInput] = useState("");

  // --- Подписка на обновления через WebSocket ---
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "round_update") setRound(message.round);
    };

    ws.addEventListener("message", handleMessage);
    return () => ws.removeEventListener("message", handleMessage);
  }, [ws]);

  // --- Отправка действий на сервер ---
  const sendAction = (action, payload) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action, payload }));
    }
  };

  // --- Фасилитатор создаёт раунд ---
  const startRound = () => {
    if (!taskInput.trim()) return;
    sendAction("start_round", { task: taskInput, userId: user.id });
    setTaskInput("");
  };

  // --- Голосование участника ---
  const handleVote = (storyPoints) => {
    sendAction("vote", { userId: user.id, storyPoints });
  };

  // --- Когнитивная нагрузка участника ---
  const handleCognitiveLoad = (load) => {
    sendAction("cognitive_load", { userId: user.id, load });
  };

  // --- Оценка командной эффективности ---
  const handleTeamEffectiveness = (score) => {
    sendAction("team_effectiveness", { userId: user.id, score });
  };

  // --- Фасилитатор завершает раунд ---
  const endRound = () => {
    sendAction("end_round", { userId: user.id });
  };

  // --- Фасилитатор переводит фазу ---
  const nextPhase = () => {
    sendAction("next_phase", { userId: user.id });
  };

  const status = round?.status || "ждет начала";

  const participants = round
    ? Array.from(
        new Set([
          ...Object.keys(round.votes || {}),
          ...Object.keys(round.cognitiveLoad || {}),
          ...Object.keys(round.teamEffectiveness || {}),
        ])
      )
    : room.participants || [];

  const progressVotes =
    participants.length > 0
      ? (Object.keys(round?.votes || {}).length / participants.length) * 100
      : 0;

  const progressTeam =
    participants.length > 0
      ? (Object.keys(round?.teamEffectiveness || {}).length / participants.length) * 100
      : 0;

  return (
    <div style={{ border: "1px solid #ccc", padding: 20, marginTop: 20, borderRadius: 8 }}>
      <h3>Planning Poker Round</h3>
      <p>Status: <strong>{status}</strong></p>

      {/* --- Фасилитатор может стартовать новый раунд --- */}
      {isFacilitator && (status === "ждет начала" || status === "completed") && (
        <div style={{ marginBottom: 20 }}>
          <input
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            placeholder="Task description"
            style={{ marginRight: 10, padding: 6, width: 200 }}
          />
          <button onClick={startRound} style={{ padding: "6px 12px" }}>Start Round</button>
        </div>
      )}

      {/* --- Фаза голосования --- */}
      {status === "voting" && !isFacilitator && (
        <div style={{ marginBottom: 20 }}>
          <h4>Vote</h4>
          {[1, 2, 3, 5, 8].map((sp) => (
            <button key={sp} onClick={() => handleVote(sp)} style={{ margin: 2 }}>
              {sp} SP
            </button>
          ))}
          <h4 style={{ marginTop: 10 }}>Cognitive Load (1-7)</h4>
          {[1, 2, 3, 4, 5, 6, 7].map((cl) => (
            <button key={cl} onClick={() => handleCognitiveLoad(cl)} style={{ margin: 2 }}>
              {cl}
            </button>
          ))}
          <ProgressBar progress={progressVotes} color="green" label={`${Object.keys(round?.votes || {}).length}/${participants.length} voted`} />
        </div>
      )}

      {/* --- Фаза оценки командной эффективности --- */}
      {status === "teamEffectiveness" && !isFacilitator && (
        <div style={{ marginBottom: 20 }}>
          <h4>Team Effectiveness (1-7)</h4>
          {[1, 2, 3, 4, 5, 6, 7].map((score) => (
            <button key={score} onClick={() => handleTeamEffectiveness(score)} style={{ margin: 2 }}>
              {score}
            </button>
          ))}
          <ProgressBar progress={progressTeam} color="blue" label={`${Object.keys(round?.teamEffectiveness || {}).length}/${participants.length} scored`} />
        </div>
      )}

      {/* --- Карточки участников --- */}
      <div>
        <h4>Participants</h4>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {participants.map((id) => (
            <div key={id} style={{ border: "1px solid #ccc", padding: 10, borderRadius: 6, minWidth: 100 }}>
              <strong>{id}</strong>
              <div>Vote: {round?.votes?.[id] ?? "-"}</div>
              <div>Load: {round?.cognitiveLoad?.[id] ?? "-"}</div>
              <div>Team: {round?.teamEffectiveness?.[id] ?? "-"}</div>
            </div>
          ))}
        </div>
      </div>

      {/* --- Фасилитаторские кнопки --- */}
      {isFacilitator && status !== "ждет начала" && status !== "completed" && (
        <div style={{ marginTop: 10 }}>
          <button onClick={nextPhase} style={{ marginRight: 10 }}>Next Phase</button>
          <button onClick={endRound}>End Round</button>
        </div>
      )}

      {status === "completed" && <div style={{ marginTop: 10, padding: 10, background: "#f0f0f0", borderRadius: 5 }}>
        <strong>Round Completed</strong>
      </div>}
    </div>
  );
}

function ProgressBar({ progress, color, label }) {
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ height: 10, background: "#eee", borderRadius: 5 }}>
        <div style={{ width: `${progress}%`, height: "100%", background: color, borderRadius: 5 }} />
      </div>
      <small>{label}</small>
    </div>
  );
}
