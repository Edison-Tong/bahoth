import haunt1Definition from "./haunt_1/definition";
import { SCENARIO_CARDS } from "./scenarioCards";
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

/* [HAUNT-SETUP] [LOOKUP] Look up a haunt's static definition (scenario text, win conditions, etc.) by ID. */
export function getHauntDefinitionById(id) {
  if (!id) return null;
  return HAUNT_REGISTRY[id] || null;
}

/* [HAUNT-SETUP] [LOOKUP] Returns all registered haunt definitions (used to build the haunt-selection list). */
export function getAllHauntDefinitions() {
  return Object.values(HAUNT_REGISTRY);
}

/* [HAUNT-SETUP] [LOOKUP] Returns the runtime hook bundle for a haunt (movement overrides, combat hooks, etc.) by ID. */
export function getHauntRuntimeHooksById(id) {
  if (!id) return null;
  return HAUNT_RUNTIME_REGISTRY[id] || null;
}

/* [HAUNT-SETUP] Picks the correct haunt after a triggered omen haunt roll using the selected reason card's omen→haunt mapping. Falls back to haunt 1 if no mapping is found. */
export function selectTriggeredHauntDefinition(game) {
  const scenarioCardId = game?.selectedScenarioCardId;
  const omenId = game?.hauntRoll?.triggeringOmenId;

  if (scenarioCardId && omenId) {
    const scenarioCard = SCENARIO_CARDS.find((c) => c.id === scenarioCardId);
    const hauntId = scenarioCard?.hauntsByOmen?.[omenId];
    if (hauntId && HAUNT_REGISTRY[hauntId]) {
      return HAUNT_REGISTRY[hauntId];
    }
  }

  // Fallback until all mappings are filled in
  return haunt1Definition;
}
