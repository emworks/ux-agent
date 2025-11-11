// import OpenAI from "openai";

// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateRecommendation(context, role) {
    //     const prompt = `
    // Ты ${role} в Planning Poker сессии. Участники проголосовали по задаче "${context.task}".
    // Их оценки: ${JSON.stringify(context.votes)}
    // Их когнитивная нагрузка: ${JSON.stringify(context.cognitiveLoad)}
    // Командная эффективность: ${JSON.stringify(context.teamEffectiveness)}

    // Сделай короткий совет участникам для повторного голосования. Ответ дай в 1-2 предложениях.
    //   `;

    // const completion = await openai.chat.completions.create({
    //     model: "gpt-4",
    //     messages: [{ role: "user", content: prompt }],
    //     temperature: 0.7
    // });

    // return completion.choices[0].message.content.trim();

    // context: { task, votes, cognitiveLoad, teamEffectiveness }
    const votes = Object.values(context.votes || {});
    const avgVote = votes.length ? (votes.reduce((a, b) => a + b, 0) / votes.length).toFixed(1) : "-";
    const loads = Object.values(context.cognitiveLoad || {});
    const avgLoad = loads.length ? (loads.reduce((a, b) => a + b, 0) / loads.length).toFixed(1) : "-";

    return `Роль AI: ${role}\nСредняя оценка задачи: ${avgVote}\nСредняя нагрузка: ${avgLoad}.\nРекомендуем обсудить детали и уточнить оценки.`;
}