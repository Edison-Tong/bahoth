/* eslint-disable no-unused-vars -- template skeleton: hauntBase helpers are imported up-front to show what's available; delete the ones a real haunt doesn't use. */
// TEMPLATE runtime — copy to `haunt_<N>/runtime.js` and implement the hooks
// this haunt needs. Everything here is a pure state function: given `game`,
// return the next `game` (or a small result object for read-only hooks). Never
// mutate `game` in place.
//
// Shared, generic helpers come from hauntBase — DON'T re-implement them.
// Only scenario-specific helpers (getScenarioState below) live here.

import { GAME_PHASES } from "../core/hauntPhases";
import {
  getCurrentPlayer,
  getCurrentTile,
  createUsageKey,
  markHauntActionUsed,
  getHeroIndexes,
  getLivingHeroIndexes,
  isHero,
  getActionRoll,
  getActionRollResult,
  clearHauntActionRoll,
} from "../core/hauntBase";

const HAUNT_ID = "haunt_TEMPLATE"; // must match definition.id and the folder name

// Every hook guards on this so a haunt's logic only runs while it's active.
function isActive(game) {
  return game.gamePhase === GAME_PHASES.HAUNT_ACTIVE && game.activeHauntId === HAUNT_ID;
}

// ---------------------------------------------------------------------------
// Scenario state
// ---------------------------------------------------------------------------

/* [HAUNT-SETUP] Clean starting scenario state. Add every mutable field this haunt tracks. */
export function createInitialScenarioState() {
  return {
    // e.g. tokens: [], trappedHeroes: [], pendingChoice: null,
  };
}

/* [HAUNT-SETUP] Merges hauntState.scenarioState with defaults so every field is always present. */
function getScenarioState(hauntState) {
  const defaults = createInitialScenarioState();
  return { ...defaults, ...(hauntState?.scenarioState || {}) };
}

// ---------------------------------------------------------------------------
// Setup hook (optional)
// ---------------------------------------------------------------------------

/* [HAUNT-SETUP] Runs once when the haunt goes active. Return the next `game` (place tokens,
   position monsters, mark statuses, etc.), or omit this export if there's nothing to do. */
export function onHauntBegin(game) {
  // const scenarioState = getScenarioState(game.hauntState);
  // ...compute placements...
  // return { ...game, hauntState: { ...game.hauntState, scenarioState: nextScenarioState } };
  return game;
}

// ---------------------------------------------------------------------------
// Once-per-turn actions (the buttons in the haunt action bar)
// ---------------------------------------------------------------------------

/* [HAUNT-ACTION] Which action ids are currently *enabled* for the acting player. */
export function getActionAvailabilityState(game /*, context */) {
  if (!isActive(game)) return {};
  return {}; // { "action-id": true/false, ... }
}

/* [HAUNT-ACTION] [OVERLAY] The action buttons to render (label + id), in order. */
export function getActionButtonsState(game /*, context */) {
  if (!isActive(game)) return [];
  return []; // [{ id: "action-id", label: "Do the thing" }, ...]
}

/* [HAUNT-ACTION] Resolve a clicked action. Return the next `game`. Use createUsageKey +
   markHauntActionUsed to enforce oncePerTurn, and buildPendingActionRoll-style state for rolls. */
export function resolveActionState(game, { actionId } = {}) {
  if (!isActive(game)) return game;
  switch (actionId) {
    // case "action-id": return doTheThing(game);
    default:
      return game;
  }
}

/* [HAUNT-ACTION] [OVERLAY] Roll-result preview (success/fail text) for the action-roll overlay. */
export function getActionRollPreviewState(game) {
  if (!isActive(game)) return null;
  const result = getActionRollResult(game);
  if (!result) return null;
  return null; // { title, success, detail, ... }
}

/* [HAUNT-ACTION] Apply the outcome after the player presses Continue on an action roll. */
export function resolveActionRollContinueState(game /*, { createDamageChoice, rollDice } */) {
  if (!isActive(game)) return game;
  return clearHauntActionRoll(game);
}

// ---------------------------------------------------------------------------
// Board / sidebar display (optional)
// ---------------------------------------------------------------------------

/* [BOARD-LAYOUT] Token labels drawn on a given board tile. */
export function getTileTokenLabelsState(game, position) {
  if (!isActive(game)) return [];
  void position;
  return []; // [{ label: "Portal", kind: "portal" }, ...]
}

/* [PLAYER-STATE] Chips shown next to a player in the sidebar (statuses, tokens). */
export function getPlayerHauntTokensState(game, playerIndex) {
  if (!isActive(game)) return [];
  void playerIndex;
  return [];
}

// ---------------------------------------------------------------------------
// OPTIONAL HOOKS — add an export only if this haunt needs it. Signatures:
//
//   resolveAfterDamageState(previousGame, nextGame)      -> game   // react to a death/damage
//   resolveAfterMovementState(previousGame, nextGame)    -> game   // sync monster to mover
//   resolveTurnStartState(game)                          -> game   // start-of-turn effects
//   getCombatBonus(game, actorIndex, defenderIndex, role)-> number // dice/total bonus
//   getCombatBonusLabel(game, ...)                       -> string
//   getCombatInitOverride(game, actorIndex, defenderIndex)-> {...}  // custom attack stat
//   resolveCombatOutcomeState(game, outcome)             -> game   // custom damage/trap logic
//   getCombatActorProxyState(game, actorIndex)           -> {...}   // monster stands in for dead traitor
//   getSpecialMoveOptionsState(game)                     -> [...]   // custom monster movement
//   canDeadPlayerTakeTurn(game, playerIndex)             -> bool    // dead traitor controls a monster
//   resolveMonsterSpeedRollState(game, roll)             -> game
//   getMonsterCardState(game)                            -> {...}   // sidebar monster card
//   getBoardRenderState(game)                            -> {...}   // flooded tiles, monster position
//   getKnowledgeTokenHoldersState(game)                  -> [...]   // players with special tokens
//   getHauntCanAttackTargetState(game, attacker, target)-> bool     // restrict attacks
//   getHauntCanPlayersTradeState(game, a, b)             -> bool     // restrict trades
//   getHauntTradeableTokensState(game, playerIndex)      -> [...]
//   resolveHauntTradeConfirmState(game, trade)           -> game
//   getPlayerCardFlagsState(game, playerIndex)           -> {...}    // card display flags
//
// After implementing, add ONE line to registry.js's IMPLEMENTED_HAUNTS array:
//   { definition: hauntNDefinition, runtime: hauntNRuntime }
// Every exported function above is auto-collected as a hook — no wiring needed.
// ---------------------------------------------------------------------------
