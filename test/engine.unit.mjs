// Unit tests for the pure shared helpers extracted during Phase 1 dedup.
// These pin the behavior of code that used to be duplicated inline, so later
// phases can't silently change it.
import { movesLabel } from "../src/shared/format.js";
import {
  isStatIndexAlive,
  isLethalDamageAllocation,
  getInventoryCard,
  matchesActiveAbility,
} from "../src/shared/playerHelpers.js";
import { rotationsWithDoor } from "../src/shared/tileRotation.js";
import { getActionRollResult } from "../src/haunts/core/hauntBase.js";
import { shuffle } from "../src/tiles.js";
import { test, assert, report } from "./harness.mjs";

console.log("shared/format.movesLabel:");
test("pluralizes correctly", () => {
  assert(movesLabel(0) === "0 moves", movesLabel(0));
  assert(movesLabel(1) === "1 move", movesLabel(1));
  assert(movesLabel(3) === "3 moves", movesLabel(3));
});

console.log("\nshared/playerHelpers.isStatIndexAlive:");
test("alive iff every track index > 0", () => {
  assert(isStatIndexAlive({ speed: 3, might: 2, knowledge: 1, sanity: 4 }) === true, "all>0");
  assert(isStatIndexAlive({ speed: 0, might: 2, knowledge: 1, sanity: 4 }) === false, "one=0");
});

console.log("\nshared/playerHelpers.isLethalDamageAllocation:");
test("detects lethal allocations, ignores increases", () => {
  const player = { statIndex: { speed: 1, might: 3, knowledge: 2, sanity: 2 } };
  assert(
    isLethalDamageAllocation(player, { adjustmentMode: "decrease", allocation: { speed: 1 } }) === true,
    "speed 1 - 1 = 0 is lethal"
  );
  assert(
    isLethalDamageAllocation(player, { adjustmentMode: "decrease", allocation: { might: 1 } }) === false,
    "might 3 - 1 = 2 is safe"
  );
  assert(
    isLethalDamageAllocation(player, { adjustmentMode: "increase", allocation: { speed: 5 } }) === false,
    "increases are never lethal"
  );
});

console.log("\nshared/playerHelpers.getInventoryCard:");
test("resolves the referenced inventory card, else null", () => {
  const card = { id: "revolver" };
  const game = { players: [{ inventory: [card] }] };
  const viewed = { ownerCollection: "inventory", ownerIndex: 0, ownerCardIndex: 0 };
  assert(getInventoryCard(game, viewed) === card, "returns the card");
  assert(getInventoryCard(game, { ...viewed, ownerCollection: "omens" }) === null, "non-inventory → null");
  assert(getInventoryCard(game, { ...viewed, ownerCardIndex: 9 }) === null, "missing index → null");
});

console.log("\nshared/playerHelpers.matchesActiveAbility:");
test("matches only the right action + collection on a real card", () => {
  const card = { activeAbilityRule: { action: "reroll-one-die" }, ownerCollection: "inventory" };
  assert(matchesActiveAbility(card, "reroll-one-die", "inventory") === true, "exact match");
  assert(matchesActiveAbility(card, "reroll-all-trait-dice", "inventory") === false, "wrong action");
  assert(matchesActiveAbility(card, "reroll-one-die", "omens") === false, "wrong collection");
  assert(matchesActiveAbility(null, "reroll-one-die", "inventory") === false, "no card");
  assert(matchesActiveAbility({}, "reroll-one-die", "inventory") === false, "no ability rule");
});

console.log("\nshared/tileRotation.rotationsWithDoor:");
test("finds rotations whose doors include the needed door", () => {
  // A dead-end tile with a single north door.
  const single = rotationsWithDoor(["N"], "S");
  assert(single.length === 1, `single-door tile has exactly one rotation facing S, got ${single.length}`);
  assert(single[0].includes("S"), "the winning rotation faces S");

  // A straight hallway (N+S) can satisfy a needed door on any axis it spans.
  const straight = rotationsWithDoor(["N", "S"], "E");
  assert(straight.length === 2, `N+S tile rotates to face E in two orientations, got ${straight.length}`);

  // A four-door tile always includes every needed door, in all 4 rotations.
  const cross = rotationsWithDoor(["N", "E", "S", "W"], "W");
  assert(cross.length === 4, `four-door tile matches in all rotations, got ${cross.length}`);
});

console.log("\nhauntBase.getActionRollResult:");
test("computes effectiveTotal = roll + bonus and success vs threshold", () => {
  const pass = getActionRollResult({ hauntActionRoll: { actionId: "escape", stat: "knowledge", bonus: 2, threshold: 6, lastRoll: { total: 5 } } });
  assert(pass.effectiveTotal === 7, `5 + 2 = 7, got ${pass.effectiveTotal}`);
  assert(pass.success === true, "7 >= 6 succeeds");

  const fail = getActionRollResult({ hauntActionRoll: { actionId: "escape", stat: "knowledge", bonus: 0, threshold: 6, lastRoll: { total: 3 } } });
  assert(fail.effectiveTotal === 3 && fail.success === false, "3 < 6 fails");

  assert(getActionRollResult({}) === null, "no roll -> null");
});

console.log("\ntiles.shuffle (Fisher-Yates):");
test("returns a same-length permutation and leaves the input unchanged", () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8];
  const snapshot = [...input];
  const out = shuffle(input);
  assert(out.length === input.length, "same length");
  assert(JSON.stringify([...out].sort((a, b) => a - b)) === JSON.stringify(snapshot), "same multiset of elements");
  assert(JSON.stringify(input) === JSON.stringify(snapshot), "input array not mutated");
  assert(out !== input, "returns a new array");
});

report();
