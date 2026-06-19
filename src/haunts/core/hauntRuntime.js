import { GAME_PHASES, HAUNT_TEAMS } from "./hauntPhases";
import { getHauntRuntimeHooksById } from "../registry";

/* [HAUNT-SETUP] Initialises hauntState for a just-triggered haunt: assigns teams, starting scenario state, and structures the setup flow. traitorPlayerIndexOverride lets debug tools choose the traitor. */
function createInitialHauntState(game, hauntDefinition, traitorPlayerIndexOverride = null) {
  const defaultTraitorIndex = game.currentPlayerIndex;
  const traitorPlayerIndex = Number.isInteger(traitorPlayerIndexOverride)
    ? Math.max(0, Math.min(game.players.length - 1, traitorPlayerIndexOverride))
    : defaultTraitorIndex;
  const heroPlayerIndexes = game.players.map((_, index) => index).filter((index) => index !== traitorPlayerIndex);
  const firstPlayerAfterSetup = (traitorPlayerIndex + 1) % game.players.length;

  const runtimeHooks = getHauntRuntimeHooksById(hauntDefinition.id);
  const initialScenarioState = runtimeHooks?.createInitialScenarioState
    ? runtimeHooks.createInitialScenarioState()
    : {};

  return {
    id: hauntDefinition.id,
    status: "setup",
    startedAtTurn: game.turnNumber,
    traitorPlayerIndex,
    firstPlayerAfterSetup,
    setup: {
      currentStepIndex: 0,
      completed: false,
      heroSteps: hauntDefinition.setup?.heroes || [],
      traitorSteps: hauntDefinition.setup?.traitor || [],
    },
    rulesView: {
      step: "heroes-prompt",
      completed: false,
    },
    teams: {
      [HAUNT_TEAMS.HEROES]: {
        playerIndexes: heroPlayerIndexes,
      },
      [HAUNT_TEAMS.TRAITOR]: {
        playerIndexes: [traitorPlayerIndex],
      },
      [HAUNT_TEAMS.MONSTERS]: {
        actors: [],
      },
    },
    tokens: (hauntDefinition.tokens?.required || []).map((tokenId) => ({
      id: tokenId,
      placed: false,
      placement: null,
    })),
    objectives: {
      heroes: hauntDefinition.objectives?.heroes || "",
      traitor: hauntDefinition.objectives?.traitor || "",
    },
    heroActions: hauntDefinition.heroActions || [],
    traitorActions: hauntDefinition.traitorActions || [],
    monsters: hauntDefinition.monsters || [],
    oncePerTurnUsage: {},
    oncePerGameUsage: {},
    scenarioState: initialScenarioState,
  };
}

/* [HAUNT-SETUP] Transitions the game into HAUNT_SETUP for a chosen haunt definition. */
export function startSelectedHauntState(game, { hauntDefinition, traitorPlayerIndex = null }) {
  if (!hauntDefinition) return game;

  return {
    ...game,
    gamePhase: GAME_PHASES.HAUNT_SETUP,
    hauntTriggered: true,
    activeHauntId: hauntDefinition.id,
    drawnCard: null,
    tileEffect: null,
    damageChoice: null,
    eventState: null,
    combatState: null,
    turnPhase: "move",
    movePath: [
      {
        x: game.players[game.currentPlayerIndex]?.x ?? 0,
        y: game.players[game.currentPlayerIndex]?.y ?? 0,
        floor: game.players[game.currentPlayerIndex]?.floor ?? "ground",
        cost: 0,
      },
    ],
    pendingExplore: null,
    pendingSpecialPlacement: null,
    mysticElevatorReady: false,
    mysticElevatorUsed: false,
    hauntState: createInitialHauntState(game, hauntDefinition, traitorPlayerIndex),
    message: `[Debug] ${hauntDefinition.title} started. Complete haunt setup before continuing play.`,
  };
}

/* [HAUNT-SETUP] [OMEN] Selects and starts the triggered haunt after a haunt roll succeeds. */
export function startHauntFromTriggerState(game, { selectHauntDefinition }) {
  if (game.gamePhase !== GAME_PHASES.PRE_HAUNT) {
    return game;
  }

  const hauntDefinition = selectHauntDefinition(game);
  if (!hauntDefinition) return game;

  return {
    ...startSelectedHauntState(game, { hauntDefinition }),
    message: `${hauntDefinition.title} begins. Complete haunt setup before continuing play.`,
  };
}

