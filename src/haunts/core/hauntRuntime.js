import { GAME_PHASES, HAUNT_TEAMS } from "./hauntPhases";

function createInitialHauntState(game, hauntDefinition) {
  const traitorPlayerIndex = game.currentPlayerIndex;
  const heroPlayerIndexes = game.players.map((_, index) => index).filter((index) => index !== traitorPlayerIndex);
  const firstPlayerAfterSetup = (traitorPlayerIndex + 1) % game.players.length;

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
    scenarioState: {
      traitorCorpsePosition: null,
      jacksSpiritActorId: "jacks-spirit",
      revealedKnowledgeOfJackHolders: [],
      exorcismTokenPlacements: [],
    },
  };
}

export function startHauntFromTriggerState(game, { selectHauntDefinition }) {
  if (game.gamePhase !== GAME_PHASES.PRE_HAUNT) {
    return game;
  }

  const hauntDefinition = selectHauntDefinition(game);
  if (!hauntDefinition) return game;

  return {
    ...game,
    gamePhase: GAME_PHASES.HAUNT_SETUP,
    hauntTriggered: true,
    activeHauntId: hauntDefinition.id,
    hauntState: createInitialHauntState(game, hauntDefinition),
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
