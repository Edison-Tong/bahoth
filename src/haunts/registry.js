import haunt1Definition from "./haunt_1/definition";
import haunt18Definition from "./haunt_18/definition";
import haunt28Definition from "./haunt_28/definition";
import haunt47Definition from "./haunt_47/definition";
import { SCENARIO_CARDS } from "./scenarioCards";
import {
  createInitialScenarioState,
  resolveAfterDamageState,
  resolveAfterMovementState,
  resolveTurnStartState,
  getCombatKnowledgeBonus,
  getCombatBonusLabel as getCombatBonusLabel1,
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
  getMonsterCardState,
  getPlayerHauntTokensState,
} from "./haunt_1/runtime";
import {
  createInitialScenarioState as createInitialScenarioState28,
  onHauntBegin as onHauntBegin28,
  resolveAfterDamageState as resolveAfterDamageState28,
  resolveAfterMovementState as resolveAfterMovementState28,
  resolveTurnStartState as resolveTurnStartState28,
  getCombatBonus as getCombatBonus28,
  getCombatActorProxyState as getCombatActorProxyState28,
  getSpecialMoveOptionsState as getSpecialMoveOptionsState28,
  getTileTokenLabelsState as getTileTokenLabelsState28,
  getKnowledgeTokenHoldersState as getKnowledgeTokenHoldersState28,
  canDeadPlayerTakeTurn as canDeadPlayerTakeTurn28,
  getActionAvailabilityState as getActionAvailabilityState28,
  getActionButtonsState as getActionButtonsState28,
  getActionRollPreviewState as getActionRollPreviewState28,
  resolveActionState as resolveActionState28,
  resolveActionRollContinueState as resolveActionRollContinueState28,
  resolveMonsterSpeedRollState as resolveMonsterSpeedRollState28,
  getMonsterCardState as getMonsterCardState28,
  getPlayerHauntTokensState as getPlayerHauntTokensState28,
  getPlayerCardFlagsState as getPlayerCardFlagsState28,
  getHauntTradeableTokensState as getHauntTradeableTokensState28,
  resolveHauntTradeConfirmState as resolveHauntTradeConfirmState28,
  getBoardRenderState as getBoardRenderState28,
} from "./haunt_28/runtime";
import {
  createInitialScenarioState as createInitialScenarioState47,
  onHauntBegin as onHauntBegin47,
  resolveAfterDamageState as resolveAfterDamageState47,
  resolveTurnStartState as resolveTurnStartState47,
  getCombatBonus as getCombatBonus47,
  getCombatBonusLabel as getCombatBonusLabel47,
  getTileTokenLabelsState as getTileTokenLabelsState47,
  getKnowledgeTokenHoldersState as getKnowledgeTokenHoldersState47,
  getActionAvailabilityState as getActionAvailabilityState47,
  getActionButtonsState as getActionButtonsState47,
  getActionRollPreviewState as getActionRollPreviewState47,
  resolveActionState as resolveActionState47,
  resolveActionRollContinueState as resolveActionRollContinueState47,
  getPlayerHauntTokensState as getPlayerHauntTokensState47,
  getBoardRenderState as getBoardRenderState47,
  getCombatInitOverride as getCombatInitOverride47,
  resolveCombatOutcomeState as resolveCombatOutcomeState47,
  getHauntCanPlayersTradeState as getHauntCanPlayersTradeState47,
  getHauntCanAttackTargetState as getHauntCanAttackTargetState47,
} from "./haunt_47/runtime";
import {
  createInitialScenarioState as createInitialScenarioState18,
  onHauntBegin as onHauntBegin18,
  resolveAfterDamageState as resolveAfterDamageState18,
  resolveAfterMovementState as resolveAfterMovementState18,
  resolveTurnStartState as resolveTurnStartState18,
  getSpecialMoveOptionsState as getSpecialMoveOptionsState18,
  getCombatActorProxyState as getCombatActorProxyState18,
  getCombatBonusLabel as getCombatBonusLabel18,
  resolveCombatOutcomeState as resolveCombatOutcomeState18,
  canDeadPlayerTakeTurn as canDeadPlayerTakeTurn18,
  getActionAvailabilityState as getActionAvailabilityState18,
  getActionButtonsState as getActionButtonsState18,
  getActionRollPreviewState as getActionRollPreviewState18,
  resolveActionState as resolveActionState18,
  resolveActionRollContinueState as resolveActionRollContinueState18,
  getTileTokenLabelsState as getTileTokenLabelsState18,
  getPlayerHauntTokensState as getPlayerHauntTokensState18,
  getBoardRenderState as getBoardRenderState18,
  getMonsterCardState as getMonsterCardState18,
  getKnowledgeTokenHoldersState as getKnowledgeTokenHoldersState18,
  getHauntCanAttackTargetState as getHauntCanAttackTargetState18,
} from "./haunt_18/runtime";

