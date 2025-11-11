import { useState, useRef, useEffect } from "react";

function getRoundStatusLabel(status) {
  switch (status) {
    case "ждет начала":
    case "completed":
      return "Ожидание старта нового раунда";
    case "cognitive_load":
      return "Оценка когнитивной нагрузки";
    case "voting":
      return "Голосование";
    case "voting_discussion":
      return "Обсуждение результатов голосования";
    case "recommendation":
      return "Повторное голосование";
    case "recommendation_discussion":
      return "Обсуждение результатов повторного голосования";
    case "final_voting":
      return "Финальное голосование";
    case "teamEffectiveness":
      return "Оценка командной эффективности";
    default:
      return "Неизвестный статус";
  }
}

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

    // --- подгрузка последнего активного раунда при монтировании ---
    const currentRound = room.rounds?.pop();
    setRound(currentRound || null);

    return () => ws.removeEventListener("message", handleMessage);
  }, [ws, room]);

  const sendAction = (action, payload) => {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ action, payload }));
  };

  const startRound = () => {
    if (!taskInput.trim()) return;
    sendAction("start_round", { task: taskInput, userId: user.id });
    setTaskInput("");
  };

  const handleVote = (sp, voteNumber = 1) => sendAction("vote", { userId: user.id, storyPoints: sp, voteNumber });
  const handleCognitiveLoad = (cl) => sendAction("cognitive_load", { userId: user.id, load: cl });
  const handleTeamEffectiveness = (score) => sendAction("team_effectiveness", { userId: user.id, score });
  const handleRecommendationVote = (like) => sendAction("recommendation_vote", { userId: user.id, like });
  const endRound = () => sendAction("end_round", { userId: user.id });
  const nextPhase = () => sendAction("next_phase", { userId: user.id });

  const status = round?.status || "ждет начала";

  const participants = (room.participants || []).filter((p) => p !== room.ownerId);

  const progressVote1 = participants.length ? (Object.keys(round?.votes || {}).length / participants.length) * 100 : 0;
  const progressCl = participants.length ? (Object.keys(round?.cognitiveLoad || {}).length / participants.length) * 100 : 0;
  const progressVote2 = participants.length ? (Object.keys(round?.votes2 || {}).length / participants.length) * 100 : 0;
  const progressVote3 = participants.length ? (Object.keys(round?.votes3 || {}).length / participants.length) * 100 : 0
  const progressRecommendation = participants.length ? (Object.keys(round?.recommendationVotes || {}).length / 1) * 100 : 0;
  const progressTeam = participants.length ? (Object.keys(round?.teamEffectiveness || {}).length / participants.length) * 100 : 0;

  return (
    <div className="bg-white shadow-xl rounded-xl p-6 border border-gray-200 max-w-4xl mx-auto">
      <h3 className="text-3xl font-bold mb-4 text-center">Planning Poker Round</h3>
      <p className="text-gray-700 mb-6 text-center">
        Status: <span className="font-semibold">{getRoundStatusLabel(status)}</span>
      </p>

      {/* --- Фасилитатор стартует раунд --- */}
      {isFacilitator && (status === "ждет начала" || status === "completed") && (
        <div className="flex flex-col items-center gap-3 mb-6">
          <AutoResizingTextarea
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            placeholder="Task description"
          />
          <button
            onClick={startRound}
            className="bg-indigo-600 text-white px-6 py-2 rounded-full hover:bg-indigo-700 transition shadow-md"
          >
            Start Round
          </button>
        </div>
      )}


      {/* --- Cognitive Load --- */}
      {status === "cognitive_load" && (
        <>
          <TaskCard task={round?.task} />
          <VotePhase
            title="Cognitive Load"
            participants={participants}
            progress2={progressCl}
            showCognitiveLoad
            cognitiveLoad={round?.cognitiveLoad}
            handleCognitiveLoad={handleCognitiveLoad}
            isFacilitator={isFacilitator}
          />
        </>
      )}

      {/* --- Vote 1 --- */}
      {status === "voting" && (
        <>
          <TaskCard task={round?.task} />
          <VotePhase
            title="Vote 1"
            participants={participants}
            handleVote={(sp) => handleVote(sp, 1)}
            votes={round?.votes}
            progress={progressVote1}
            isFacilitator={isFacilitator}
          />
        </>
      )}

      {/* --- Vote 1 Discussion --- */}
      {status === "voting_discussion" && (
        <>
          <TaskCard task={round?.task} />
          {round?.loadingRecommendation && (
            <div className="text-center text-gray-500 py-2 mb-2">
              ⏳ Generating recommendation...
            </div>
          )}
          {!isFacilitator && (
            <TeamVotesView
              participants={participants}
              round={round}
              user={user}
            />
          )}
        </>
      )}

      {/* --- Vote 2 с рекомендацией --- */}
      {status === "recommendation" && (
        <div className="mb-6">
          <TaskCard task={round?.task} />
          {(isFacilitator || user.id === round?.targetUserId) && round?.recommendation && (
            <div className="bg-yellow-100 p-4 rounded mb-4 text-center">
              Recommendation: <span className="font-medium">{round.recommendation}</span>
            </div>
          )}

          {/* Голосовать могут только targetUserId */}
          {(isFacilitator || user.id === round?.targetUserId) && (
            <>
              <h4 className="text-lg font-semibold mb-2">Do you agree with recommendation?</h4>
              {!isFacilitator && (
                <div className="flex gap-4 justify-center mb-2">
                  <button onClick={() => handleRecommendationVote(true)} className="bg-blue-500 text-white px-3 py-1 rounded-full hover:bg-blue-600 shadow-sm">👍</button>
                  <button onClick={() => handleRecommendationVote(false)} className="bg-red-500 text-white px-3 py-1 rounded-full hover:bg-red-600 shadow-sm">👎</button>
                </div>
              )}
              <div className="mb-2">
                <ProgressBar progress={progressRecommendation} color="blue" />
              </div>
            </>
          )}

          <VotePhase
            title="Vote 2"
            participants={participants}
            handleVote={(sp) => handleVote(sp, 2)}
            votes={round?.votes2}
            progress={progressVote2}
            isFacilitator={isFacilitator}
          />
        </div>
      )}

      {/* --- Vote 2 Discussion --- */}
      {status === "recommendation_discussion" && (
        <>
          <TaskCard task={round?.task} />
          {!isFacilitator && (
            <TeamVotesView
              participants={participants}
              round={round}
              user={user}
            />
          )}
        </>
      )}

      {/* --- Vote 3 --- */}
      {status === "final_voting" && (
        <>
          <TaskCard task={round?.task} />
          <VotePhase
            title="Final Vote"
            participants={participants}
            handleVote={(sp) => handleVote(sp, 3)}
            votes={round?.votes3}
            progress={progressVote3}
            isFacilitator={isFacilitator}
          />
        </>
      )}

      {/* --- Team Effectiveness --- */}
      {status === "teamEffectiveness" && (
        <VotePhase
          title="Team Effectiveness"
          participants={participants}
          votes={round?.teamEffectiveness}
          progress={progressTeam}
          options={[1, 2, 3, 4, 5, 6, 7]}
          handleVote={handleTeamEffectiveness}
          isFacilitator={isFacilitator}
        />
      )}

      {isFacilitator && status !== "completed" && (
        !!participants?.length && <ParticipantsView
          participants={participants}
          round={round}
          user={user}
          isFacilitator={true}
        />
      )}

      {/* --- Фасилитаторские кнопки --- */}
      {isFacilitator && status !== "ждет начала" && status !== "completed" && (
        <div className="flex justify-center gap-4 mb-4">
          <button onClick={nextPhase} className="bg-purple-500 text-white px-5 py-2 rounded-full hover:bg-purple-600 shadow-md transition">Next Phase</button>
          <button onClick={endRound} className="bg-red-500 text-white px-5 py-2 rounded-full hover:bg-red-600 shadow-md transition">End Round</button>
        </div>
      )}

      {status === "completed" && (
        <div className="text-center py-3 bg-gray-100 rounded-xl font-semibold shadow-inner">Round Completed</div>
      )}
    </div>
  );
}

