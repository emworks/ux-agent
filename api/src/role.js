// role.js
import { spawn } from "child_process";

function mapToState(value, type) {
    if (value === undefined || value === null || Number.isNaN(value)) return "low"; // fallback

    switch (type) {
        case "cognitive_load":
            // cognitive load: 1–7 шкала
            return value > 4 ? "high" : "low";

        case "team_performance":
            // performance: средняя оценка (1–7)
            return value > 4 ? "high" : "low";

        case "reliance":
            // доверие: от 0 до 1
            return value > 0.5 ? "high" : "low";

        default:
            return "low";
    }
}

export async function getRole(cognitiveLoad, teamPerformance, reliance) {
    return new Promise((resolve, reject) => {
        cognitiveLoad = mapToState(cognitiveLoad, "cognitive_load");
        teamPerformance = mapToState(teamPerformance, "team_performance");
        reliance = mapToState(reliance, "reliance");

        const py = spawn("python3", ["./api/src/role_inference.py", cognitiveLoad, teamPerformance, reliance]);

        let output = "";
        py.stdout.on("data", (data) => {
            output += data.toString();
        });

        py.stderr.on("data", (data) => {
            console.error("Python error:", data.toString());
        });

        py.on("close", (code) => {
            if (code !== 0) reject(new Error("Python script failed"));
            else resolve(output.trim());
        });
    });
}
