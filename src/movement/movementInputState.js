export function resolveKeyboardMoveAction({
  game,
  cameraFloor,
  currentPlayer,
  key,
  DIR,
  OPPOSITE,
  getTileAt,
  getLeaveMoveCost,
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

  if (game.pendingExplore) {
    const path = game.movePath;
    if (path.length >= 2) {
      const prev = path[path.length - 2];
      const { dx, dy } = DIR[dir];
      const nx = currentPlayer.x + dx;
      const ny = currentPlayer.y + dy;
      if (prev.x === nx && prev.y === ny && prev.floor === currentPlayer.floor) {
        return { type: "backtrack" };
      }
    }
    return null;
  }

  const tile = getTileAt(currentPlayer.x, currentPlayer.y, currentPlayer.floor);
  if (!tile || !tile.doors.includes(dir)) return null;

  const { dx, dy } = DIR[dir];
  const nx = currentPlayer.x + dx;
  const ny = currentPlayer.y + dy;

  const path = game.movePath;
  if (path.length >= 2) {
    const prev = path[path.length - 2];
    if (prev.x === nx && prev.y === ny && prev.floor === currentPlayer.floor) {
      return { type: "backtrack" };
    }
  }

  const moveCost = getLeaveMoveCost(tile);
  if (currentPlayer.movesLeft < moveCost) return null;

  const neighbor = getTileAt(nx, ny, currentPlayer.floor);
  if (neighbor && neighbor.doors.includes(OPPOSITE[dir])) {
    return { type: "move", nx, ny, cost: moveCost };
  }
  if (!neighbor) {
    return { type: "explore", dir, nx, ny, cost: moveCost };
  }

  return null;
}