// ---------- Компонент Vote / Team ----------
function VotePhase({
  title,
  participants,
  handleVote,
  votes,
  progress,
  progress2,
  options = [1, 2, 3, 5, 8],
  showCognitiveLoad,
  cognitiveLoad,
  handleCognitiveLoad,
  isFacilitator,
}) {
  return (
    <div className="mb-6">
      {!showCognitiveLoad && (
        <>
          <h4 className="text-lg font-semibold mb-2">{title}</h4>
          {!isFacilitator && (
            <div className="flex flex-wrap gap-3 mb-4 justify-center">
              {options.map((val) => (
                <button key={val} onClick={() => handleVote(val)} className="bg-green-500 text-white px-4 py-2 rounded-full hover:bg-green-600 transition shadow-sm">{val}</button>
              ))}
            </div>
          )}
          <ProgressBar progress={progress} color="green" label={`${votes ? Object.keys(votes).length : 0}/${participants.length} voted`} />
        </>
      )}
      {showCognitiveLoad && (
        <div>
          <h4 className="text-lg font-semibold mb-2">Cognitive Load (1-7)</h4>
          {!isFacilitator && (
            <div className="flex flex-wrap gap-2 mb-2 justify-center">
              {[1, 2, 3, 4, 5, 6, 7].map(cl => (
                <button key={cl} onClick={() => handleCognitiveLoad(cl)} className="bg-yellow-400 text-black px-3 py-1 rounded-full hover:bg-yellow-500 transition shadow-sm">{cl}</button>
              ))}
            </div>
          )}
          <ProgressBar progress={progress2} color="green" label={`${cognitiveLoad ? Object.keys(cognitiveLoad).length : 0}/${participants.length} voted`} />
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

function ParticipantsView({ participants, round, user, isFacilitator }) {
  const [viewMode, setViewMode] = useState("cards");

  const getInitials = (id) => id.slice(0, 2).toUpperCase();

  // вспомогательная функция для цвета ячеек
  const getLoadColor = (value) => {
    if (value == null) return "text-gray-400";
    if (value < 3) return "text-green-600 font-medium";
    if (value < 6) return "text-yellow-600 font-medium";
    return "text-red-600 font-semibold";
  };

  const getTeamColor = (value) => {
    if (value == null) return "text-gray-400";
    if (value > 7) return "text-green-600 font-medium";
    if (value > 4) return "text-yellow-600 font-medium";
    return "text-red-600 font-semibold";
  };

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-lg font-semibold text-center flex-1">Participants</h4>
        <button
          onClick={() => setViewMode(viewMode === "cards" ? "table" : "cards")}
          className="px-3 py-1 text-sm bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-xl transition"
        >
          {viewMode === "cards" ? "📊 Table view" : "👥 Card view"}
        </button>
      </div>

      {viewMode === "cards" ? (
        // === КАРТОЧКИ ===
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {participants.map((id) => (
            <div
              key={id}
              className="flex flex-col items-center bg-gray-50 p-4 rounded-2xl shadow hover:shadow-md transition"
            >
              <div className="w-12 h-12 rounded-full bg-indigo-400 flex items-center justify-center text-white font-bold text-lg mb-2">
                {getInitials(id)}
              </div>
              <strong className="mb-1">{id}</strong>

              {isFacilitator ? (
                <>
                  <div className={`text-sm ${getLoadColor(round?.cognitiveLoad?.[id])}`}>
                    Load: {round?.cognitiveLoad?.[id] ?? "-"}
                  </div>
                  <div className="text-sm">Vote 1: {round?.votes?.[id] ?? "-"}</div>
                  <div className="text-sm">Vote 2: {round?.votes2?.[id] ?? "-"}</div>
                  <div className="text-sm">
                    Recommendation:{" "}
                    {round?.recommendationVotes?.[id] !== undefined
                      ? round.recommendationVotes[id]
                        ? "👍"
                        : "👎"
                      : "-"}
                  </div>
                  <div className="text-sm">Vote 3: {round?.votes3?.[id] ?? "-"}</div>
                  <div className={`text-sm ${getTeamColor(round?.teamEffectiveness?.[id])}`}>
                    Team: {round?.teamEffectiveness?.[id] ?? "-"}
                  </div>
                </>
              ) : (
                id === user.id && (
                  <>
                    {round?.cognitiveLoad?.[id] !== undefined && (
                      <div className={`text-sm ${getLoadColor(round.cognitiveLoad[id])}`}>
                        Load: {round.cognitiveLoad[id]}
                      </div>
                    )}
                    {round?.votes?.[id] !== undefined && <div className="text-sm">Vote 1: {round.votes[id]}</div>}
                    {round?.votes2?.[id] !== undefined && <div className="text-sm">Vote 2: {round.votes2[id]}</div>}
                    {round?.recommendationVotes?.[id] !== undefined && (
                      <div className="text-sm">
                        Recommendation: {round.recommendationVotes[id] ? "👍" : "👎"}
                      </div>
                    )}
                    {round?.votes3?.[id] !== undefined && <div className="text-sm">Vote 3: {round.votes3[id]}</div>}
                    {round?.teamEffectiveness?.[id] !== undefined && (
                      <div className={`text-sm ${getTeamColor(round.teamEffectiveness[id])}`}>
                        Team: {round.teamEffectiveness[id]}
                      </div>
                    )}
                  </>
                )
              )}
            </div>
          ))}
        </div>
      ) : (
        // === ТАБЛИЦА ===
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-200 rounded-2xl overflow-hidden">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="px-4 py-2 text-left">Participant</th>
                <th className="px-4 py-2 text-center">Load</th>
                <th className="px-4 py-2 text-center">Vote 1</th>
                <th className="px-4 py-2 text-center">Vote 2</th>
                <th className="px-4 py-2 text-center">Recommendation</th>
                <th className="px-4 py-2 text-center">Vote 3</th>
                <th className="px-4 py-2 text-center">Team</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((id, i) => (
                <tr key={id} className={i % 2 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-4 py-2 font-medium">{id}</td>
                  <td className={`px-4 py-2 text-center ${getLoadColor(round?.cognitiveLoad?.[id])}`}>
                    {round?.cognitiveLoad?.[id] ?? "-"}
                  </td>
                  <td className="px-4 py-2 text-center">{round?.votes?.[id] ?? "-"}</td>
                  <td className="px-4 py-2 text-center">{round?.votes2?.[id] ?? "-"}</td>
                  <td className="px-4 py-2 text-center">
                    {round?.recommendationVotes?.[id] !== undefined
                      ? round.recommendationVotes[id]
                        ? "👍"
                        : "👎"
                      : "-"}
                  </td>
                  <td className="px-4 py-2 text-center">{round?.votes3?.[id] ?? "-"}</td>
                  <td className={`px-4 py-2 text-center ${getTeamColor(round?.teamEffectiveness?.[id])}`}>
                    {round?.teamEffectiveness?.[id] ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TeamVotesView({ participants, round, user }) {
  const getInitials = (id) => id.slice(0, 2).toUpperCase();

  const getVoteColor = (vote) => {
    if (vote == null) return "bg-gray-300 text-gray-600";
    if (vote <= 3) return "bg-red-100 text-red-700";
    if (vote <= 6) return "bg-yellow-100 text-yellow-700";
    return "bg-green-100 text-green-700";
  };

  return (
    <div className="mb-6">
      <h4 className="text-lg font-semibold text-center mb-4">Team Votes</h4>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {participants.map((id) => {
          const vote1 = round?.votes?.[id];
          const vote2 = round?.votes2?.[id];
          const vote3 = round?.votes3?.[id];

          return (
            <div
              key={id}
              className={`flex flex-col items-center p-4 rounded-2xl shadow bg-white border transition ${id === user.id ? "ring-2 ring-indigo-400" : "hover:shadow-md"
                }`}
            >
              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-lg mb-2">
                {getInitials(id)}
              </div>

              <div className="text-sm font-medium mb-1">{id}</div>

              {/* Votes */}
              <div className="flex flex-col gap-1 w-full">
                <div
                  className={`text-sm text-center py-1 rounded-xl ${getVoteColor(vote1)}`}
                >
                  Vote 1: {vote1 ?? "–"}
                </div>
                <div
                  className={`text-sm text-center py-1 rounded-xl ${getVoteColor(vote2)}`}
                >
                  Vote 2: {vote2 ?? "–"}
                </div>
                <div
                  className={`text-sm text-center py-1 rounded-xl ${getVoteColor(vote3)}`}
                >
                  Vote 3: {vote3 ?? "–"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AutoResizingTextarea({ value, onChange, placeholder, className }) {
  const textareaRef = useRef(null);

  // Подстраиваем высоту под контент
  const autoResize = () => {
    const el = textareaRef.current;
    if (el && el.value) {
      el.style.height = "auto"; // сброс текущей высоты
      el.style.height = el.scrollHeight + "px"; // новая высота
    }
  };

  useEffect(() => autoResize(), [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => {
        onChange(e);
        autoResize();
      }}
      placeholder={placeholder}
      className={`border border-gray-300 rounded-lg px-4 py-2 w-full resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 overflow-hidden transition-all ${className}`}
      rows={1}
    />
  );
}