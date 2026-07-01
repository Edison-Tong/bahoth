// Small cross-cutting player/card predicates shared across engine modules.
// Extracted from duplicated inline copies in playerState, playerSelectors,
// and the four item-ability files.

/** A player is alive iff every stat track index is above 0 (0 = dead). */
export function isStatIndexAlive(statIndex) {
  return Object.values(statIndex).every((value) => value > 0);
}

/* [DAMAGE] [VALIDATION] True if applying the choice allocation would reduce any stat to 0 (lethal). */
export function isLethalDamageAllocation(player, choice) {
  if (!player || !choice || choice.adjustmentMode === "increase") return false;

  const previewStatIndex = { ...player.statIndex };
  for (const [stat, amount] of Object.entries(choice.allocation || {})) {
    if (!amount || !Object.prototype.hasOwnProperty.call(previewStatIndex, stat)) continue;
    previewStatIndex[stat] = Math.max(0, previewStatIndex[stat] - amount);
  }

  return Object.values(previewStatIndex).some((value) => value <= 0);
}

/* [ITEM-ABILITY] Resolves the live inventory card a viewedCard refers to, or null. */
export function getInventoryCard(game, viewedCard) {
  if (!viewedCard || viewedCard.ownerCollection !== "inventory") return null;
  const owner = game.players[viewedCard.ownerIndex];
  return owner?.inventory?.[viewedCard.ownerCardIndex] || null;
}
