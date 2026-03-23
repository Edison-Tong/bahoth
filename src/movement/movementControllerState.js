import { backtrackPlayerState, changeFloorState, exploreState, movePlayerState } from "./playerMovementState";

export function resolveMovePlayerActionState(
  g,
  { nx, ny, cost, useSkeletonKey = false, rollDice, getLeaveMoveCost, canUseArmedSkeletonKeyMovement }
) {
  const skeletonKeyRoll = useSkeletonKey ? rollDice(1)[0] : null;
  const game = movePlayerState(g, {
    nx,
    ny,
    cost,
    useSkeletonKey,
    skeletonKeyRoll,
    getLeaveMoveCost,
    canUseArmedSkeletonKeyMovement,
  });

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

export function resolveBacktrackActionState(g) {
  const game = backtrackPlayerState(g);
  const player = game.players[game.currentPlayerIndex];
  return {
    game,
    cameraFloor: player.floor,
    diceAnimation: null,
  };
}

export function resolveExploreActionState(g, { dir, nx, ny, cost, OPPOSITE, getLeaveMoveCost }) {
  return {
    game: exploreState(g, {
      dir,
      nx,
      ny,
      cost,
      OPPOSITE,
      getLeaveMoveCost,
    }),
    cameraFloor: null,
    diceAnimation: null,
  };
}

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

export function resolveChangeFloorActionState(g, { getConnectedMoveTarget, getLeaveMoveCost }) {
  const resolved = changeFloorState(g, {
    getConnectedMoveTarget,
    getLeaveMoveCost,
  });

  return {
    game: resolved.game,
    cameraFloor: resolved.cameraFloor,
    diceAnimation: null,
  };
}
