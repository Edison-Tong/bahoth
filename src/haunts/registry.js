import haunt1Definition from "./haunt_1/definition";
import {
  createInitialScenarioState,
  resolveAfterDamageState,
  resolveAfterMovementState,
  resolveTurnStartState,
  getCombatKnowledgeBonus,
  getCombatActorProxyState,
  getSpecialMoveOptionsState,
  getTileTokenLabelsState,
  getKnowledgeTokenHoldersState,
  canDeadPlayerTakeTurn,
  getActionAvailabilityState,
  getActionButtonsState,
  getActionRollPreviewState,
  resolveActionState,
  resolveActionRollContinueState,
  resolveMonsterSpeedRollState,
} from "./haunt_1/runtime";

const HAUNT_REGISTRY = {
  [haunt1Definition.id]: haunt1Definition,
};

const HAUNT_RUNTIME_REGISTRY = {
  [haunt1Definition.id]: {
    createInitialScenarioState,
    resolveAfterDamageState,
    resolveAfterMovementState,
    resolveTurnStartState,
    getCombatBonus: getCombatKnowledgeBonus,
    getCombatActorProxyState,
    getSpecialMoveOptionsState,
    getTileTokenLabelsState,
    getKnowledgeTokenHoldersState,
    canDeadPlayerTakeTurn,
    getActionAvailabilityState,
    getActionButtonsState,
    getActionRollPreviewState,
    resolveActionState,
    resolveActionRollContinueState,
    resolveMonsterSpeedRollState,
  },
};

export function getHauntDefinitionById(id) {
  if (!id) return null;
  return HAUNT_REGISTRY[id] || null;
}

export function getAllHauntDefinitions() {
  return Object.values(HAUNT_REGISTRY);
}

export function getHauntRuntimeHooksById(id) {
  if (!id) return null;
  return HAUNT_RUNTIME_REGISTRY[id] || null;
}

// Temporary behavior: always pick Haunt 1 after a triggered haunt roll.
export function selectTriggeredHauntDefinition() {
  return haunt1Definition;
}
