// Called by the game after each guess: records the player's score for the channel's daily
// leaderboard and updates their live card. Returns the channel's board.
import { recordScore, readBoard } from "./_board.js";
import { APP_ID, cardKey, cardMessage, cards, currentUser, discord, isSnowflake } from "./_discord.js";

const ROW = /^(?:🟩|🟨|🟥|⬆️|⬇️){7}$/u;

export async function POST(request) {
  const { access_token, channelId, puzzle, rows, solved } = await request.json().catch(() => ({}));
  if (!isSnowflake(channelId) || !Number.isInteger(puzzle) ||
      !Array.isArray(rows) || rows.length > 200 || !rows.every((r) => typeof r === "string" && ROW.test(r))) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }

  // Only the player's own token can record their score or update their card.
  const user = await currentUser(access_token);
  if (!user) return Response.json({ error: "not logged in" }, { status: 401 });

  await recordScore(channelId, puzzle, user, rows.length, solved === true);

  const card = await cards.get(cardKey(user.id, channelId)); // missing if launched another way or older than 15 min
  if (card) {
    await discord(`/webhooks/${APP_ID}/${card.token}/messages/${card.messageId}`, {
      method: "PATCH",
      body: JSON.stringify(cardMessage(user, { puzzle, rows, solved: solved === true })),
    });
  }
  return Response.json({ board: await readBoard(channelId, puzzle) });
}
