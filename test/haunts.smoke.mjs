// Phase 0 smoke test: proves the harness can drive the real engine into every
// implemented haunt and that setup produces a coherent active-haunt state.
// This is the baseline safety net — later refactors must keep these green.
import {
  makeGame,
  forceHaunt,
  getAllHauntDefinitions,
  getHauntRuntimeHooksById,
  test,
  assert,
  report,
} from "./harness.mjs";

const GAME_PHASES = { PRE_HAUNT: "preHaunt", HAUNT_ACTIVE: "hauntActive" };
const IMPLEMENTED = ["haunt_1", "haunt_18", "haunt_28", "haunt_47"];

console.log("Engine / exploration phase:");
test("initGameState builds a coherent pre-haunt game", () => {
  const game = makeGame({ players: 4 });
  assert(game.players.length === 4, "expected 4 players");
  assert(game.gamePhase === GAME_PHASES.PRE_HAUNT, `expected preHaunt, got ${game.gamePhase}`);
  assert(game.board.ground.length === 3, "expected 3 starting ground tiles");
  assert(game.players[0].movesLeft > 0, "first player should have moves");
  assert(
    game.players.every((p) => p.isAlive && p.inventory.length === 0),
    "players should start alive with empty inventory"
  );
  assert(game.tileStack.length > 0 && game.eventDeck.length > 0, "decks should be populated");
});

console.log("\nRegistry:");
test("all implemented haunts are registered with definitions + runtime hooks", () => {
  const defIds = new Set(getAllHauntDefinitions().map((d) => d.id));
  for (const id of IMPLEMENTED) {
    assert(defIds.has(id), `definition missing for ${id}`);
    assert(getHauntRuntimeHooksById(id) != null, `runtime hooks missing for ${id}`);
  }
});

console.log("\nHaunt setup → active (per implemented haunt):");
for (const id of IMPLEMENTED) {
  test(`${id}: forces into an active haunt without throwing`, () => {
    const game = forceHaunt(id, { players: 4, traitorPlayerIndex: 0 });

    assert(game.gamePhase === GAME_PHASES.HAUNT_ACTIVE, `${id} not active: ${game.gamePhase}`);
    assert(game.activeHauntId === id, `${id} activeHauntId mismatch: ${game.activeHauntId}`);
    assert(game.hauntState?.status === "active", `${id} hauntState not active`);

    const traitor = game.hauntState.teams.traitor.playerIndexes;
    const heroes = game.hauntState.teams.heroes.playerIndexes;
    assert(traitor.length === 1 && traitor[0] === 0, `${id} traitor should be player 0`);
    assert(heroes.length === 3, `${id} expected 3 heroes, got ${heroes.length}`);
    assert(!heroes.includes(0), `${id} traitor leaked into heroes`);

    // First turn belongs to a living player. Most haunts open on a hero (who
    // has moves); some (e.g. haunt_18 Ring of Illusions) open on the hidden
    // traitor, who legitimately starts with 0 moves — so the moves invariant
    // only applies when the opener is a hero.
    const cur = game.players[game.currentPlayerIndex];
    assert(cur.isAlive, `${id} current player should be alive`);
    if (heroes.includes(game.currentPlayerIndex)) {
      assert(cur.movesLeft > 0, `${id} opening hero should have moves`);
    }
    assert(game.turnPhase === "move", `${id} should open in move phase`);
  });
}

console.log("\nHaunt hooks smoke (no-throw across common read hooks):");
for (const id of IMPLEMENTED) {
  test(`${id}: read-only hooks execute without throwing`, () => {
    const game = forceHaunt(id, { players: 4, traitorPlayerIndex: 0 });
    const hooks = getHauntRuntimeHooksById(id) || {};
    const ctx = {};

    // These are the pure "getter" hooks the UI calls every render; none should throw.
    hooks.getActionButtonsState?.(game, ctx);
    hooks.getActionAvailabilityState?.(game, ctx);
    hooks.getMonsterCardState?.(game);
    hooks.getBoardRenderState?.(game);
    for (let i = 0; i < game.players.length; i++) {
      hooks.getPlayerHauntTokensState?.(game, i);
    }
    hooks.getTileTokenLabelsState?.(game, { x: 0, y: 0, floor: "ground" });
    assert(true, "hooks ran");
  });
}

report();
