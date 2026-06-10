// Barrel re-export for omen abilities (Idol, Dog trade, active omen now-abilities).
export {
  applyDrawIdolEventCardState,
  applySkipIdolEventCardState,
  getIdolChoiceStateForQueuedEvent,
} from "./idolAbility";
export { resolveSpecialOmenNowAbilityState } from "./activeOmenNowAbility";
export { getDogTradeUiState, isItemTradeLockedThisTurn } from "./dogAbility";
