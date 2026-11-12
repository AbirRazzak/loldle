// Pure game logic: no DOM here, so `node game.test.js` can check it.

export const COLUMNS = [
  { key: "gender", label: "Gender" },
  { key: "positions", label: "Position(s)" },
  { key: "species", label: "Species" },
  { key: "resource", label: "Resource" },
  { key: "range", label: "Range" },
  { key: "regions", label: "Region(s)" },
  { key: "releaseYear", label: "Release year" },
];

const asList = (v) => (Array.isArray(v) ? v : [v]);

/** "correct" | "partial" | "wrong", plus "higher"/"lower" hint for the year. */
export function compareField(key, guess, answer) {
  if (key === "releaseYear") {
    if (guess === answer) return { result: "correct" };
    return { result: "wrong", hint: answer > guess ? "higher" : "lower" };
  }
  const g = asList(guess), a = asList(answer);
  const shared = g.filter((x) => a.includes(x)).length;
  if (shared === g.length && shared === a.length) return { result: "correct" };
  return { result: shared ? "partial" : "wrong" };
}

export function compare(guess, answer) {
  return COLUMNS.map(({ key }) => ({ key, ...compareField(key, guess[key], answer[key]) }));
}

const EMOJI = { correct: "🟩", partial: "🟨", wrong: "🟥", higher: "⬆️", lower: "⬇️" };
const FIRST_DAY = 20768; // 2026-11-11, the day this game launched, is puzzle #1

/** One spoiler-free emoji row per guess, oldest first. */
export function resultRows(guesses, answer) {
  return guesses.map((g) => compare(g, answer).map((r) => EMOJI[r.hint ?? r.result]).join(""));
}

export const puzzleNumber = (day = dayNumber()) => day - FIRST_DAY + 1;

/** Wordle-style share text. */
export function shareText(guesses, answer, day = dayNumber()) {
  const n = guesses.length;
  return `Champion Guess #${puzzleNumber(day)}: ${n} ${n === 1 ? "guess" : "guesses"}\n${resultRows(guesses, answer).join("\n")}`;
}

/** Local calendar day as a number, so everyone gets a new champion at their midnight. */
export function dayNumber(date = new Date()) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

/** Same champion for everyone on a given day; hashed so days don't walk alphabetically. */
export function dailyChampion(champions, day = dayNumber()) {
  // shortcut: adding a champion reshuffles future answers; store a fixed schedule if that matters
  let h = (day ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return champions[h % champions.length];
}

/**
 * Daily channel leaderboard. Solvers rank by fewest guesses (ties share a rank, 1-1-3 style) and
 * everyone tied for fewest wins; players still going come after, unranked.
 */
export function rankBoard(entries) {
  const solved = entries.filter((e) => e.solved).sort((a, b) => a.guesses - b.guesses);
  const playing = entries.filter((e) => !e.solved).sort((a, b) => a.guesses - b.guesses);
  const best = solved[0]?.guesses;
  return [
    ...solved.map((e) => ({ ...e, rank: solved.findIndex((s) => s.guesses === e.guesses) + 1, winner: e.guesses === best })),
    ...playing.map((e) => ({ ...e, rank: null, winner: false })),
  ];
}