// Static registry mapping haunt IDs to definition objects and runtime hook bundles.
// Add new haunts here when they are implemented.
const HAUNT_REGISTRY = {
  [haunt1Definition.id]: haunt1Definition,
  [haunt18Definition.id]: haunt18Definition,
  [haunt28Definition.id]: haunt28Definition,
  [haunt47Definition.id]: haunt47Definition,
};

const HAUNT_RUNTIME_REGISTRY = {
  [haunt1Definition.id]: {
    createInitialScenarioState,
    resolveAfterDamageState,
    resolveAfterMovementState,
    resolveTurnStartState,
    getCombatBonus: getCombatKnowledgeBonus,
    getCombatBonusLabel: getCombatBonusLabel1,
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
    getMonsterCardState,
    getPlayerHauntTokensState,
  },
  [haunt28Definition.id]: {
    createInitialScenarioState: createInitialScenarioState28,
    onHauntBegin: onHauntBegin28,
    resolveAfterDamageState: resolveAfterDamageState28,
    resolveAfterMovementState: resolveAfterMovementState28,
    resolveTurnStartState: resolveTurnStartState28,
    getCombatBonus: getCombatBonus28,
    getCombatActorProxyState: getCombatActorProxyState28,
    getSpecialMoveOptionsState: getSpecialMoveOptionsState28,
    getTileTokenLabelsState: getTileTokenLabelsState28,
    getKnowledgeTokenHoldersState: getKnowledgeTokenHoldersState28,
    canDeadPlayerTakeTurn: canDeadPlayerTakeTurn28,
    getActionAvailabilityState: getActionAvailabilityState28,
    getActionButtonsState: getActionButtonsState28,
    getActionRollPreviewState: getActionRollPreviewState28,
    resolveActionState: resolveActionState28,
    resolveActionRollContinueState: resolveActionRollContinueState28,
    resolveMonsterSpeedRollState: resolveMonsterSpeedRollState28,
    getMonsterCardState: getMonsterCardState28,
    getPlayerHauntTokensState: getPlayerHauntTokensState28,
    getPlayerCardFlagsState: getPlayerCardFlagsState28,
    getHauntTradeableTokensState: getHauntTradeableTokensState28,
    resolveHauntTradeConfirmState: resolveHauntTradeConfirmState28,
    getBoardRenderState: getBoardRenderState28,
  },
  [haunt47Definition.id]: {
    createInitialScenarioState: createInitialScenarioState47,
    onHauntBegin: onHauntBegin47,
    resolveAfterDamageState: resolveAfterDamageState47,
    getCombatBonus: getCombatBonus47,
    getCombatBonusLabel: getCombatBonusLabel47,
    resolveTurnStartState: resolveTurnStartState47,
    getTileTokenLabelsState: getTileTokenLabelsState47,
    getKnowledgeTokenHoldersState: getKnowledgeTokenHoldersState47,
    getActionAvailabilityState: getActionAvailabilityState47,
    getActionButtonsState: getActionButtonsState47,
    getActionRollPreviewState: getActionRollPreviewState47,
    resolveActionState: resolveActionState47,
    resolveActionRollContinueState: resolveActionRollContinueState47,
    getPlayerHauntTokensState: getPlayerHauntTokensState47,
    getBoardRenderState: getBoardRenderState47,
    getCombatInitOverride: getCombatInitOverride47,
    resolveCombatOutcomeState: resolveCombatOutcomeState47,
    getHauntCanPlayersTradeState: getHauntCanPlayersTradeState47,
    getHauntCanAttackTargetState: getHauntCanAttackTargetState47,
  },
  [haunt18Definition.id]: {
    createInitialScenarioState: createInitialScenarioState18,
    onHauntBegin: onHauntBegin18,
    resolveAfterDamageState: resolveAfterDamageState18,
    resolveAfterMovementState: resolveAfterMovementState18,
    resolveTurnStartState: resolveTurnStartState18,
    getSpecialMoveOptionsState: getSpecialMoveOptionsState18,
    getCombatActorProxyState: getCombatActorProxyState18,
    getCombatBonusLabel: getCombatBonusLabel18,
    resolveCombatOutcomeState: resolveCombatOutcomeState18,
    canDeadPlayerTakeTurn: canDeadPlayerTakeTurn18,
    getActionAvailabilityState: getActionAvailabilityState18,
    getActionButtonsState: getActionButtonsState18,
    getActionRollPreviewState: getActionRollPreviewState18,
    resolveActionState: resolveActionState18,
    resolveActionRollContinueState: resolveActionRollContinueState18,
    getTileTokenLabelsState: getTileTokenLabelsState18,
    getPlayerHauntTokensState: getPlayerHauntTokensState18,
    getBoardRenderState: getBoardRenderState18,
    getMonsterCardState: getMonsterCardState18,
    getKnowledgeTokenHoldersState: getKnowledgeTokenHoldersState18,
    getHauntCanAttackTargetState: getHauntCanAttackTargetState18,
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
