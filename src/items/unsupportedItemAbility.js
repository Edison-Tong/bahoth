// Whitelist of item actions and passive effect types that are defined in card data but
// not yet implemented in the client. Used to suppress "Use Now" buttons.
const UNSUPPORTED_ITEM_ACTIONS = new Set(["attack-bonus-die", "ranged-attack-speed"]);

const UNSUPPORTED_ITEM_PASSIVE_EFFECT_TYPES = new Set(["defense-roll-dice-bonus"]);

export function isUnsupportedItemAction(action) {
  return UNSUPPORTED_ITEM_ACTIONS.has(action);
}

export function isUnsupportedItemPassiveEffectType(effectType) {
  return UNSUPPORTED_ITEM_PASSIVE_EFFECT_TYPES.has(effectType);
}

export function getUnsupportedItemActionList() {
  return [...UNSUPPORTED_ITEM_ACTIONS];
}
