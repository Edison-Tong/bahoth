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

// Static registry mapping haunt IDs to definition objects and runtime hook bundles.
// Add new haunts here when they are implemented.
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

// Look up a haunt's static definition (scenario text, win conditions, etc.) by ID.
export function getHauntDefinitionById(id) {
  if (!id) return null;
  return HAUNT_REGISTRY[id] || null;
}

// Returns all registered haunt definitions (used to build the haunt-selection list, if any).
export function getAllHauntDefinitions() {
  return Object.values(HAUNT_REGISTRY);
}

// Returns the runtime hook bundle for a haunt (movement overrides, combat hooks, etc.) by ID.
export function getHauntRuntimeHooksById(id) {
  if (!id) return null;
  return HAUNT_RUNTIME_REGISTRY[id] || null;
}

// Temporary behavior: always pick Haunt 1 after a triggered haunt roll.
export function selectTriggeredHauntDefinition() {
  return haunt1Definition;
}
