/* [COMBAT] [ITEM-ABILITY] [VALIDATION] Returns true if the Dagger attack boost is currently usable (placeholder — always false until attack flow exists). */
export function isDaggerAttackBoostAvailable() {
  // Attack resolution is not implemented yet.
  return false;
}

/* [COMBAT] [ITEM-ABILITY] Applies the Dagger attack boost (placeholder — state unchanged until attack flow exists). */
export function applyDaggerAttackBoostState(game) {
  // Placeholder: keep state unchanged until attack flow exists.
  return {
    game,
    closeViewedCard: false,
    diceAnimation: null,
  };
}
