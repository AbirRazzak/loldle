// The channel's daily leaderboard, polled by the game while it's open. Requires a logged-in player.
import { readBoard } from "./_board.js";
import { currentUser, isSnowflake } from "./_discord.js";

export async function POST(request) {
  const { access_token, channelId, puzzle } = await request.json().catch(() => ({}));
  if (!isSnowflake(channelId) || !Number.isInteger(puzzle)) return Response.json({ error: "bad request" }, { status: 400 });
  if (!(await currentUser(access_token))) return Response.json({ error: "not logged in" }, { status: 401 });
  return Response.json({ board: await readBoard(channelId, puzzle) });
}
