// One-off: make the Activity's "Launch" entry-point command call our Interactions Endpoint
// (handler 1 = APP_HANDLER) instead of Discord posting its default invite card.
// Run: node scripts/use-app-launch-handler.mjs   (asks for the client secret; nothing is saved)
import { createInterface } from "node:readline";

const CLIENT_ID = "1570280651322687529";
const API = "https://discord.com/api/v10";
const APP_HANDLER = 1, PRIMARY_ENTRY_POINT = 4;

function askHidden(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  rl._writeToOutput = (s) => { if (s.includes(question)) process.stdout.write(s); }; // don't echo the secret
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); process.stdout.write("\n"); resolve(a.trim()); }));
}

const secret = process.env.DISCORD_CLIENT_SECRET || (await askHidden("Discord client secret (hidden): "));
const tokenRes = await fetch(`${API}/oauth2/token`, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${secret}`).toString("base64")}`,
  },
  body: new URLSearchParams({ grant_type: "client_credentials", scope: "applications.commands.update" }),
});
if (!tokenRes.ok) throw new Error(`Couldn't get a token (${tokenRes.status}): check the secret`);
const auth = { Authorization: `Bearer ${(await tokenRes.json()).access_token}`, "Content-Type": "application/json" };

const commands = await (await fetch(`${API}/applications/${CLIENT_ID}/commands`, { headers: auth })).json();
const launch = commands.find((c) => c.type === PRIMARY_ENTRY_POINT);
if (!launch) throw new Error("No Launch entry-point command found. Is 'Enable Activities' on?");

const res = await fetch(`${API}/applications/${CLIENT_ID}/commands/${launch.id}`, {
  method: "PATCH",
  headers: auth,
  body: JSON.stringify({ handler: APP_HANDLER }),
});
const updated = await res.json();
if (!res.ok) throw new Error(`Update failed (${res.status}): ${JSON.stringify(updated)}`);
console.log(`Done: "${updated.name}" now uses handler ${updated.handler} (1 = app handles Launch).`);
