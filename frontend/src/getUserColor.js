const colors = [
    "#60A5FA", // blue-400
    "#3B82F6", // blue-500
    "#2563EB", // blue-600
    "#F87171", // red-400
    "#DC2626", // red-600
    "#34D399", // green-400
    "#10B981", // green-500
    "#059669", // green-600
    "#FBBF24", // amber-400
    "#F59E0B", // amber-500
    "#A78BFA", // violet-400
    "#8B5CF6", // violet-500
    "#F472B6", // pink-400
    "#EC4899", // pink-500
    "#38BDF8", // sky-400
    "#0EA5E9", // sky-500
    "#22D3EE", // cyan-400
    "#06B6D4", // cyan-500
    "#4ADE80", // lime-400
    "#84CC16", // lime-500
];

export default function getUserColor(userId) {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
}