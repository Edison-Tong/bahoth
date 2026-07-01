// Event effect-resolution tests. These drive the real applyResolvedEventEffect
// switch across effect types, pinning its behavior so the planned dispatch-map
// refactor (and any future event change) is provably behavior-preserving.
import { applyResolvedEventEffect } from "../src/events/eventEngine.js";
import { buildEventEngineDeps, makeEventGame } from "./eventHarness.mjs";
import { test, assert, report } from "./harness.mjs";

const deps = buildEventEngineDeps();
const P0 = 0; // makeGame starts with currentPlayerIndex 0

console.log("effect: stat-change");
test("lose reduces the target stat index by amount", () => {
  const game = makeEventGame();
  const before = game.players[P0].statIndex.speed;
  const { game: next } = applyResolvedEventEffect(game, { type: "stat-change", stat: "speed", mode: "lose", amount: 1 }, null, deps);
  assert(next.players[P0].statIndex.speed === before - 1, `speed ${before} -> ${next.players[P0].statIndex.speed}, expected -1`);
});

test("gain raises the target stat index by amount", () => {
  const game = makeEventGame();
  const before = game.players[P0].statIndex.knowledge;
  const { game: next } = applyResolvedEventEffect(game, { type: "stat-change", stat: "knowledge", mode: "gain", amount: 1 }, null, deps);
  assert(next.players[P0].statIndex.knowledge === before + 1, `knowledge ${before} -> ${next.players[P0].statIndex.knowledge}, expected +1`);
});

test("preHaunt lose cannot kill (clamps at index 1)", () => {
  // gamePhase is preHaunt by default → preventDeath applies.
  const game = makeEventGame();
  const { game: next } = applyResolvedEventEffect(game, { type: "stat-change", stat: "might", mode: "lose", amount: 99 }, null, deps);
  assert(next.players[P0].statIndex.might === 1, `might clamped to 1, got ${next.players[P0].statIndex.might}`);
  assert(next.players[P0].isAlive === true, "player stays alive in preHaunt");
});

test("heal restores a lowered stat back up to its starting index", () => {
  const game = makeEventGame();
  const start = game.players[P0].character.startIndex.knowledge;
  // Lower it first, then heal.
  const lowered = applyResolvedEventEffect(game, { type: "stat-change", stat: "knowledge", mode: "lose", amount: 1 }, null, deps).game;
  assert(lowered.players[P0].statIndex.knowledge === start - 1, "precondition: knowledge lowered");
  const healed = applyResolvedEventEffect(lowered, { type: "stat-change", stat: "knowledge", mode: "heal" }, null, deps).game;
  assert(healed.players[P0].statIndex.knowledge === start, `heal back to start ${start}, got ${healed.players[P0].statIndex.knowledge}`);
});

test("stat 'all' with mode lose lowers every track", () => {
  const game = makeEventGame();
  const before = { ...game.players[P0].statIndex };
  const { game: next } = applyResolvedEventEffect(game, { type: "stat-change", stat: "all", mode: "lose", amount: 1 }, null, deps);
  for (const stat of ["speed", "might", "knowledge", "sanity"]) {
    assert(next.players[P0].statIndex[stat] === before[stat] - 1, `${stat} dropped by 1`);
  }
});

console.log("\neffect: grant-bonus");
test("appends a blessing line to the event summary", () => {
  const game = makeEventGame();
  const { game: next } = applyResolvedEventEffect(game, { type: "grant-bonus" }, null, deps);
  assert(/blessing/i.test(next.eventState.summary), `summary mentions a blessing, got "${next.eventState.summary}"`);
});

console.log("\neffect: stat-choice (gain)");
test("opens a general-gain damageChoice over the offered stats", () => {
  const game = makeEventGame();
  const effect = { type: "stat-choice", mode: "gain", options: ["might", "speed"], amount: 1 };
  const { game: next } = applyResolvedEventEffect(game, effect, null, deps);
  const choice = next.damageChoice;
  assert(choice && choice.source === "event-stat-choice", "a stat-choice damageChoice is created");
  assert(choice.adjustmentMode === "increase", "gain uses increase mode");
  assert(JSON.stringify(choice.allowedStats) === JSON.stringify(["might", "speed"]), "allowed stats match the options");
  assert(next.eventState.awaiting === null, "awaiting cleared while the choice is open");
});

console.log("\neffect: draw-card (item deck)");
test("draws the top item card and shrinks the item deck", () => {
  const game = makeEventGame();
  const deckSizeBefore = game.itemDeck.length;
  const topName = game.itemDeck[0]?.name;
  const { game: next } = applyResolvedEventEffect(game, { type: "draw-card", deck: "item" }, null, deps);
  assert(next.itemDeck.length === deckSizeBefore - 1, "item deck shrank by 1");
  assert(next.drawnCard?.type === "item", "a drawn item card is set");
  assert(next.drawnCard?.name === topName, "drew the top card of the deck");
});

report();
