import { DiscordSDK, patchUrlMappings } from "@discord/embedded-app-sdk";
import { COLUMNS, compare, dailyChampion, dayNumber, shareText } from "./game.js";
import champions from "./champions.json";

const $ = (id) => document.getElementById(id);

// Inside Discord the page runs in a sandboxed iframe; outside it (plain browser) we skip the SDK.
let discordSdk = null;
if (new URLSearchParams(location.search).has("frame_id")) {
  // Requests outside the Activity's origin are blocked, so champion images go through the
  // /ddragon URL mapping set in the Developer Portal.
  patchUrlMappings([{ prefix: "/ddragon", target: "ddragon.leagueoflegends.com" }], { patchSrcAttributes: true });
  discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);
  discordSdk.ready()
    .then(() => { $("invite").hidden = false; })
    .catch((err) => console.error("Discord SDK handshake failed", err));
}

$("invite").addEventListener("click", () => {
  discordSdk.commands.openInviteDialog().catch((err) => console.error("Invite dialog failed", JSON.stringify(err)));
});

const guesses = (n) => `${n} ${n === 1 ? "guess" : "guesses"}`;
const store = {
  // per-viewer progress only; the page works without storage
  get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const byName = new Map(champions.map((c) => [c.name.toLowerCase(), c]));
const byId = new Map(champions.map((c) => [c.id, c]));
const today = dayNumber();
const answer = dailyChampion(champions, today);

let saved = store.get("progress");
if (!saved || saved.day !== today) saved = { day: today, guesses: [] };

for (const col of COLUMNS) $("head").insertAdjacentHTML("beforeend", `<th>${col.label}</th>`);

function cell(text, cls) {
  const td = document.createElement("td");
  td.className = cls;
  td.textContent = text;
  return td;
}

function addRow(champ, delayCells) {
  const tr = document.createElement("tr");
  const img = document.createElement("td");
  img.className = "champ";
  img.innerHTML = `<img alt="" src="${champ.image}" title="${champ.name}">`;
  img.querySelector("img").alt = champ.name;
  tr.append(img);
  compare(champ, answer).forEach((r, i) => {
    const value = champ[r.key];
    const td = cell(Array.isArray(value) ? value.join(", ") : value, r.result);
    if (r.hint) td.insertAdjacentHTML("beforeend", `<span class="arrow" aria-label="answer is ${r.hint === "higher" ? "newer" : "older"}">${r.hint === "higher" ? "↑" : "↓"}</span>`);
    if (delayCells) td.style.animationDelay = `${i * 0.12}s`;
    tr.append(td);
  });
  $("rows").prepend(tr);
}

function refreshList() {
  const guessed = new Set(saved.guesses);
  $("champ-list").innerHTML = champions
    .filter((c) => !guessed.has(c.id))
    .map((c) => `<option value="${c.name.replace(/"/g, "&quot;")}">`).join("");
}

function finish() {
  const n = saved.guesses.length;
  $("msg").textContent = `You got ${answer.name} in ${guesses(n)}! New champion tomorrow. Streak: ${store.get("stats")?.streak ?? 1}`;
  $("msg").className = "win";
  $("guess").disabled = $("submit").disabled = true;
  $("share-text").textContent = shareText(saved.guesses.map((id) => byId.get(id)).filter(Boolean), answer, today);
  $("result").hidden = false;
}

$("share").addEventListener("click", async () => {
  const text = $("share-text").textContent;
  try {
    if (discordSdk) {
      // Discord's own share dialog: the player picks where the result goes.
      const { didSendMessage, didCopyLink } = await discordSdk.commands.shareLink({ message: text });
      if (didSendMessage || didCopyLink) $("share").textContent = "Shared!";
    } else {
      await navigator.clipboard.writeText(text);
      $("share").textContent = "Copied!";
    }
  } catch (err) {
    console.error("Share failed", JSON.stringify(err) || String(err));
    getSelection().selectAllChildren($("share-text")); // let the player copy it by hand
    $("share").textContent = "Press Ctrl+C to copy";
  }
});

function recordWin() {
  const stats = store.get("stats") || { streak: 0, lastWin: null };
  stats.streak = stats.lastWin === today - 1 ? stats.streak + 1 : 1;
  stats.lastWin = today;
  store.set("stats", stats);
}

$("guess-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const champ = byName.get($("guess").value.trim().toLowerCase());
  if (!champ) { $("msg").textContent = "Pick a champion from the list."; return; }
  if (saved.guesses.includes(champ.id)) { $("msg").textContent = `You already guessed ${champ.name}.`; return; }
  saved.guesses.push(champ.id);
  store.set("progress", saved);
  $("guess").value = "";
  addRow(champ, true);
  refreshList();
  if (champ.id === answer.id) { recordWin(); finish(); }
  else $("msg").textContent = `${guesses(saved.guesses.length)} so far.`;
});

saved.guesses.map((id) => byId.get(id)).filter(Boolean).forEach((c) => addRow(c, false));
refreshList();
if (saved.guesses.includes(answer.id)) finish();
else {
  $("guess").disabled = $("submit").disabled = false;
  $("msg").textContent = saved.guesses.length ? `${guesses(saved.guesses.length)} so far.` : "";
  $("guess").focus();
}
