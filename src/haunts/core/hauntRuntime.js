import { GAME_PHASES, HAUNT_TEAMS } from "./hauntPhases";

function createInitialHauntState(game, hauntDefinition) {
  return {
    id: hauntDefinition.id,
    status: "setup",
    startedAtTurn: game.turnNumber,
    teams: {
      [HAUNT_TEAMS.HEROES]: {
        playerIndexes: game.players.map((_, index) => index),
      },
      [HAUNT_TEAMS.TRAITOR]: {
        playerIndexes: [],
      },
      [HAUNT_TEAMS.MONSTERS]: {
        actors: [],
      },
    },
    tokens: [],
    objectives: {
      heroes: hauntDefinition.objectives?.heroes || "",
      traitor: hauntDefinition.objectives?.traitor || "",
    },
    oncePerTurnUsage: {},
    oncePerGameUsage: {},
    scenarioState: {},
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
