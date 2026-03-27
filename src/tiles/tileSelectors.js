import { getConnectedMoveTarget, hasSecretPassageToken } from "./tileTraversal";

export function getCurrentPlayerTile(board, currentPlayer) {
  return board[currentPlayer.floor]?.find((tile) => tile.x === currentPlayer.x && tile.y === currentPlayer.y) || null;
}

export function getCanUseMysticElevator({ game, currentTile, isItemAbilityTileChoiceActive, diceAnimation }) {
  return (
    game.turnPhase === "move" &&
    !game.pendingExplore &&
    !game.pendingSpecialPlacement &&
    !game.tileEffect &&
    !isItemAbilityTileChoiceActive &&
    !game.drawnCard &&
    !diceAnimation &&
    currentTile?.id === "mystic-elevator" &&
    !game.mysticElevatorUsed
  );
}

export function getSecretPassageTargets({ game, currentPlayer, isItemAbilityTileChoiceActive }) {
  if (
    game.turnPhase !== "move" ||
    game.pendingExplore ||
    game.pendingSpecialPlacement ||
    game.tileEffect ||
    isItemAbilityTileChoiceActive
  ) {
    return [];
  }

  return Object.entries(game.board)
    .flatMap(([floor, tiles]) =>
      tiles
        .filter((tile) => hasSecretPassageToken(tile))
        .map((tile) => ({
          floor,
          x: tile.x,
          y: tile.y,
          name: tile.name,
        }))
    )
    .filter(
      (tile) => !(tile.floor === currentPlayer.floor && tile.x === currentPlayer.x && tile.y === currentPlayer.y)
    );
}

export function getCanUseSecretPassage(currentTile, secretPassageTargets) {
  return hasSecretPassageToken(currentTile) && secretPassageTargets.length > 0;
}

export function getStairTargetState({
  game,
  currentPlayer,
  currentTile,
  isItemAbilityTileChoiceActive,
  getLeaveMoveCost,
}) {
  if (game.turnPhase !== "move" || game.pendingExplore || isItemAbilityTileChoiceActive) {
    return { target: null, isBacktrack: false };
  }

  const connectedMove = getConnectedMoveTarget(game.board, currentTile, game.movePath);
  if (!connectedMove) {
    return { target: null, isBacktrack: false };
  }

  const moveCost = getLeaveMoveCost(currentTile);
  if (currentPlayer.movesLeft >= moveCost || connectedMove.isBacktrack) {
    return {
      target: connectedMove.targetTile,
      isBacktrack: connectedMove.isBacktrack,
    };
  }

  return { target: null, isBacktrack: false };
}
