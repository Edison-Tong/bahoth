import { getValidMovesState } from "./playerMovementState";

export function resolveKeyboardMoveAction({
  game,
  cameraFloor,
  currentPlayer,
  key,
  DIR,
  OPPOSITE,
  getTileAt,
  getLeaveMoveCost,
  canUseArmedSkeletonKeyMovement,
  isItemAbilityTileChoiceAwaiting,
  dogTradeState,
}) {
  if (dogTradeState) return null;
  if (isItemAbilityTileChoiceAwaiting(game.eventState)) {
    return null;
  }

  if (game.turnPhase === "rotate") {
    if (key === "r" || key === "R" || key === "ArrowRight") {
      return { type: "rotate", direction: 1 };
    }
    if (key === "e" || key === "E" || key === "ArrowLeft") {
      return { type: "rotate", direction: -1 };
    }
    if (key === "Enter") {
      return { type: "place-tile" };
    }
    return null;
  }

  if (game.turnPhase !== "move") return null;
  if (cameraFloor !== currentPlayer.floor) return null;

  const keyToDir = {
    ArrowUp: "N",
    ArrowDown: "S",
    ArrowRight: "E",
    ArrowLeft: "W",
  };
  const dir = keyToDir[key];
  if (!dir) return null;

  const validMoves = getValidMovesState({
    game,
    currentPlayer,
    DIR,
    OPPOSITE,
    getTileAt,
    getLeaveMoveCost,
    canUseArmedSkeletonKeyMovement,
    isItemAbilityTileChoiceAwaiting,
  });
  const move = validMoves.find((candidate) => candidate.dir === dir);
  if (!move) return null;

  if (move.type === "backtrack") {
    return { type: "backtrack" };
  }

  if (move.type === "move" || move.type === "wall-move") {
    return {
      type: "move",
      nx: move.x,
      ny: move.y,
      cost: move.cost,
      useSkeletonKey: move.type === "wall-move",
    };
  }

  if (move.type === "explore") {
    return {
      type: "explore",
      dir: move.dir,
      nx: move.x,
      ny: move.y,
      cost: move.cost,
    };
  }

  return null;
}
