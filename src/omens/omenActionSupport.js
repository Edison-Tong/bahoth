const SUPPORTED_OMEN_ACTIONS = new Set([
  "holy-symbol-bury-discovered-tile",
  "mask-push-adjacent-players",
  "dog-remote-trade",
  "substitute-knowledge-for-trait",
]);

export function isSupportedOmenAction(action) {
  return SUPPORTED_OMEN_ACTIONS.has(action);
}
