import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compareField, dailyChampion, dayNumber, rankBoard, shareText } from "./game.js";

assert.deepEqual(compareField("gender", "Male", "Male"), { result: "correct" });
assert.deepEqual(compareField("gender", "Male", "Female"), { result: "wrong" });
assert.deepEqual(compareField("positions", ["Top", "Jungle"], ["Jungle", "Top"]), { result: "correct" });
assert.deepEqual(compareField("positions", ["Top"], ["Top", "Jungle"]), { result: "partial" });
assert.deepEqual(compareField("positions", ["Top", "Middle"], ["Top"]), { result: "partial" });
assert.deepEqual(compareField("regions", ["Ionia"], ["Noxus"]), { result: "wrong" });
assert.deepEqual(compareField("releaseYear", 2011, 2011), { result: "correct" });
assert.deepEqual(compareField("releaseYear", 2011, 2015), { result: "wrong", hint: "higher" });
assert.deepEqual(compareField("releaseYear", 2015, 2011), { result: "wrong", hint: "lower" });

const champs = JSON.parse(readFileSync(new URL("./champions.json", import.meta.url), "utf8"));
const day = dayNumber(new Date(2026, 10, 11));
assert.equal(dailyChampion(champs, day), dailyChampion(champs, day));
const week = new Set(Array.from({ length: 30 }, (_, i) => dailyChampion(champs, day + i).id));
assert.ok(week.size > 20, "daily picks should vary");

const byId = Object.fromEntries(champs.map((c) => [c.id, c]));
const launch = dayNumber(new Date(2026, 10, 11));
assert.equal(
  shareText([byId.Ahri, byId.Rumble], byId.Rumble, launch),
  "Champion Guess #1: 2 guesses\n🟥🟨🟥🟥🟥🟥🟩\n🟩🟩🟩🟩🟩🟩🟩",
);
assert.match(shareText([byId.Garen], byId.Rumble, launch + 1), /^Champion Guess #2: 1 guess\n.*⬆️$/);

const board = rankBoard([
  { id: "a", guesses: 5, solved: true },
  { id: "b", guesses: 3, solved: true },
  { id: "c", guesses: 2, solved: false },
  { id: "d", guesses: 3, solved: true },
  { id: "e", guesses: 7, solved: true },
]);
assert.deepEqual(board.map((e) => [e.id, e.rank, e.winner]), [
  ["b", 1, true], ["d", 1, true], ["a", 3, false], ["e", 4, false], ["c", null, false],
]);
assert.deepEqual(rankBoard([{ id: "x", guesses: 4, solved: false }]).map((e) => e.winner), [false]); // nobody solved: no winner

console.log("all tests passed");
