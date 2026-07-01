// Shared haunt-runtime helpers.
//
// Every haunt's runtime.js re-implemented these same pure helpers. They depend
// only on the generic game/hauntState shape (players, currentPlayerIndex,
// board, turnNumber, hauntState.traitorPlayerIndex, hauntActionRoll), never on
// a specific scenario, so they live here and are imported by each haunt.
//
// Haunt-SPECIFIC helpers (e.g. getScenarioState, which merges a scenario's own
// defaults) stay in each haunt's runtime.js.

/* [PLAYER-STATE] Returns the current player object. */
export function getCurrentPlayer(game) {
  return game.players[game.currentPlayerIndex] || null;
}

/* [LOOKUP] Returns the board tile at the current player's position. */
export function getCurrentTile(game) {
  const player = getCurrentPlayer(game);
  if (!player) return null;
  return (game.board[player.floor] || []).find((t) => t.x === player.x && t.y === player.y) || null;
}

/* [HAUNT-ACTION] Creates a "turnNumber:playerIndex:actionId" key used for once-per-turn gating. */
export function createUsageKey(game, actionId) {
  return `${game.turnNumber}:${game.currentPlayerIndex}:${actionId}`;
}

/* [HAUNT-ACTION] Marks a haunt action usage key in hauntState. */
export function markHauntActionUsed(hauntState, usageKey) {
  return {
    ...hauntState,
    oncePerTurnUsage: {
      ...(hauntState.oncePerTurnUsage || {}),
      [usageKey]: true,
    },
  };
}

/* [LOOKUP] Returns all non-traitor player indexes. */
export function getHeroIndexes(game) {
  if (!game.hauntState) return [];
  const traitorIndex = game.hauntState.traitorPlayerIndex;
  return game.players.map((_, i) => i).filter((i) => i !== traitorIndex);
}

/* [LOOKUP] Returns living hero player indexes. */
export function getLivingHeroIndexes(game) {
  return getHeroIndexes(game).filter((i) => game.players[i]?.isAlive);
}

/* [VALIDATION] Returns true if the given player index is a hero (not the traitor). */
export function isHero(game, playerIndex) {
  return getHeroIndexes(game).includes(playerIndex);
}

/* [HAUNT-ACTION] Returns the pending haunt action roll, or null. */
export function getActionRoll(game) {
  return game.hauntActionRoll || null;
}

/* [HAUNT-ACTION] Computes { actionId, stat, rollTotal, bonus, effectiveTotal, threshold, success } from a settled roll. */
export function getActionRollResult(game) {
  const rollState = getActionRoll(game);
  const rollTotal = Number(rollState?.lastRoll?.total);
  if (!rollState || !Number.isFinite(rollTotal)) return null;
  const bonus = Number(rollState.bonus) || 0;
  const effectiveTotal = rollTotal + bonus;
  return {
    actionId: rollState.actionId,
    stat: rollState.stat,
    rollTotal,
    bonus,
    effectiveTotal,
    threshold: Number(rollState.threshold) || 0,
    success: effectiveTotal >= (Number(rollState.threshold) || 0),
  };
}

/* [HAUNT-ACTION] Removes hauntActionRoll from game state. */
export function clearHauntActionRoll(game) {
  if (!game.hauntActionRoll) return game;
  return { ...game, hauntActionRoll: null };
}
