// Barrel re-export for all haunt domain logic (phases, runtime hooks, registry lookups).
export { GAME_PHASES, HAUNT_ACTION_LIMIT_SCOPE, HAUNT_TEAMS } from "./core/hauntPhases";
export {
  dismissHauntRollState,
  startHauntFromTriggerState,
  startSelectedHauntState,
  completeHauntSetupState,
  resolveHauntAfterDamageState,
  resolveHauntAfterMovementState,
  resolveHauntTurnStartState,
  getHauntCombatBonus,
  getHauntCombatActorProxyState,
  resolveHauntMonsterSpeedRollState,
  getHauntMovementOptionsState,
  getHauntTileTokenLabelsState,
  getHauntKnowledgeTokenHoldersState,
  getHauntCanDeadPlayerTakeTurnState,
  getHauntActionAvailabilityState,
  getHauntActionButtonsState,
  resolveHauntActionState,
  getHauntActionRollPreviewState,
  resolveHauntActionRollContinueState,
  advanceHauntRulesViewState,
  getHauntMonsterCardState,
} from "./core/hauntRuntime";
export { getHauntDefinitionById, getAllHauntDefinitions, selectTriggeredHauntDefinition } from "./registry";
