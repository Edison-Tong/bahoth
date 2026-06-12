// Whitelist of item actions and passive effect types that are defined in card data but
// not yet implemented in the client. Used to suppress "Use Now" buttons.
const UNSUPPORTED_ITEM_ACTIONS = new Set(["attack-bonus-die", "ranged-attack-speed"]);

const UNSUPPORTED_ITEM_PASSIVE_EFFECT_TYPES = new Set(["defense-roll-dice-bonus"]);

/* [ITEM-ABILITY] [VALIDATION] Returns true if the item action has no client implementation yet. */
export function isUnsupportedItemAction(action) {
  return UNSUPPORTED_ITEM_ACTIONS.has(action);
}

/* [ITEM-PASSIVE] [VALIDATION] Returns true if the passive effect type has no client implementation yet. */
export function isUnsupportedItemPassiveEffectType(effectType) {
  return UNSUPPORTED_ITEM_PASSIVE_EFFECT_TYPES.has(effectType);
}

/* [ITEM-ABILITY] [LOOKUP] Returns the full list of unimplemented item action strings. */
export function getUnsupportedItemActionList() {
  return [...UNSUPPORTED_ITEM_ACTIONS];
}