/* [HAUNT-SETUP] [OMEN] Clears hauntRoll, triggers the haunt if warranted, and advances to endTurn. */
export function dismissHauntRollState(game, { selectHauntDefinition }) {
  if (!game.hauntRoll) return game;

  const shouldStartHaunt = !!game.hauntRoll.hauntTriggered && game.gamePhase === GAME_PHASES.PRE_HAUNT;
  const withPhaseResolved = shouldStartHaunt ? startHauntFromTriggerState(game, { selectHauntDefinition }) : game;

  return {
    ...withPhaseResolved,
    hauntRoll: null,
    turnPhase: "endTurn",
  };
}

/* [HAUNT-SETUP] Steps through the rules-viewer sequence (heroes-prompt → heroes-rules → traitor-prompt → traitor-rules). */
export function advanceHauntRulesViewState(game) {
  if (game.gamePhase !== GAME_PHASES.HAUNT_SETUP) return game;
  if (!game.hauntState?.rulesView) return game;

  const currentStep = game.hauntState.rulesView.step;
  const nextStepByCurrent = {
    "heroes-prompt": "heroes-rules",
    "heroes-rules": "traitor-prompt",
    "traitor-prompt": "traitor-rules",
  };
  const nextStep = nextStepByCurrent[currentStep];
  if (!nextStep) return game;

  return {
    ...game,
    hauntState: {
      ...game.hauntState,
      rulesView: {
        ...game.hauntState.rulesView,
        step: nextStep,
      },
    },
  };
}

/* [HAUNT-SETUP] [STAT-CHANGE] Returns the player count-based physical stat bonus granted to the traitor on haunt start. */
function getTraitorPhysicalBonus(hauntDefinition, playerCount) {
  if (!hauntDefinition?.scaling?.traitorPhysicalBonusByPlayerCount) return 0;
  return hauntDefinition.scaling.traitorPhysicalBonusByPlayerCount[playerCount] || 0;
}

/* [HAUNT-SETUP] [STAT-CHANGE] Resets a player's stats to their starting index values and marks them alive. */
function healAllTraits(player) {
  const nextStatIndex = {
    might: Math.max(player.statIndex.might, player.character?.startIndex?.might ?? player.statIndex.might),
    speed: Math.max(player.statIndex.speed, player.character?.startIndex?.speed ?? player.statIndex.speed),
    sanity: Math.max(player.statIndex.sanity, player.character?.startIndex?.sanity ?? player.statIndex.sanity),
    knowledge: Math.max(
      player.statIndex.knowledge,
      player.character?.startIndex?.knowledge ?? player.statIndex.knowledge
    ),
  };
  return {
    ...player,
    statIndex: nextStatIndex,
    isAlive: true,
  };
}

/* [HAUNT-SETUP] [STAT-CHANGE] Heals the traitor to starting stats and applies player-count-based physical bonus on haunt start. */
function applyTraitorSetupBonuses(players, traitorPlayerIndex, hauntDefinition) {
  const traitor = players[traitorPlayerIndex];
  if (!traitor) return players;

  const healedTraitor = healAllTraits(traitor);
  const physicalBonus = getTraitorPhysicalBonus(hauntDefinition, players.length);
  const boostedStatIndex = {
    ...healedTraitor.statIndex,
    might: Math.min(healedTraitor.character.might.length - 1, healedTraitor.statIndex.might + physicalBonus),
    speed: Math.min(healedTraitor.character.speed.length - 1, healedTraitor.statIndex.speed + physicalBonus),
  };

  return players.map((player, index) => {
    if (index !== traitorPlayerIndex) return player;
    return {
      ...healedTraitor,
      statIndex: boostedStatIndex,
    };
  });
}

