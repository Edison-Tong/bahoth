/* [OMEN] [DEATH] [VALIDATION] Returns true if the Skull omen death-intercept is currently usable (placeholder — always false until death flow exists). */
export function isSkullDeathInterceptAvailable() {
  // Death handling is not implemented yet.
  return false;
}

/* [OMEN] [DEATH] Applies the Skull omen death-intercept state (placeholder — state unchanged until death flow exists). */
export function applySkullDeathInterceptState(game) {
  // Placeholder: keep state unchanged until death flow exists.
  return {
    game,
    closeViewedCard: false,
    diceAnimation: null,
  };
}
