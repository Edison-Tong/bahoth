/* [MOVEMENT] Returns how many moves it costs to leave a tile (2 for obstacle tiles, 1 otherwise). */
export function getLeaveMoveCostState(tile) {
  return tile?.obstacle ? 2 : 1;
}

/* [MOVEMENT] [VALIDATION] Returns true if the player has an unconfirmed multi-step move path (used to show the Confirm button). */
export function hasUnconfirmedMovePathState(game) {
  return game.turnPhase === "move" && Array.isArray(game.movePath) && game.movePath.length > 1;
}
