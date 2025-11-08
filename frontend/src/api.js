export const API = "http://localhost:3000/api";

export async function createUser(name) {
  const res = await fetch(`${API}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

export async function getRooms() {
  const res = await fetch(`${API}/rooms`);
  return res.json();
}

export async function createRoom(name, ownerId) {
  const res = await fetch(`${API}/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, ownerId }),
  });
  return res.json();
}

export async function joinRoom(id, userId) {
  const res = await fetch(`${API}/rooms/${id}/join`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  return res.json();
}

export async function leaveRoom(id, userId) {
  const res = await fetch(`${API}/rooms/${id}/leave`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  return res.json();
}

export async function deleteRoom(id, userId) {
  const res = await fetch(`${API}/rooms/${id}?userId=${userId}`, {
    method: "DELETE",
  });
  return res.json();
}
