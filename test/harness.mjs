// Headless harness: drives the real engine (no React) so refactors can be
// verified for behavioral parity. Imports the actual state functions the app
// uses, then exposes small helpers to build a game and force any haunt.
import { CHARACTERS } from "../src/characters.js";
import { initGameState } from "../src/game/gameState.js";
import {
  startSelectedHauntState,
  completeHauntSetupState,
} from "../src/haunts/core/hauntRuntime.js";
import {
  getHauntDefinitionById,
  getAllHauntDefinitions,
  getHauntRuntimeHooksById,
} from "../src/haunts/registry.js";

/** Build `count` players from the canonical character list. */
export function makePlayers(count = 4) {
  return Array.from({ length: count }, (_, i) => ({
    name: `P${i + 1}`,
    character: CHARACTERS[i % CHARACTERS.length],
  }));
}

/** Fresh game in the pre-haunt (exploration) phase. */
export function makeGame({ players = 4, selectedScenarioCardId = null } = {}) {
  const roster = typeof players === "number" ? makePlayers(players) : players;
  return initGameState(roster, { selectedScenarioCardId });
}

/**
 * Drive a game all the way into an ACTIVE haunt: init → HAUNT_SETUP →
 * complete setup (which runs onHauntBegin). Returns the active-haunt game.
 */
export function forceHaunt(hauntId, { players = 4, traitorPlayerIndex = 0 } = {}) {
  const hauntDefinition = getHauntDefinitionById(hauntId);
  if (!hauntDefinition) throw new Error(`No haunt definition registered for "${hauntId}"`);

  let game = makeGame({ players });
  game = startSelectedHauntState(game, { hauntDefinition, traitorPlayerIndex });
  game = completeHauntSetupState(game, { getHauntDefinitionById });
  return game;
}

export { getAllHauntDefinitions, getHauntRuntimeHooksById, getHauntDefinitionById };

// ---- tiny assertion + test-runner scaffolding -----------------------------

let passed = 0;
let failed = 0;
const failures = [];

export function assert(cond, message) {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(message);
  }
}

export function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    failures.push(`${name}: ${err.message}`);
    console.log(`  ✗ ${name} — ${err.message}`);
  }
}

export function report() {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
}
