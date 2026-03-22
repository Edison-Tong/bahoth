export function isSkullDeathInterceptAvailable() {
  // Death handling is not implemented yet.
  return false;
}

export function applySkullDeathInterceptState(game) {
  // Placeholder: keep state unchanged until death flow exists.
  return {
    game,
    closeViewedCard: false,
    diceAnimation: null,
  };
}
