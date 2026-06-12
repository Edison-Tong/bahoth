import { backtrackPlayerState, changeFloorState, exploreState, movePlayerState } from "./playerMovementState";
import { resolveHauntAfterMovementState } from "../haunts/hauntDomain";

/* [MOVEMENT] Moves the current player one step, optionally rolling the Skeleton Key die. After moving, runs haunt post-movement hooks. */
export function resolveMovePlayerActionState(
  g,
  { nx, ny, cost, useSkeletonKey = false, rollDice, getLeaveMoveCost, canUseArmedSkeletonKeyMovement }
) {
  const skeletonKeyRoll = useSkeletonKey ? rollDice(1)[0] : null;
  const movedGame = movePlayerState(g, {
    nx,
    ny,
    cost,
    useSkeletonKey,
    skeletonKeyRoll,
    getLeaveMoveCost,
    canUseArmedSkeletonKeyMovement,
  });
  const game = resolveHauntAfterMovementState(g, movedGame);

  if (useSkeletonKey && skeletonKeyRoll !== null) {
    return {
      game,
      cameraFloor: null,
      diceAnimation: {
        purpose: "skeleton-key",
        final: [skeletonKeyRoll],
        display: [Math.floor(Math.random() * 3)],
        settled: false,
        tileName: "Skeleton Key",
      },
    };
  }

  return { game, cameraFloor: null, diceAnimation: null };
}

/* [MOVEMENT] Undoes the last move step and refunds the movement cost. Called by GameBoard handleBacktrack. */
export function resolveBacktrackActionState(g) {
  const game = resolveHauntAfterMovementState(g, backtrackPlayerState(g));
  const player = game.players[game.currentPlayerIndex];
  return {
    game,
    cameraFloor: player.floor,
    diceAnimation: null,
  };
}

/* [MOVEMENT] [TILE-PLACEMENT] Initiates tile exploration: places the player on an undiscovered position and enters the rotate phase. */
export function resolveExploreActionState(g, { dir, nx, ny, cost, OPPOSITE, getLeaveMoveCost }) {
  const exploredGame = exploreState(g, {
    dir,
    nx,
    ny,
    cost,
    OPPOSITE,
    getLeaveMoveCost,
  });
  return {
    game: resolveHauntAfterMovementState(g, exploredGame),
    cameraFloor: null,
    diceAnimation: null,
  };
}

/* [MOVEMENT] Dispatcher for board click or arrow-key moves: routes to backtrack, wall-move, normal move, or explore. */
export function resolveBoardMoveActionState(
  g,
  move,
  { rollDice, OPPOSITE, getLeaveMoveCost, canUseArmedSkeletonKeyMovement }
) {
  if (!move) {
    return { game: g, cameraFloor: null, diceAnimation: null };
  }

  if (move.type === "backtrack") {
    return resolveBacktrackActionState(g);
  }

  if (move.type === "wall-move") {
    return resolveMovePlayerActionState(g, {
      nx: move.x,
      ny: move.y,
      cost: move.cost,
      useSkeletonKey: true,
      rollDice,
      getLeaveMoveCost,
      canUseArmedSkeletonKeyMovement,
    });
  }

  if (move.type === "move") {
    return resolveMovePlayerActionState(g, {
      nx: move.x,
      ny: move.y,
      cost: move.cost,
      rollDice,
      getLeaveMoveCost,
      canUseArmedSkeletonKeyMovement,
    });
  }

  return resolveExploreActionState(g, {
    dir: move.dir,
    nx: move.x,
    ny: move.y,
    cost: move.cost,
    OPPOSITE,
    getLeaveMoveCost,
  });
}

/* [MOVEMENT] Uses the stair/connected-tile link to move the player to another floor. */
export function resolveChangeFloorActionState(g, { getConnectedMoveTarget, getLeaveMoveCost }) {
  const resolved = changeFloorState(g, {
    getConnectedMoveTarget,
    getLeaveMoveCost,
  });
  const nextGame = resolveHauntAfterMovementState(g, resolved.game);

  return {
    game: nextGame,
    cameraFloor: resolved.cameraFloor,
    diceAnimation: null,
  };
}
