export default function getRoundStatusLabel(status) {
    switch (status) {
        case "ждет начала":
        case "completed":
            return "Ожидание старта нового раунда";
        case "voting":
            return "1/7: Голосование";
        case "cognitive_load":
            return "2/7: Оценка когнитивной нагрузки";
        case "voting_discussion":
            return "3/7: Обсуждение результатов голосования";
        case "recommendation":
            return "4/7: Повторное голосование";
        case "recommendation_discussion":
            return "5/7: Обсуждение результатов повторного голосования";
        case "final_voting":
            return "6/7: Финальное голосование";
        case "teamEffectiveness":
            return "7/7: Оценка командной эффективности";
        default:
            return "Неизвестный статус";
    }
}