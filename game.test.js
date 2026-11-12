import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compareField, dailyChampion, dayNumber } from "./game.js";

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

console.log("all tests passed");
