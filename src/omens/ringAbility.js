/* [COMBAT] [ITEM-ABILITY] [VALIDATION] Returns true if the Ring mental attack is currently usable (placeholder — always false until attack flow exists). */
export function isRingMentalAttackAvailable() {
  // Combat and mental attack resolution are not implemented yet.
  return false;
}

/* [COMBAT] [ITEM-ABILITY] Applies the Ring mental attack (placeholder — state unchanged until attack flow exists). */
export function applyRingMentalAttackState(game) {
  // Placeholder: keep state unchanged until attack flow exists.
  return {
    game,
    closeViewedCard: false,
    diceAnimation: null,
  };
}
