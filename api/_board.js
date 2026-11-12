// Daily per-channel scores in Upstash Redis: one hash per channel per puzzle, one field per player.
import { Redis } from "@upstash/redis";

// Vercel's Upstash integration names the variables KV_* (older stores) or UPSTASH_REDIS_* (newer ones).
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN,
});
const KEEP_DAYS = 8;
const boardKey = (channelId, puzzle) => `board:${channelId}:${puzzle}`;

/**
 * The entry to store, or null to keep the old one. A finished game is final and the count never
 * goes down, so clearing local storage and replaying can't improve a score.
 */
export function mergeScore(prev, user, guesses, solved) {
  if (prev?.solved) return null;
  return { name: user.global_name || user.username, avatar: user.avatar, guesses: Math.max(guesses, prev?.guesses ?? 0), solved };
}

export async function recordScore(channelId, puzzle, user, guesses, solved) {
  const key = boardKey(channelId, puzzle);
  const entry = mergeScore(await redis.hget(key, user.id), user, guesses, solved);
  if (!entry) return;
  await redis.hset(key, { [user.id]: entry });
  await redis.expire(key, KEEP_DAYS * 86400);
}

export async function readBoard(channelId, puzzle) {
  const all = (await redis.hgetall(boardKey(channelId, puzzle))) ?? {};
  return Object.entries(all).map(([id, e]) => ({ id, ...e }));
}
