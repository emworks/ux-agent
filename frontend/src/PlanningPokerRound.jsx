import { useState, useRef, useEffect } from "react";
import getUserColor from "./getUserColor";
import getRoundStatusLabel from "./getRoundStatusLabel";

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

  const [selectedRecommendation, setSelectedRecommendation] = useState(null);

  useEffect(() => {
    setSelectedRecommendation(round?.recommendationVotes?.[user.id] ?? null);
  }, [round?.recommendationVotes]);

  return (
    <div className="bg-white shadow-xl rounded-xl p-6 border border-gray-200 max-w-4xl mx-auto">
      <p className="text-gray-700 mb-6 text-center">
        <span className="font-semibold">{getRoundStatusLabel(status)}</span>
      </p>

      {/* --- Фасилитатор стартует раунд --- */}
      {isFacilitator && (status === "ждет начала" || status === "completed") && (
        <div className="flex flex-col items-center gap-3 mb-6">
          <AutoResizingTextarea
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            placeholder="Описание задачи для участников"
          />
          <button
            onClick={startRound}
            className="bg-indigo-600 text-white px-6 py-2 rounded-full hover:bg-indigo-700 transition shadow-md"
          >
            Начать раунд
          </button>
        </div>
      )}

      {/* --- Cognitive Load --- */}
      {status === "cognitive_load" && (
        <>
          <TaskCard task={round?.task} />
          <VotePhase
            title="Когнитивная нагрузка"
            participants={participants}
            progress2={progressCl}
            showCognitiveLoad
            cognitiveLoad={round?.cognitiveLoad}
            handleCognitiveLoad={handleCognitiveLoad}
            isFacilitator={isFacilitator}
            user={user}
          />
        </>
      )}

      {/* --- Vote 1 --- */}
      {status === "voting" && (
        <>
          <TaskCard task={round?.task} />
          <VotePhase
            title="Оцените сложность задачи в Story Points"
            participants={participants}
            handleVote={(sp) => handleVote(sp, 1)}
            votes={round?.votes}
            progress={progressVote1}
            isFacilitator={isFacilitator}
            user={user}
          />
        </>
      )}

      {/* --- Vote 1 Discussion --- */}
      {status === "voting_discussion" && (
        <>
          <TaskCard task={round?.task} />
          {round?.loadingRecommendation && (
            <div className="text-center text-gray-500 py-2 mb-2">
              ⏳ AI думает...
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
            <RecommendationCard recommendation={round.recommendation}/>
          )}

          <VotePhase
            title="Оцените сложность задачи в Story Points"
            participants={participants}
            handleVote={(sp) => handleVote(sp, 2)}
            votes={round?.votes2}
            progress={progressVote2}
            isFacilitator={isFacilitator}
            user={user}
          />

          {/* Голосовать могут только targetUserId */}
          {(isFacilitator || user.id === round?.targetUserId) && (
            <>
              <h4 className="text-lg font-semibold mb-2">Рекомендация была полезна?</h4>
              {!isFacilitator && (
                <div className="flex gap-4 justify-center mb-4">
                  <button onClick={() => {
                    setSelectedRecommendation(true);
                    handleRecommendationVote(true);
                  }} className={`px-3 py-1 rounded-full shadow-sm transition
      ${selectedRecommendation === true
                      ? "bg-blue-600 text-white ring-2 ring-blue-400"
                      : "bg-blue-500 text-white hover:bg-blue-600"}`}>👍</button>
                  <button onClick={() => {
                    setSelectedRecommendation(false);
                    handleRecommendationVote(false)
                  }} className={`px-3 py-1 rounded-full shadow-sm transition
      ${selectedRecommendation === false
                      ? "bg-red-600 text-white ring-2 ring-red-400"
                      : "bg-red-500 text-white hover:bg-red-600"}`}>👎</button>
                </div>
              )}
              <div className="mb-2">
                <ProgressBar progress={progressRecommendation} color="blue" />
              </div>
            </>
          )}
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
            title="Оцените сложность задачи в Story Points"
            participants={participants}
            handleVote={(sp) => handleVote(sp, 3)}
            votes={round?.votes3}
            progress={progressVote3}
            isFacilitator={isFacilitator}
            user={user}
          />
        </>
      )}

      {/* --- Team Effectiveness --- */}
      {status === "teamEffectiveness" && (
        <VotePhase
          title="Насколько эффективно команда справилась с задачей? (1 – совсем неэффективно, 7 – очень эффективно)"
          participants={participants}
          votes={round?.teamEffectiveness}
          progress={progressTeam}
          options={[1, 2, 3, 4, 5, 6, 7]}
          handleVote={handleTeamEffectiveness}
          isFacilitator={isFacilitator}
          user={user}
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
          <button onClick={nextPhase} className="bg-purple-500 text-white px-5 py-2 rounded-full hover:bg-purple-600 shadow-md transition">Продолжить</button>
          <button onClick={endRound} className="bg-red-500 text-white px-5 py-2 rounded-full hover:bg-red-600 shadow-md transition">Завершить раунд</button>
        </div>
      )}

      {status === "completed" && (
        <div className="text-center py-3 bg-gray-100 rounded-xl font-semibold shadow-inner">Раунд завершён</div>
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
  options = [1, 2, 3, 5, 8, 13],
  showCognitiveLoad,
  cognitiveLoad,
  handleCognitiveLoad,
  isFacilitator,
  user
}) {
  const [selectedVote, setSelectedVote] = useState(null);
  const [selectedLoad, setSelectedLoad] = useState(null);

  useEffect(() => {
    setSelectedVote(votes?.[user.id] ?? null);
  }, [votes]);

  useEffect(() => {
    setSelectedLoad(cognitiveLoad?.[user.id] ?? null);
  }, [cognitiveLoad]);

  return (
    <div className="mb-6">
      {!showCognitiveLoad && (
        <>
          <h4 className="text-lg font-semibold mb-2">{title}</h4>
          {!isFacilitator && (
            <div className="flex flex-wrap gap-3 mb-4 justify-center">
              {options.map((val) => (
                <button key={val} onClick={() => {
                  setSelectedVote(val);
                  handleVote(val);
                }} className={`px-4 py-2 rounded-full shadow-sm transition
    ${selectedVote === val
                    ? "bg-green-600 text-white ring-2 ring-green-400"
                    : "bg-green-500 text-white hover:bg-green-600"}`}>{val}</button>
              ))}
            </div>
          )}
          <ProgressBar progress={progress} color="green" label={`${votes ? Object.keys(votes).length : 0}/${participants.length} voted`} />
        </>
      )}
      {showCognitiveLoad && (
        <div>
          <h4 className="text-lg font-semibold mb-2">
            Насколько сложно было оценить задачу? (1 – совсем не сложно, 7 – крайне сложно)
          </h4>
          {!isFacilitator && (
            <div className="flex flex-wrap gap-2 mb-2 justify-center">
              {[1, 2, 3, 4, 5, 6, 7].map(cl => (
                <button key={cl} onClick={() => {
                  setSelectedLoad(cl);
                  handleCognitiveLoad(cl);
                }} className={`px-3 py-1 rounded-full transition shadow-sm
    ${selectedLoad === cl
                    ? "bg-yellow-500 text-black ring-2 ring-yellow-400"
                    : "bg-yellow-400 hover:bg-yellow-500 text-black"}`}>{cl}</button>
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
    <div className="bg-gray-100 text-gray-800 p-4 rounded-lg mb-4 shadow-sm">
      <h3 className="text-sm uppercase text-gray-500 mb-2">Задача</h3>
      <div className="whitespace-pre-wrap font-medium">{task}</div>
    </div>
  );
}

function RecommendationCard({ recommendation }) {
  if (!recommendation) return null;
  return (
    <div className="bg-yellow-100 p-4 rounded-lg mb-4 shadow-sm">
      <h3 className="text-sm uppercase text-gray-500 mb-2">Рекомендация от AI</h3>
      <div className="whitespace-pre-wrap font-medium">{recommendation}</div>
    </div>
  );
}

function ParticipantsView({ participants, round, user, isFacilitator }) {
  const [viewMode, setViewMode] = useState("cards");

  const getInitials = (name) => name.slice(0, 2).toUpperCase();

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
        <h4 className="text-lg font-semibold text-center flex-1">Участники</h4>
        <button
          onClick={() => setViewMode(viewMode === "cards" ? "table" : "cards")}
          className="px-3 py-1 text-sm bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-xl transition"
        >
          {viewMode === "cards" ? "📊 Показать таблицу" : "👥 Показать карточки"}
        </button>
      </div>

      {viewMode === "cards" ? (
        // === КАРТОЧКИ ===
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {participants.map(({ id: pid, name }) => (
            <div
              key={pid}
              className="flex flex-col items-center bg-gray-50 p-4 rounded-2xl shadow hover:shadow-md transition"
            >
              <div
                style={{ backgroundColor: getUserColor(name) }}
                className="w-12 h-12 rounded-full bg-indigo-400 flex items-center justify-center text-white font-bold text-lg mb-2"
              >
                {getInitials(name)}
              </div>
              <strong className="mb-1">{name}</strong>

              {isFacilitator ? (
                <>
                  <div className={`text-sm ${getLoadColor(round?.cognitiveLoad?.[pid])}`}>
                    Load: {round?.cognitiveLoad?.[pid] ?? "-"}
                  </div>
                  <div className="text-sm">Vote 1: {round?.votes?.[pid] ?? "-"}</div>
                  <div className="text-sm">Vote 2: {round?.votes2?.[pid] ?? "-"}</div>
                  <div className="text-sm">
                    Rec:{" "}
                    {round?.recommendationVotes?.[pid] !== undefined
                      ? round.recommendationVotes[pid]
                        ? "👍"
                        : "👎"
                      : "-"}
                  </div>
                  <div className="text-sm">Vote 3: {round?.votes3?.[pid] ?? "-"}</div>
                  <div className={`text-sm ${getTeamColor(round?.teamEffectiveness?.[pid])}`}>
                    Perf: {round?.teamEffectiveness?.[pid] ?? "-"}
                  </div>
                </>
              ) : (
                pid === user.id && (
                  <>
                    {round?.cognitiveLoad?.[pid] !== undefined && (
                      <div className={`text-sm ${getLoadColor(round.cognitiveLoad[pid])}`}>
                        Load: {round.cognitiveLoad[pid]}
                      </div>
                    )}
                    {round?.votes?.[pid] !== undefined && <div className="text-sm">Vote 1: {round.votes[pid]}</div>}
                    {round?.votes2?.[pid] !== undefined && <div className="text-sm">Vote 2: {round.votes2[pid]}</div>}
                    {round?.recommendationVotes?.[pid] !== undefined && (
                      <div className="text-sm">
                        Rec: {round.recommendationVotes[pid] ? "👍" : "👎"}
                      </div>
                    )}
                    {round?.votes3?.[pid] !== undefined && <div className="text-sm">Vote 3: {round.votes3[pid]}</div>}
                    {round?.teamEffectiveness?.[pid] !== undefined && (
                      <div className={`text-sm ${getTeamColor(round.teamEffectiveness[pid])}`}>
                        Perf: {round.teamEffectiveness[pid]}
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
                <th className="px-4 py-2 text-left">Участник</th>
                <th className="px-4 py-2 text-center">Load</th>
                <th className="px-4 py-2 text-center">Vote 1</th>
                <th className="px-4 py-2 text-center">Vote 2</th>
                <th className="px-4 py-2 text-center">Rec</th>
                <th className="px-4 py-2 text-center">Vote 3</th>
                <th className="px-4 py-2 text-center">Perf</th>
              </tr>
            </thead>
            <tbody>
              {participants.map(({ id: pid, name }, i) => (
                <tr key={pid} className={i % 2 ? "bg-white" : "bg-gray-50"}>
                  <td style={{ color: getUserColor(name) }} className="px-4 py-2 font-medium">{name}</td>
                  <td className={`px-4 py-2 text-center ${getLoadColor(round?.cognitiveLoad?.[pid])}`}>
                    {round?.cognitiveLoad?.[pid] ?? "-"}
                  </td>
                  <td className="px-4 py-2 text-center">{round?.votes?.[pid] ?? "-"}</td>
                  <td className="px-4 py-2 text-center">{round?.votes2?.[pid] ?? "-"}</td>
                  <td className="px-4 py-2 text-center">
                    {round?.recommendationVotes?.[pid] !== undefined
                      ? round.recommendationVotes[pid]
                        ? "👍"
                        : "👎"
                      : "-"}
                  </td>
                  <td className="px-4 py-2 text-center">{round?.votes3?.[pid] ?? "-"}</td>
                  <td className={`px-4 py-2 text-center ${getTeamColor(round?.teamEffectiveness?.[pid])}`}>
                    {round?.teamEffectiveness?.[pid] ?? "-"}
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
  const getInitials = (name) => name.slice(0, 2).toUpperCase();

  const getVoteColor = (vote) => {
    if (vote == null) return "bg-gray-300 text-gray-600";
    if (vote <= 3) return "bg-red-100 text-red-700";
    if (vote <= 6) return "bg-yellow-100 text-yellow-700";
    return "bg-green-100 text-green-700";
  };

  return (
    <div className="mb-6">
      <h4 className="text-lg font-semibold text-center mb-4">Оценки команды</h4>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {participants.map(({ id: pid, name }) => {
          const vote1 = round?.votes?.[pid];
          const vote2 = round?.votes2?.[pid];
          const vote3 = round?.votes3?.[pid];

          return (
            <div
              key={pid}
              className={`flex flex-col items-center p-4 rounded-2xl shadow bg-white border transition ${pid === user.id ? "ring-2 ring-indigo-400" : "hover:shadow-md"
                }`}
            >
              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-lg mb-2">
                {getInitials(name)}
              </div>

              <div className="text-sm font-medium mb-1">{name}</div>

              {/* Votes */}
              <div className="flex flex-col gap-1 w-full">
                <div
                  className={`text-sm text-center py-1 rounded-xl ${getVoteColor(vote1)}`}
                >
                  Оценка 1: {vote1 ?? "–"}
                </div>
                <div
                  className={`text-sm text-center py-1 rounded-xl ${getVoteColor(vote2)}`}
                >
                  Оценка 2: {vote2 ?? "–"}
                </div>
                <div
                  className={`text-sm text-center py-1 rounded-xl ${getVoteColor(vote3)}`}
                >
                  Оценка 3: {vote3 ?? "–"}
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