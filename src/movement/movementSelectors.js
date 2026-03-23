export function getLeaveMoveCostState(tile) {
  return tile?.obstacle ? 2 : 1;
}

export function hasUnconfirmedMovePathState(game) {
  return game.turnPhase === "move" && Array.isArray(game.movePath) && game.movePath.length > 1;
}
