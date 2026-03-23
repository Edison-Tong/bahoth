export function getConnectedMoveTarget(board, currentTile, path) {
  if (!currentTile) return null;

  const prev = path.length >= 2 ? path[path.length - 2] : null;

  if (currentTile.connectsTo) {
    for (const floor of ["ground", "upper", "basement"]) {
      const found = board[floor]?.find((tile) => tile.id === currentTile.connectsTo);
      if (found) {
        return {
          targetTile: found,
          targetFloor: floor,
          isBacktrack: Boolean(prev && prev.x === found.x && prev.y === found.y && prev.floor === floor),
        };
      }
    }
  }

  if (prev) {
    const previousTile = board[prev.floor]?.find((tile) => tile.x === prev.x && tile.y === prev.y);
    if (previousTile?.connectsTo === currentTile.id) {
      return {
        targetTile: previousTile,
        targetFloor: prev.floor,
        isBacktrack: true,
      };
    }
  }

  return null;
}

export function hasSecretPassageToken(tile) {
  return (tile?.tokens || []).some((token) => token.type === "secret-passage");
}

export function resolveSecretPassageMoveState({ game, target, getTileAtPosition }) {
  const player = game.players[game.currentPlayerIndex];
  if (game.turnPhase !== "move") return game;

  const currentTile = game.board[player.floor]?.find((tile) => tile.x === player.x && tile.y === player.y);
  if (!hasSecretPassageToken(currentTile)) return game;

  const destinationTile = getTileAtPosition(game.board, target.x, target.y, target.floor);
  if (!destinationTile || !hasSecretPassageToken(destinationTile)) return game;

  const path = game.movePath || [];
  const previousStep = path.length >= 2 ? path[path.length - 2] : null;
  const isBacktrack =
    previousStep && previousStep.x === target.x && previousStep.y === target.y && previousStep.floor === target.floor;

  if (isBacktrack) {
    const lastStep = path[path.length - 1];
    const refundedMoves = player.movesLeft + (lastStep?.cost ?? 1);
    const updatedPlayers = game.players.map((current, index) =>
      index === game.currentPlayerIndex
        ? { ...current, x: target.x, y: target.y, floor: target.floor, movesLeft: refundedMoves }
        : current
    );

    return {
      ...game,
      players: updatedPlayers,
      movePath: path.slice(0, -1),
      message: `${player.name} backtracks through the Secret Passage to ${destinationTile.name} — ${refundedMoves} move${refundedMoves !== 1 ? "s" : ""} left`,
    };
  }

  if (player.movesLeft < 1) return game;

  const movesLeft = player.movesLeft - 1;
  const updatedPlayers = game.players.map((current, index) =>
    index === game.currentPlayerIndex
      ? { ...current, x: target.x, y: target.y, floor: target.floor, movesLeft }
      : current
  );

  return {
    ...game,
    players: updatedPlayers,
    movePath: [...game.movePath, { x: target.x, y: target.y, floor: target.floor, cost: 1 }],
    message:
      movesLeft > 0
        ? `${player.name} uses a Secret Passage to ${destinationTile.name} — ${movesLeft} move${movesLeft !== 1 ? "s" : ""} left`
        : `${player.name} uses a Secret Passage to ${destinationTile.name} — no moves left`,
  };
}
