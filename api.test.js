// Self-check for the interactions endpoint: signature verification + card shape, with a throwaway keypair.
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";

const keys = await webcrypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
process.env.DISCORD_PUBLIC_KEY = Buffer.from(await webcrypto.subtle.exportKey("raw", keys.publicKey)).toString("hex");
process.env.VITE_DISCORD_CLIENT_ID = "1570280651322687529";

// Imported after the env is set, since the modules read it at load time.
const { POST } = await import("./api/interactions.js");
const { cardMessage } = await import("./api/_discord.js");

async function signed(body, tamper = false) {
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = Buffer.from(await webcrypto.subtle.sign("Ed25519", keys.privateKey, new TextEncoder().encode(ts + body))).toString("hex");
  return new Request("https://x/api/interactions", {
    method: "POST",
    headers: { "x-signature-ed25519": sig, "x-signature-timestamp": ts },
    body: tamper ? body.replace("1", "2") : body,
  });
}

const ping = JSON.stringify({ type: 1 });
assert.deepEqual(await (await POST(await signed(ping))).json(), { type: 1 });
assert.equal((await POST(await signed(ping, true))).status, 401);
assert.equal((await POST(new Request("https://x", { method: "POST", body: ping }))).status, 401);

const user = { id: "123456789012345678", username: "abir", global_name: "Abir", avatar: null };
const rows = ["🟥🟨🟥🟥🟥🟥🟩", "🟩🟨🟥🟥🟩🟥⬆️", "🟥🟥🟥🟥🟥🟥⬇️", "🟥🟥🟥🟥🟥🟥⬇️", "🟥🟥🟥🟥🟥🟥⬇️", "🟩🟩🟩🟩🟩🟩🟩"];
const card = cardMessage(user, { puzzle: 2, rows, solved: true }).embeds[0];
assert.equal(card.author.name, "Abir is done");
assert.equal(card.footer.text, "Solved in 6 guesses!");
assert.equal(card.description.split("\n").length, 6); // "…" + newest 5
assert.ok(card.description.endsWith("🟩🟩🟩🟩🟩🟩🟩"));
assert.equal(cardMessage(user).embeds[0].footer.text, "No guesses yet");
const { mergeScore } = await import("./api/_board.js");
assert.deepEqual(mergeScore(null, user, 2, false), { name: "Abir", avatar: null, guesses: 2, solved: false });
assert.equal(mergeScore({ guesses: 4, solved: true }, user, 2, true), null); // finished games are final
assert.equal(mergeScore({ guesses: 5, solved: false }, user, 2, true).guesses, 5); // restarting can't lower the count

console.log("api checks passed");
