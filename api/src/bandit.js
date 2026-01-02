import { spawn } from "child_process";

export function selectBestParticipant(nArms) {
    return new Promise((resolve, reject) => {
        const py = spawn("python3", ["./api/src/recommendation_bandit.py", "select", nArms.toString()]);

        let output = "";
        py.stdout.on("data", (data) => (output += data.toString()));
        py.stderr.on("data", (data) => console.error("Python error:", data.toString()));
        py.on("close", (code) => {
            if (code !== 0) return reject(new Error("Python select failed"));
            resolve(Number(output.trim()));
        });
    });
}

export function updateBandit(nArms, chosenArm, reward) {
    return new Promise((resolve, reject) => {
        const py = spawn("python3", [
            "./api/src/recommendation_bandit.py",
            "update",
            nArms.toString(),
            chosenArm.toString(),
            reward.toString(),
        ]);

        py.stderr.on("data", (data) => console.error("Python error:", data.toString()));
        py.on("close", (code) => {
            if (code !== 0) return reject(new Error("Python update failed"));
            resolve(true);
        });
    });
}
