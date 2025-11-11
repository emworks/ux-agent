export default function getRoundStatusLabel(status) {
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