import { GAME_PHASES, HAUNT_TEAMS } from "./hauntPhases";
import { getHauntRuntimeHooksById } from "../registry";

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

export function beginHauntAfterRulesViewState(game) {
  if (game.gamePhase !== GAME_PHASES.HAUNT_SETUP) return game;
  const rulesStep = game.hauntState?.rulesView?.step;
  if (rulesStep !== "traitor-rules" && !game.hauntState?.rulesView?.completed) return game;

  const desiredFirstPlayer =
    game.hauntState.firstPlayerAfterSetup ?? (game.hauntState.traitorPlayerIndex + 1) % game.players.length;
  const firstPlayer = game.players[desiredFirstPlayer] || game.players[0];
  if (!firstPlayer) return game;

  const firstPlayerSpeed = firstPlayer.character.speed[firstPlayer.statIndex.speed];
  const playersWithMoves = game.players.map((player, index) => ({
    ...player,
    movesLeft: index === desiredFirstPlayer ? firstPlayerSpeed : 0,
  }));

  return {
    ...game,
    players: playersWithMoves,
    currentPlayerIndex: desiredFirstPlayer,
    gamePhase: GAME_PHASES.HAUNT_ACTIVE,
    turnPhase: "move",
    movePath: [{ x: firstPlayer.x, y: firstPlayer.y, floor: firstPlayer.floor, cost: 0 }],
    hauntState: {
      ...game.hauntState,
      status: "active",
      rulesView: {
        ...game.hauntState.rulesView,
        step: "completed",
        completed: true,
      },
    },
    message: `${firstPlayer.name} begins the haunt.`,
  };
}

function getTraitorPhysicalBonus(hauntDefinition, playerCount) {
  if (!hauntDefinition?.scaling?.traitorPhysicalBonusByPlayerCount) return 0;
  return hauntDefinition.scaling.traitorPhysicalBonusByPlayerCount[playerCount] || 0;
}

function healAllTraits(player) {
  const nextStatIndex = {
    might: Math.max(player.statIndex.might, player.character?.startIndex?.might ?? player.statIndex.might),
    speed: Math.max(player.statIndex.speed, player.character?.startIndex?.speed ?? player.statIndex.speed),
    sanity: Math.max(player.statIndex.sanity, player.character?.startIndex?.sanity ?? player.statIndex.sanity),
    knowledge: Math.max(player.statIndex.knowledge, player.character?.startIndex?.knowledge ?? player.statIndex.knowledge),
  };
  return {
    ...player,
    statIndex: nextStatIndex,
    isAlive: true,
  };
}

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

  return {
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
    hauntState: {
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
    },
    message: `${firstPlayer.name} takes the first hero turn. The haunt is active.`,
  };
}

export function resolveHauntAfterDamageState(previousGame, nextGame) {
  const runtimeHooks = getHauntRuntimeHooksById(nextGame.activeHauntId);
  if (runtimeHooks?.resolveAfterDamageState) {
    return runtimeHooks.resolveAfterDamageState(previousGame, nextGame);
  }
  return nextGame;
}

export function resolveHauntAfterMovementState(previousGame, nextGame) {
  const runtimeHooks = getHauntRuntimeHooksById(nextGame.activeHauntId);
  if (runtimeHooks?.resolveAfterMovementState) {
    return runtimeHooks.resolveAfterMovementState(previousGame, nextGame);
  }
  return nextGame;
}

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

export function getHauntCombatBonus(game, actorIndex, defenderIndex) {
  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  if (runtimeHooks?.getCombatBonus) {
    return runtimeHooks.getCombatBonus(game, actorIndex, defenderIndex);
  }
  return 0;
}

export function getHauntCombatActorProxyState(game, actorIndex) {
  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  if (runtimeHooks?.getCombatActorProxyState) {
    return runtimeHooks.getCombatActorProxyState(game, actorIndex);
  }
  return null;
}

export function getHauntMovementOptionsState(context) {
  const runtimeHooks = getHauntRuntimeHooksById(context?.game?.activeHauntId);
  if (runtimeHooks?.getSpecialMoveOptionsState) {
    return runtimeHooks.getSpecialMoveOptionsState(context);
  }
  return null;
}

export function getHauntTileTokenLabelsState(game, position) {
  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  if (runtimeHooks?.getTileTokenLabelsState) {
    return runtimeHooks.getTileTokenLabelsState(game, position);
  }
  return [];
}

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

export function getHauntKnowledgeTokenHoldersState(game) {
  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  if (runtimeHooks?.getKnowledgeTokenHoldersState) {
    return runtimeHooks.getKnowledgeTokenHoldersState(game);
  }
  return [];
}

export function getHauntCanDeadPlayerTakeTurnState(game, playerIndex) {
  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  if (runtimeHooks?.canDeadPlayerTakeTurn) {
    return runtimeHooks.canDeadPlayerTakeTurn(game, playerIndex);
  }
  return false;
}

export function getHauntActionButtonsState(game, context) {
  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  if (runtimeHooks?.getActionButtonsState) {
    return runtimeHooks.getActionButtonsState(game, context);
  }

  return [];
}

export function resolveHauntActionState(game, { actionId, resolveTraitRoll, createDamageChoice }) {
  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  if (runtimeHooks?.resolveActionState) {
    return runtimeHooks.resolveActionState(game, { actionId, resolveTraitRoll, createDamageChoice });
  }

  return game;
}

export function getHauntActionRollPreviewState(game) {
  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  if (runtimeHooks?.getActionRollPreviewState) {
    return runtimeHooks.getActionRollPreviewState(game);
  }
  return null;
}

export function resolveHauntActionRollContinueState(game, { createDamageChoice }) {
  const runtimeHooks = getHauntRuntimeHooksById(game.activeHauntId);
  if (runtimeHooks?.resolveActionRollContinueState) {
    return runtimeHooks.resolveActionRollContinueState(game, { createDamageChoice });
  }
  return game;
}