/* [HAUNT-SETUP] [STAT-CHANGE] Completes haunt setup: applies traitor bonuses, transitions to HAUNT_ACTIVE, and passes the first hero turn. */
export function completeHauntSetupState(game, { getHauntDefinitionById }) {
  if (game.gamePhase !== GAME_PHASES.HAUNT_SETUP) return game;
  if (!game.hauntState || !game.activeHauntId) return game;

  const hauntDefinition = getHauntDefinitionById(game.activeHauntId);
  if (!hauntDefinition) return game;

  const traitorPlayerIndex = game.hauntState.traitorPlayerIndex;
  const playersAfterSetup = applyTraitorSetupBonuses(game.players, traitorPlayerIndex, hauntDefinition);

  const desiredFirstPlayer =
    game.hauntState.firstPlayerAfterSetup ?? (traitorPlayerIndex + 1) % playersAfterSetup.length;
  const firstPlayer = playersAfterSetup[desiredFirstPlayer] || playersAfterSetup[0];
  const firstPlayerSpeed = firstPlayer.character.speed[firstPlayer.statIndex.speed];
  const playersWithMoves = playersAfterSetup.map((player, index) => ({
    ...player,
    movesLeft: index === desiredFirstPlayer ? firstPlayerSpeed : 0,
  }));

  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  const baseHauntState = {
    ...game.hauntState,
    status: "active",
    setup: {
      ...game.hauntState.setup,
      currentStepIndex: Math.max(
        game.hauntState.setup?.heroSteps?.length || 0,
        game.hauntState.setup?.traitorSteps?.length || 0
      ),
      completed: true,
    },
  };

  const baseGame = {
    ...game,
    players: playersWithMoves,
    currentPlayerIndex: desiredFirstPlayer,
    gamePhase: GAME_PHASES.HAUNT_ACTIVE,
    turnPhase: "move",
    movePath: [{ x: firstPlayer.x, y: firstPlayer.y, floor: firstPlayer.floor, cost: 0 }],
    pendingExplore: null,
    pendingSpecialPlacement: null,
    mysticElevatorReady: false,
    mysticElevatorUsed: false,
    drawnCard: null,
    tileEffect: null,
    damageChoice: null,
    rabbitFootPendingReroll: null,
    eventState: null,
    hauntState: baseHauntState,
    message: `${firstPlayer.name} takes the first hero turn. The haunt is active.`,
  };

  if (runtimeHooks?.onHauntBegin) {
    const result = runtimeHooks.onHauntBegin(baseGame);
    if (result) {
      // If result has a hauntState, treat it as a full game return (e.g. haunt_28 also modifies the board)
      if (result.hauntState !== undefined) {
        return result;
      }
      // Backward compat: result is just a scenarioState object
      return {
        ...baseGame,
        hauntState: { ...baseHauntState, scenarioState: result },
      };
    }
  }

  return baseGame;
}

/* [HAUNT-ACTION] [DAMAGE] Delegates to the active haunt's after-damage hook (e.g. to trigger Jack's Spirit appearance on traitor death). */
export function resolveHauntAfterDamageState(previousGame, nextGame) {
  const runtimeHooks = getHauntRuntimeHooksById(nextGame.activeHauntId);
  if (runtimeHooks?.resolveAfterDamageState) {
    return runtimeHooks.resolveAfterDamageState(previousGame, nextGame);
  }
  return nextGame;
}

/* [SPIRIT] [MOVEMENT] Delegates to the active haunt's after-movement hook (e.g. to sync spirit position). */
export function resolveHauntAfterMovementState(previousGame, nextGame) {
  const runtimeHooks = getHauntRuntimeHooksById(nextGame.activeHauntId);
  if (runtimeHooks?.resolveAfterMovementState) {
    return runtimeHooks.resolveAfterMovementState(previousGame, nextGame);
  }
  return nextGame;
}

/* [SPIRIT] [DICE-ROLL] Delegates to the active haunt's turn-start hook (e.g. Jack's Spirit speed roll). */
export function resolveHauntTurnStartState(game, { rollDice }) {
  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  if (runtimeHooks?.resolveTurnStartState) {
    const result = runtimeHooks.resolveTurnStartState(game, { rollDice });
    if (result && typeof result === "object" && Object.prototype.hasOwnProperty.call(result, "game")) {
      return {
        game: result.game,
        diceAnimation: result.diceAnimation || null,
      };
    }
    return {
      game: result || game,
      diceAnimation: null,
    };
  }
  return {
    game,
    diceAnimation: null,
  };
}

/* [HAUNT-COMBAT] Returns bonus dice/total added to combat rolls for the active haunt (e.g. Knowledge of Jack token). */
export function getHauntCombatBonus(game, actorIndex, defenderIndex, role) {
  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  if (runtimeHooks?.getCombatBonus) {
    return runtimeHooks.getCombatBonus(game, actorIndex, defenderIndex, role);
  }
  return 0;
}

