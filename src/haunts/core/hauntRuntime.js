import { GAME_PHASES, HAUNT_TEAMS } from "./hauntPhases";
import {
  createInitialScenarioState as createInitialHaunt1ScenarioState,
  resolveLearnAboutJackState,
  resolveStudyExorcismState,
  resolveExorciseJacksSpiritState,
  resolveStalkPreyState,
  resolveAfterDamageState,
  resolveTurnStartState,
  getCombatKnowledgeBonus,
  getCombatActorProxyState,
  getSpecialMoveOptionsState,
  getTileTokenLabelsState,
  getActionAvailabilityState,
} from "../haunt_1/runtime";

function createInitialHauntState(game, hauntDefinition, traitorPlayerIndexOverride = null) {
  const defaultTraitorIndex = game.currentPlayerIndex;
  const traitorPlayerIndex = Number.isInteger(traitorPlayerIndexOverride)
    ? Math.max(0, Math.min(game.players.length - 1, traitorPlayerIndexOverride))
    : defaultTraitorIndex;
  const heroPlayerIndexes = game.players.map((_, index) => index).filter((index) => index !== traitorPlayerIndex);
  const firstPlayerAfterSetup = (traitorPlayerIndex + 1) % game.players.length;

  const initialScenarioState = hauntDefinition.id === "haunt_1" ? createInitialHaunt1ScenarioState() : {};

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
  const nextStatIndex = { ...player.statIndex };
  for (const stat of ["might", "speed", "sanity", "knowledge"]) {
    nextStatIndex[stat] = player.character[stat].length - 1;
  }
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

export function resolveHaunt1LearnAboutJackState(game, { resolveTraitRoll }) {
  return resolveLearnAboutJackState(game, { resolveTraitRoll });
}

export function resolveHaunt1StudyExorcismState(game, { resolveTraitRoll, createDamageChoice }) {
  return resolveStudyExorcismState(game, { resolveTraitRoll, createDamageChoice });
}

export function resolveHaunt1ExorciseJacksSpiritState(game, { resolveTraitRoll }) {
  return resolveExorciseJacksSpiritState(game, { resolveTraitRoll });
}

export function resolveHaunt1StalkPreyState(game) {
  return resolveStalkPreyState(game);
}

export function resolveHaunt1AfterDamageState(previousGame, nextGame) {
  return resolveAfterDamageState(previousGame, nextGame);
}

export function resolveHaunt1TurnStartState(game, { rollDice }) {
  return resolveTurnStartState(game, { rollDice });
}

export function getHaunt1CombatKnowledgeBonus(game, actorIndex, defenderIndex) {
  return getCombatKnowledgeBonus(game, actorIndex, defenderIndex);
}

export function getHauntCombatActorProxyState(game, actorIndex) {
  if (game.activeHauntId === "haunt_1") {
    return getCombatActorProxyState(game, actorIndex);
  }
  return null;
}

export function getHauntMovementOptionsState(context) {
  if (context?.game?.activeHauntId === "haunt_1") {
    return getSpecialMoveOptionsState(context);
  }
  return null;
}

export function getHauntTileTokenLabelsState(game, position) {
  if (game.activeHauntId === "haunt_1") {
    return getTileTokenLabelsState(game, position);
  }
  return [];
}

export function getHauntActionAvailabilityState(game, context) {
  if (game.activeHauntId === "haunt_1") {
    return getActionAvailabilityState(game, context);
  }
  return {
    learnAboutJack: false,
    studyExorcism: false,
    exorciseJacksSpirit: false,
    stalkPrey: false,
  };
}

export function getHauntActionButtonsState(game, context) {
  if (game.activeHauntId === "haunt_1") {
    const availability = getActionAvailabilityState(game, context);
    return [
      {
        id: "learn-about-jack",
        label: "Learn about Jack",
        tone: "secondary",
        enabled: availability.learnAboutJack,
      },
      {
        id: "study-exorcism",
        label: "Study Exorcism",
        tone: "secondary",
        enabled: availability.studyExorcism,
      },
      {
        id: "exorcise-jacks-spirit",
        label: "Exorcise Jack's Spirit",
        tone: "danger",
        enabled: availability.exorciseJacksSpirit,
      },
      {
        id: "stalk-prey",
        label: "Stalk Prey",
        tone: "stairs",
        enabled: availability.stalkPrey,
      },
    ].filter((action) => action.enabled);
  }

  return [];
}

export function resolveHauntActionState(game, { actionId, resolveTraitRoll, createDamageChoice }) {
  if (game.activeHauntId === "haunt_1") {
    if (actionId === "learn-about-jack") {
      return resolveLearnAboutJackState(game, { resolveTraitRoll });
    }
    if (actionId === "study-exorcism") {
      return resolveStudyExorcismState(game, { resolveTraitRoll, createDamageChoice });
    }
    if (actionId === "exorcise-jacks-spirit") {
      return resolveExorciseJacksSpiritState(game, { resolveTraitRoll });
    }
    if (actionId === "stalk-prey") {
      return resolveStalkPreyState(game);
    }
  }

  return game;
}
