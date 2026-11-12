// Discord's Interactions Endpoint. Handles the Launch entry-point command and the card's "Play now!" button:
// both open the Activity and post that player's live card in the channel.
import { waitUntil } from "@vercel/functions";
import { APP_ID, CARD_TTL, cardKey, cardMessage, cards, discord, verifySignature } from "./_discord.js";

const PING = 1, COMMAND = 2, COMPONENT = 3;
const PRIMARY_ENTRY_POINT = 4;
const PONG = 1, LAUNCH_ACTIVITY = 12;

export async function POST(request) {
  const body = await request.text();
  if (!(await verifySignature(request, body))) return new Response("bad signature", { status: 401 });
  const interaction = JSON.parse(body);

  if (interaction.type === PING) return Response.json({ type: PONG });

  const launches =
    (interaction.type === COMMAND && interaction.data?.type === PRIMARY_ENTRY_POINT) ||
    (interaction.type === COMPONENT && interaction.data?.custom_id === "play");
  if (!launches) return Response.json({ error: "unhandled interaction" }, { status: 400 });

  waitUntil(postCard(interaction)); // runs after the launch response goes out
  return Response.json({ type: LAUNCH_ACTIVITY });
}

async function postCard(interaction) {
  const user = interaction.member?.user ?? interaction.user;
  const res = await discord(`/webhooks/${APP_ID}/${interaction.token}?wait=true`, {
    method: "POST",
    body: JSON.stringify(cardMessage(user)),
  });
  if (!res.ok) return;
  const message = await res.json();
  await cards.set(cardKey(user.id, interaction.channel_id ?? interaction.channel?.id), { token: interaction.token, messageId: message.id }, { ttl: CARD_TTL });
}
