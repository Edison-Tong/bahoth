// Event-resolution harness: builds the real `eventEngineDeps` bundle (the same
// one GameBoard.jsx assembles) from the actual engine modules, plus a minimal
// active-event game. This lets tests drive applyResolvedEventEffect /
// advanceEventResolution headlessly — the exact functions a dispatch-map
// refactor of eventEngine would touch.
import { DIR, PLAYER_STAT_ORDER, STAT_LABELS, createDrawnItemCard } from "../src/game/gameState.js";
import {
  getTileAtPosition,
  rollDice,
  resolveDamageEffect,
  createDamageChoice,
  resolveTraitRoll,
} from "../src/events/eventActions.js";
import { getEventRollButtonLabel } from "../src/events/eventUtils.js";
import { getHauntDefinitionById } from "../src/haunts/registry.js";
import { startSelectedHauntState } from "../src/haunts/core/hauntRuntime.js";
import { applyStatChangeState } from "../src/players/playerState.js";
import { makeGame } from "./harness.mjs";

/** The eventEngineDeps object exactly as GameBoard.jsx assembles it (applyStatChange === applyStatChangeState). */
export function buildEventEngineDeps() {
  return {
    DIR,
    getTileAtPosition,
    applyStatChange: applyStatChangeState,
    PLAYER_STAT_ORDER,
    createDrawnItemCard,
    rollDice,
    resolveDamageEffect,
    createDamageChoice,
    getEventRollButtonLabel,
    STAT_LABELS,
    getHauntDefinitionById,
    startSelectedHauntState,
  };
}

export function buildEventFlowDeps() {
  return { STAT_LABELS, rollDice, resolveTraitRoll };
}

/** A game with a minimal active eventState so effect handlers have summary/context to work with. */
export function makeEventGame({ players = 4, cardName = "Test Event", gamePhase } = {}) {
  const game = makeGame({ players });
  return {
    ...game,
    ...(gamePhase ? { gamePhase } : {}),
    turnPhase: "event",
    eventState: {
      card: { name: cardName },
      summary: "",
      awaiting: null,
      pendingEffects: [],
      context: { selectedStats: {} },
    },
  };
}