/* [HAUNT-COMBAT] Returns a label string for the haunt combat bonus (shown in roll messages), or null for no message. */
export function getHauntCombatBonusLabel(game, actorIndex, defenderIndex, role) {
  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  if (runtimeHooks?.getCombatBonusLabel) {
    return runtimeHooks.getCombatBonusLabel(game, actorIndex, defenderIndex, role);
  }
  return null;
}

/* [HAUNT-COMBAT] Returns { rollStat, combatDamageType } override for combat initiation, or null. Only fires for melee (no source card). */
export function getHauntCombatInitOverride(game, attackerIndex, defenderIndex) {
  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  if (runtimeHooks?.getCombatInitOverride) {
    return runtimeHooks.getCombatInitOverride(game, attackerIndex, defenderIndex);
  }
  return null;
}

/* [HAUNT-COMBAT] Resolves combat outcome with haunt-specific logic (e.g. trap instead of damage). Returns modified game state or null. */
export function getHauntCombatOutcomeOverride(game, outcome, combatState, { createDamageChoice } = {}) {
  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  if (runtimeHooks?.resolveCombatOutcomeState) {
    return runtimeHooks.resolveCombatOutcomeState(game, outcome, combatState, { createDamageChoice });
  }
  return null;
}

/* [TRADE] Returns false if the haunt restricts trading between these two players. Defaults to true (allowed). */
export function getHauntCanPlayersTradeState(game, ownerIndex, targetIndex) {
  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  if (runtimeHooks?.getHauntCanPlayersTradeState) {
    return runtimeHooks.getHauntCanPlayersTradeState(game, ownerIndex, targetIndex);
  }
  return true;
}

/* [HAUNT-COMBAT] Returns whether the attacker can attack the given defender this turn. Defaults to !game.hasAttackedThisTurn. */
export function getHauntCanAttackTargetState(game, attackerIndex, defenderIndex) {
  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  if (runtimeHooks?.getHauntCanAttackTargetState) {
    return runtimeHooks.getHauntCanAttackTargetState(game, attackerIndex, defenderIndex);
  }
  return !game.hasAttackedThisTurn;
}

/* [SPIRIT] Returns a proxy combat actor for the traitor when dead but controlling a monster (Jack's Spirit). */
export function getHauntCombatActorProxyState(game, actorIndex) {
  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  if (runtimeHooks?.getCombatActorProxyState) {
    return runtimeHooks.getCombatActorProxyState(game, actorIndex);
  }
  return null;
}

/* [SPIRIT] [DICE-ANIMATION] Delegates to the haunt runtime to resolve the settled monster speed roll. */
export function resolveHauntMonsterSpeedRollState(game, { dice, total, monsterName }) {
  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  if (runtimeHooks?.resolveMonsterSpeedRollState) {
    return runtimeHooks.resolveMonsterSpeedRollState(game, { dice, total, monsterName });
  }
  return game;
}

/* [SPIRIT] [MOVEMENT] Returns special move options for the active haunt (e.g. Jack's Spirit tile-movement when traitor is dead). */
export function getHauntMovementOptionsState(context) {
  const runtimeHooks = getHauntRuntimeHooksById(context?.game?.activeHauntId);
  if (runtimeHooks?.getSpecialMoveOptionsState) {
    return runtimeHooks.getSpecialMoveOptionsState(context);
  }
  return null;
}

/* [BOARD-RENDER] Returns { floodedTiles, monsterToken } for board rendering — flooded tile list and active monster token position/emoji. */
export function getHauntBoardRenderState(game) {
  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  if (runtimeHooks?.getBoardRenderState) {
    return runtimeHooks.getBoardRenderState(game);
  }
  return { floodedTiles: [], monsterToken: null, trappedPlayerIndexes: [] };
}

/* [SPIRIT] [BOARD-LAYOUT] Returns UI token labels for the active haunt at a given board position (corpse, exorcism circle, spirit). */
export function getHauntTileTokenLabelsState(game, position) {
  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  if (runtimeHooks?.getTileTokenLabelsState) {
    return runtimeHooks.getTileTokenLabelsState(game, position);
  }
  return [];
}

/* [HAUNT-ACTION] [VALIDATION] Delegates to the haunt runtime to compute per-haunt action button availability (learn, study, exorcise, stalk-prey). */
export function getHauntActionAvailabilityState(game, context) {
  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  if (runtimeHooks?.getActionAvailabilityState) {
    return runtimeHooks.getActionAvailabilityState(game, context);
  }
  return {
    learnAboutJack: false,
    studyExorcism: false,
    exorciseJacksSpirit: false,
    stalkPrey: false,
  };
}

