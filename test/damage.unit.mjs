// Player stat/damage flow tests. applyStatChangeState and
// applyDamageAllocationState are the pure engine primitives behind every
// combat/event/haunt damage resolution, so pinning them protects a lot of
// downstream behavior headlessly (the combat *state machine* itself lives in
// GameBoard.jsx / React and is out of headless scope).
import { applyStatChangeState, applyDamageAllocationState } from "../src/players/playerState.js";
import { makeGame } from "./harness.mjs";
import { test, assert, report } from "./harness.mjs";

const P0 = 0;
const players = () => makeGame({ players: 4 }).players;

console.log("applyStatChangeState:");
test("decrement lowers the stat index by the amount", () => {
  const before = players()[P0].statIndex.speed;
  const next = applyStatChangeState(players(), P0, "speed", -1);
  assert(next[P0].statIndex.speed === before - 1, `speed ${before} -> ${next[P0].statIndex.speed}`);
});

test("reducing a stat to 0 marks the player dead", () => {
  const p = players();
  const might = p[P0].statIndex.might; // Sammy: 3
  const next = applyStatChangeState(p, P0, "might", -might);
  assert(next[P0].statIndex.might === 0, "might driven to 0");
  assert(next[P0].isAlive === false, "player is dead when a track hits 0");
});

test("preventDeath clamps the stat index at 1 and keeps the player alive", () => {
  const next = applyStatChangeState(players(), P0, "might", -99, { preventDeath: true });
  assert(next[P0].statIndex.might === 1, `might clamped to 1, got ${next[P0].statIndex.might}`);
  assert(next[P0].isAlive === true, "player stays alive with preventDeath");
});

test("gain clamps at the top of the track", () => {
  const p = players();
  const maxIndex = p[P0].character.speed.length - 1;
  const next = applyStatChangeState(p, P0, "speed", 99);
  assert(next[P0].statIndex.speed === maxIndex, `speed clamps at max index ${maxIndex}`);
});

test("only the targeted player is affected", () => {
  const p = players();
  const other = p[1].statIndex.speed;
  const next = applyStatChangeState(p, P0, "speed", -1);
  assert(next[1].statIndex.speed === other, "other players untouched");
});

console.log("\napplyDamageAllocationState:");
test("decrease mode applies the allocation across multiple stats", () => {
  const p = players();
  const might = p[P0].statIndex.might;
  const speed = p[P0].statIndex.speed;
  const next = applyDamageAllocationState(p, P0, { might: 1, speed: 1 }, "decrease");
  assert(next[P0].statIndex.might === might - 1, "might -1");
  assert(next[P0].statIndex.speed === speed - 1, "speed -1");
});

test("increase mode raises the allocated stats", () => {
  const p = players();
  const knowledge = p[P0].statIndex.knowledge;
  const next = applyDamageAllocationState(p, P0, { knowledge: 1 }, "increase");
  assert(next[P0].statIndex.knowledge === knowledge + 1, "knowledge +1");
});

test("a lethal allocation flips isAlive to false", () => {
  const p = players();
  const next = applyDamageAllocationState(p, P0, { might: p[P0].statIndex.might }, "decrease");
  assert(next[P0].statIndex.might === 0, "might zeroed");
  assert(next[P0].isAlive === false, "player dead");
});

report();
