// Called by the game after each guess: updates the player's live card in the channel.
import { APP_ID, cardKey, cardMessage, cards, discord } from "./_discord.js";

const ROW = /^(?:🟩|🟨|🟥|⬆️|⬇️){7}$/u;

export async function POST(request) {
  const { access_token, channelId, puzzle, rows, solved } = await request.json().catch(() => ({}));
  if (typeof access_token !== "string" || !/^\d{17,20}$/.test(String(channelId)) || !Number.isInteger(puzzle) ||
      !Array.isArray(rows) || rows.length > 200 || !rows.every((r) => typeof r === "string" && ROW.test(r))) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }

  // Who is this? Only the player's own token can update their own card.
  const me = await discord("/users/@me", { headers: { Authorization: `Bearer ${access_token}` } });
  if (!me.ok) return Response.json({ error: "not logged in" }, { status: 401 });
  const user = await me.json();

  const card = await cards.get(cardKey(user.id, channelId));
  if (!card) return Response.json({ error: "no live card" }, { status: 404 }); // launched another way, or older than 15 min

  const res = await discord(`/webhooks/${APP_ID}/${card.token}/messages/${card.messageId}`, {
    method: "PATCH",
    body: JSON.stringify(cardMessage(user, { puzzle, rows, solved: solved === true })),
  });
  return Response.json({ ok: res.ok }, { status: res.ok ? 200 : 502 });
}
