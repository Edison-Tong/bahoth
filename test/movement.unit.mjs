// Movement/exploration coverage. This closes the gap that let a real bug slip
// earlier: exploreState uses rotationsWithDoor, but nothing drove that path, so
// a missing import (a ReferenceError at explore time) passed build + tests and
// was only caught by lint. These tests exercise it directly.
import { exploreState, getValidMovesState } from "../src/movement/playerMovementState.js";
import { getLeaveMoveCostState } from "../src/movement/movementSelectors.js";
import { canUseArmedSkeletonKeyMovement } from "../src/items/movementItemAbility.js";
import { isItemAbilityTileChoiceAwaiting } from "../src/events/eventActions.js";
import { DIR, OPPOSITE } from "../src/game/gameState.js";
import { makeGame } from "./harness.mjs";
import { test, assert, report } from "./harness.mjs";

// board lookup dep, exactly as GameBoard builds it
const tileAtOf = (game) => (x, y, floor) => game.board[floor]?.find((t) => t.x === x && t.y === y) || null;

console.log("exploreState (exercises rotationsWithDoor):");
test("entering an unknown room sets pendingExplore with computed rotations", () => {
  const game = makeGame({ players: 4 }); // player 0 at entrance (0,0,ground), movesLeft = speed
  const movesBefore = game.players[0].movesLeft;
  const next = exploreState(game, { dir: "E", nx: 1, ny: 0, cost: 1, OPPOSITE, getLeaveMoveCost: getLeaveMoveCostState });

  assert(next.pendingExplore, "pendingExplore created");
  assert(Array.isArray(next.pendingExplore.validRotations), "validRotations is an array (rotationsWithDoor ran)");
  assert(next.players[0].x === 1 && next.players[0].y === 0, "player moved onto the unknown position");
  assert(next.players[0].movesLeft === movesBefore - 1, "move cost deducted");
  assert(next.hasMovedThisTurn === true, "marked as moved this turn");
});

test("every computed rotation actually faces the entry door", () => {
  const game = makeGame({ players: 4 });
  const next = exploreState(game, { dir: "E", nx: 1, ny: 0, cost: 1, OPPOSITE, getLeaveMoveCost: getLeaveMoveCostState });
  const neededDoor = OPPOSITE["E"]; // "W"
  for (const rotation of next.pendingExplore.validRotations) {
    assert(rotation.includes(neededDoor), `rotation ${rotation} faces ${neededDoor}`);
  }
});

test("cannot explore without enough moves", () => {
  const game = makeGame({ players: 4 });
  const broke = { ...game, players: game.players.map((p, i) => (i === 0 ? { ...p, movesLeft: 0 } : p)) };
  const next = exploreState(broke, { dir: "E", nx: 1, ny: 0, cost: 1, OPPOSITE, getLeaveMoveCost: getLeaveMoveCostState });
  assert(next === broke, "returns the game unchanged when it can't afford the move");
});

console.log("\ngetValidMovesState:");
test("returns a list of legal moves in the move phase without throwing", () => {
  const game = makeGame({ players: 4 });
  const moves = getValidMovesState({
    game,
    currentPlayer: game.players[game.currentPlayerIndex],
    DIR,
    OPPOSITE,
    getTileAt: tileAtOf(game),
    getLeaveMoveCost: getLeaveMoveCostState,
    canUseArmedSkeletonKeyMovement,
    isItemAbilityTileChoiceAwaiting,
  });
  assert(Array.isArray(moves), "returns an array");
  assert(moves.length > 0, "entrance has at least one legal move/explore option");
  assert(moves.every((m) => typeof m.type === "string"), "each move has a type");
});

test("returns nothing outside the move phase", () => {
  const game = { ...makeGame({ players: 4 }), turnPhase: "rotate" };
  const moves = getValidMovesState({
    game,
    currentPlayer: game.players[game.currentPlayerIndex],
    DIR,
    OPPOSITE,
    getTileAt: tileAtOf(game),
    getLeaveMoveCost: getLeaveMoveCostState,
    canUseArmedSkeletonKeyMovement,
    isItemAbilityTileChoiceAwaiting,
  });
  assert(moves.length === 0, "no moves when turnPhase !== move");
});

report();