/* [HAUNT-COMBAT] Delegates to the haunt runtime to get the list of players currently holding a knowledge token. */
export function getHauntKnowledgeTokenHoldersState(game) {
  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  if (runtimeHooks?.getKnowledgeTokenHoldersState) {
    return runtimeHooks.getKnowledgeTokenHoldersState(game);
  }
  return [];
}

/* [SIDEBAR] Returns per-player card display flags for the active haunt (e.g. expandable: false for shark traitor). Defaults to expandable: true. */
export function getHauntPlayerCardFlagsState(game, playerIndex) {
  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  if (runtimeHooks?.getPlayerCardFlagsState) {
    const flags = runtimeHooks.getPlayerCardFlagsState(game, playerIndex);
    if (flags != null) return flags;
  }
  return { expandable: true };
}

/* [SIDEBAR] Returns the haunt-specific monster card data object for display in the player sidebar, or null if no monster is active. */
export function getHauntMonsterCardState(game) {
  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  if (runtimeHooks?.getMonsterCardState) {
    return runtimeHooks.getMonsterCardState(game);
  }
  return null;
}

/* [SIDEBAR] Returns haunt-specific token chips for a given player, e.g. Knowledge of Jack or Explosive tokens. Returns [] if none. */
export function getHauntPlayerTokensState(game, playerIndex) {
  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  if (runtimeHooks?.getPlayerHauntTokensState) {
    return runtimeHooks.getPlayerHauntTokensState(game, playerIndex);
  }
  return [];
}

/* [TRADE] Returns { label, ownerHas, targetHas } for haunt-specific tradeable tokens (e.g. Explosives), or null. */
export function getHauntTradeableTokensState(game, ownerIndex, targetIndex) {
  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  if (runtimeHooks?.getHauntTradeableTokensState) {
    return runtimeHooks.getHauntTradeableTokensState(game, ownerIndex, targetIndex);
  }
  return null;
}

/* [TRADE] Applies haunt-specific token transfers (e.g. Explosives) after the normal item/omen trade completes. */
export function resolveHauntTradeConfirmState(game, tradeState) {
  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  if (runtimeHooks?.resolveHauntTradeConfirmState) {
    return runtimeHooks.resolveHauntTradeConfirmState(game, tradeState);
  }
  return game;
}

/* [PLAYER-STATE] [HAUNT-SETUP] Returns whether the current haunt allows a dead player to still take a turn (Jack's Spirit traitor). */
export function getHauntCanDeadPlayerTakeTurnState(game, playerIndex) {
  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  if (runtimeHooks?.canDeadPlayerTakeTurn) {
    return runtimeHooks.canDeadPlayerTakeTurn(game, playerIndex);
  }
  return false;
}

/* [HAUNT-ACTION] [OVERLAY] Returns the list of action button configs for the haunt UI panel. */
export function getHauntActionButtonsState(game, context) {
  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  if (runtimeHooks?.getActionButtonsState) {
    return runtimeHooks.getActionButtonsState(game, context);
  }

  return [];
}

/* [HAUNT-ACTION] Dispatches an action button press to the active haunt's resolveActionState hook. */
export function resolveHauntActionState(game, { actionId, resolveTraitRoll, createDamageChoice }) {
  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  if (runtimeHooks?.resolveActionState) {
    return runtimeHooks.resolveActionState(game, { actionId, resolveTraitRoll, createDamageChoice });
  }

  return game;
}

/* [HAUNT-ACTION] [OVERLAY] Returns roll-result preview data for the haunt action roll overlay (success/failure description). */
export function getHauntActionRollPreviewState(game) {
  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  if (runtimeHooks?.getActionRollPreviewState) {
    return runtimeHooks.getActionRollPreviewState(game);
  }
  return null;
}

/* [HAUNT-ACTION] Processes the continue-button press after a completed haunt action roll. */
export function resolveHauntActionRollContinueState(game, { createDamageChoice, rollDice }) {
  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  if (runtimeHooks?.resolveActionRollContinueState) {
    return runtimeHooks.resolveActionRollContinueState(game, { createDamageChoice, rollDice });
  }
  return game;
}
