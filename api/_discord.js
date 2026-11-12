// Shared helpers for the live "X is playing" card. The leading underscore keeps Vercel from routing this file.
import { webcrypto } from "node:crypto";
import { getCache } from "@vercel/functions";

export const APP_ID = process.env.VITE_DISCORD_CLIENT_ID;
const API = "https://discord.com/api/v10";

// shortcut: Runtime Cache is per-region and evictable; fine because interaction tokens die after 15 minutes
// anyway and Hobby runs functions in one region. Move to Redis if cards must survive longer.
export const cards = getCache({ namespace: "champion-guess-cards" });
export const CARD_TTL = 14 * 60; // a little under Discord's 15-minute interaction token lifetime
export const cardKey = (userId, channelId) => `${userId}:${channelId}`;

/** Discord signs every interaction with Ed25519; reject anything that doesn't verify. */
export async function verifySignature(request, body) {
  const sig = request.headers.get("x-signature-ed25519");
  const ts = request.headers.get("x-signature-timestamp");
  if (!sig || !ts || !process.env.DISCORD_PUBLIC_KEY) return false;
  try {
    const key = await webcrypto.subtle.importKey("raw", Buffer.from(process.env.DISCORD_PUBLIC_KEY, "hex"), { name: "Ed25519" }, false, ["verify"]);
    return await webcrypto.subtle.verify("Ed25519", key, Buffer.from(sig, "hex"), new TextEncoder().encode(ts + body));
  } catch {
    return false;
  }
}

function avatarUrl(user) {
  return user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
    : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(user.id) >> 22n) % 6n)}.png`;
}

/** Spoiler-free card: colored rows only, newest five guesses. */
export function cardMessage(user, { puzzle, rows = [], solved = false } = {}) {
  const name = user.global_name || user.username;
  const n = rows.length;
  const status = solved ? `Solved in ${n} ${n === 1 ? "guess" : "guesses"}!` : n ? `${n} ${n === 1 ? "guess" : "guesses"} so far` : "No guesses yet";
  return {
    embeds: [{
      color: 0x2bb3a3,
      author: { name: `${name} is ${solved ? "done" : "playing"}`, icon_url: avatarUrl(user) },
      title: puzzle ? `Champion Guess #${puzzle}` : "Champion Guess",
      description: (n > 5 ? "…\n" : "") + (rows.slice(-5).join("\n") || "⬛⬛⬛⬛⬛⬛⬛"),
      thumbnail: { url: avatarUrl(user) },
      footer: { text: status },
    }],
    components: [{ type: 1, components: [{ type: 2, style: 1, label: "Play now!", custom_id: "play" }] }],
    allowed_mentions: { parse: [] },
  };
}

/** The Discord user behind an access token from the Activity's login, or null if it isn't valid. */
export async function currentUser(accessToken) {
  if (typeof accessToken !== "string") return null;
  const res = await discord("/users/@me", { headers: { Authorization: `Bearer ${accessToken}` } });
  return res.ok ? res.json() : null;
}

export const isSnowflake = (id) => /^\d{17,20}$/.test(String(id));

export async function discord(path, init = {}) {
  const res = await fetch(API + path, { ...init, headers: { "Content-Type": "application/json", ...init.headers } });
  if (!res.ok) console.error("Discord API", init.method || "GET", path.replace(/\/webhooks\/\d+\/[^/]+/, "/webhooks/…"), res.status, await res.text());
  return res;
}
