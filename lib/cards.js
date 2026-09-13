import { getToken } from "./auth";
import { apiBase } from "./server";

// Convert a card name into the image filename slug, e.g. "Copper Golem" ->
// "Copper_Golem" (matches the files in /public/images/cards/{TYPE}/).
function cardImageSlug(name) {
  return String(name || "").trim().replace(/\s+/g, "_");
}

export function cardImageUrl(type, name) {
  return `/images/cards/${(type || "").toUpperCase()}/${cardImageSlug(name)}.webp`;
}

// Fetch the full card catalog from the backend and map it to the shape the
// Card component expects (uppercase keys, power null -> "?").
export async function fetchCards() {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${apiBase()}/cards`, { headers });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = data?.message
      ? Array.isArray(data.message)
        ? data.message.join(", ")
        : data.message
      : "Could not load cards.";
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  return (data || []).map((c) => ({
    id: c.id,
    Name: c.name,
    Power: c.power === null || c.power === undefined ? "?" : c.power,
    Type: c.type,
    Description: c.description,
    bgImage: cardImageUrl(c.type, c.name),
  }));
}
