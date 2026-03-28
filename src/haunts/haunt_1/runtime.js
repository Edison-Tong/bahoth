import { GAME_PHASES, HAUNT_TEAMS } from "../core/hauntPhases";

const JACKS_SPIRIT_SPEED_DICE = 3;

export function createInitialScenarioState() {
  return {
    traitorCorpsePosition: null,
    jacksSpiritActorId: "jacks-spirit",
    revealedKnowledgeOfJackHolders: [],
    exorcismTokenPlacements: [],
    jacksSpirit: {
      active: false,
      floor: null,
      x: null,
      y: null,
      movesLeft: 0,
      speedRoll: [],
      speedTotal: 0,
    },
  };
}

function getCurrentPlayer(game) {
  return game.players[game.currentPlayerIndex] || null;
}

function getCurrentTile(game) {
  const player = getCurrentPlayer(game);
  if (!player) return null;
  return (game.board[player.floor] || []).find((tile) => tile.x === player.x && tile.y === player.y) || null;
}

function markHauntActionUsed(hauntState, actionKey) {
  return {
    ...hauntState,
    oncePerTurnUsage: {
      ...(hauntState.oncePerTurnUsage || {}),
      [actionKey]: true,
    },
  };
}

function createUsageKey(game, actionId) {
  return `${game.turnNumber}:${game.currentPlayerIndex}:${actionId}`;
}

function getScenarioState(hauntState) {
  const scenarioState = hauntState?.scenarioState || {};
  const defaults = createInitialScenarioState();
  return {
    ...defaults,
    ...scenarioState,
    revealedKnowledgeOfJackHolders:
      scenarioState.revealedKnowledgeOfJackHolders || defaults.revealedKnowledgeOfJackHolders,
    exorcismTokenPlacements: scenarioState.exorcismTokenPlacements || defaults.exorcismTokenPlacements,
    jacksSpirit: scenarioState.jacksSpirit || defaults.jacksSpirit,
  };
}

export function getCombatActorProxyState(game, actorIndex) {
  if (game.activeHauntId !== "haunt_1" || !game.hauntState) return null;

  const traitorIndex = game.hauntState.traitorPlayerIndex;
  if (actorIndex !== traitorIndex) return null;

  const actor = game.players[actorIndex];
  const spirit = getScenarioState(game.hauntState).jacksSpirit;
  if (actor?.isAlive || !spirit?.active) return null;

  return {
    floor: spirit.floor,
    x: spirit.x,
    y: spirit.y,
    usesMightDiceCount: 5,
  };
}

export function getSpecialMoveOptionsState({ game, currentPlayer, DIR, getTileAt, backtrackPos }) {
  if (game.activeHauntId !== "haunt_1" || game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || !game.hauntState) {
    return null;
  }

  const traitorIndex = game.hauntState.traitorPlayerIndex;
  if (game.currentPlayerIndex !== traitorIndex) return null;

  const proxy = getCombatActorProxyState(game, traitorIndex);
  if (!proxy) return null;

  const spiritMoves = [];
  for (const dir of ["N", "S", "E", "W"]) {
    const { dx, dy } = DIR[dir];
    const nx = currentPlayer.x + dx;
    const ny = currentPlayer.y + dy;
    const neighbor = getTileAt(nx, ny, currentPlayer.floor);
    if (!neighbor) continue;

    const isBacktrack =
      backtrackPos && backtrackPos.x === nx && backtrackPos.y === ny && backtrackPos.floor === currentPlayer.floor;
    if (isBacktrack) {
      spiritMoves.push({ dir, x: nx, y: ny, type: "backtrack" });
    } else if (currentPlayer.movesLeft >= 1) {
      spiritMoves.push({ dir, x: nx, y: ny, type: "move", cost: 1 });
    }
  }

  return spiritMoves;
}

export function getTileTokenLabelsState(game, { floor, x, y }) {
  if (game.activeHauntId !== "haunt_1" || !game.hauntState) return [];

  const scenarioState = getScenarioState(game.hauntState);
  const labels = [];
  if (
    scenarioState.exorcismTokenPlacements.some(
      (placement) => placement.floor === floor && placement.x === x && placement.y === y
    )
  ) {
    labels.push({ label: "Exorcism Circle", variant: "token" });
  }

  const spirit = scenarioState.jacksSpirit;
  if (spirit?.active && spirit.floor === floor && spirit.x === x && spirit.y === y) {
    labels.push({ label: "Jack's Spirit", variant: "monster" });
  }

  return labels;
}

export function getKnowledgeTokenHoldersState(game) {
  if (game.activeHauntId !== "haunt_1" || !game.hauntState) return [];
  return getScenarioState(game.hauntState).revealedKnowledgeOfJackHolders;
}

export function getActionAvailabilityState(game, { hauntActionLocked }) {
  if (game.activeHauntId !== "haunt_1" || game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || !game.hauntState) {
    return {
      learnAboutJack: false,
      studyExorcism: false,
      exorciseJacksSpirit: false,
      stalkPrey: false,
    };
  }

  const isTraitorTurn = game.hauntState.traitorPlayerIndex === game.currentPlayerIndex;
  return {
    learnAboutJack: !isTraitorTurn && !hauntActionLocked,
    studyExorcism: !isTraitorTurn && !hauntActionLocked,
    exorciseJacksSpirit: !isTraitorTurn && !hauntActionLocked,
    stalkPrey: isTraitorTurn && !hauntActionLocked,
  };
}

export function getActionButtonsState(game, context) {
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

export function resolveActionState(game, { actionId, resolveTraitRoll, createDamageChoice }) {
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

  return game;
}

function isHero(game, playerIndex) {
  return playerIndex !== game.hauntState?.traitorPlayerIndex;
}

function getHeroIndexes(game) {
  return game.hauntState?.teams?.[HAUNT_TEAMS.HEROES]?.playerIndexes || [];
}

function applyPhysicalDamageOne(players, playerIndex) {
  return players.map((player, index) => {
    if (index !== playerIndex) return player;
    const nextMight = Math.max(0, player.statIndex.might - 1);
    const nextStatIndex = {
      ...player.statIndex,
      might: nextMight,
    };
    return {
      ...player,
      statIndex: nextStatIndex,
      isAlive: Object.values(nextStatIndex).every((value) => value > 0),
    };
  });
}

function hasLineOfSightSimple(game, fromIndex, targetIndex) {
  const from = game.players[fromIndex];
  const target = game.players[targetIndex];
  if (!from || !target || !target.isAlive) return false;
  if (from.floor !== target.floor) return false;
  return from.x === target.x || from.y === target.y;
}

function getFarthestOmenTileFrom(board, origin) {
  const omenTiles = Object.entries(board).flatMap(([floor, tiles]) =>
    (tiles || [])
      .filter((tile) => tile.cardType === "omen")
      .map((tile) => ({
        floor,
        x: tile.x,
        y: tile.y,
        name: tile.name,
      }))
  );
  if (omenTiles.length === 0) return null;

  const scored = omenTiles.map((tile) => {
    const floorPenalty = tile.floor === origin.floor ? 0 : 6;
    const distance = Math.abs(tile.x - origin.x) + Math.abs(tile.y - origin.y) + floorPenalty;
    return {
      ...tile,
      distance,
    };
  });

  scored.sort((a, b) => b.distance - a.distance || a.name.localeCompare(b.name));
  return scored[0];
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

export function resolveLearnAboutJackState(game, { resolveTraitRoll }) {
  if (game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || game.activeHauntId !== "haunt_1" || !game.hauntState) {
    return game;
  }

  const currentPlayerIndex = game.currentPlayerIndex;
  if (!isHero(game, currentPlayerIndex)) {
    return {
      ...game,
      message: "Only heroes can use Learn about Jack.",
    };
  }

  const currentPlayer = getCurrentPlayer(game);
  if (!currentPlayer?.isAlive) {
    return {
      ...game,
      message: "Dead heroes cannot use Learn about Jack.",
    };
  }

  const currentTile = getCurrentTile(game);
  if (!currentTile || currentTile.id !== "library") {
    return {
      ...game,
      message: "Learn about Jack can only be used in the Library.",
    };
  }

  const usageKey = createUsageKey(game, "learn-about-jack");
  if (game.hauntState.oncePerTurnUsage?.[usageKey]) {
    return {
      ...game,
      message: "Learn about Jack has already been used this turn.",
    };
  }

  const roll = resolveTraitRoll(currentPlayer, {
    stat: "knowledge",
    baseDiceCount: currentPlayer.character.knowledge[currentPlayer.statIndex.knowledge],
    context: "haunt",
    board: game.board,
  });

  let nextHauntState = markHauntActionUsed(game.hauntState, usageKey);
  const scenarioState = getScenarioState(nextHauntState);

  if (roll.total >= 5) {
    const tokenHolders = new Set(scenarioState.revealedKnowledgeOfJackHolders);
    const heroWithoutToken = getHeroIndexes(game).find((playerIndex) => !tokenHolders.has(playerIndex));

    if (heroWithoutToken == null) {
      return {
        ...game,
        hauntState: nextHauntState,
        message: `${currentPlayer.name} rolled ${roll.total}, but all heroes already have Knowledge of Jack.`,
      };
    }

    tokenHolders.add(heroWithoutToken);
    nextHauntState = {
      ...nextHauntState,
      scenarioState: {
        ...scenarioState,
        revealedKnowledgeOfJackHolders: Array.from(tokenHolders),
      },
    };

    return {
      ...game,
      hauntState: nextHauntState,
      message: `${currentPlayer.name} rolled ${roll.total}. ${game.players[heroWithoutToken].name} gains Knowledge of Jack.`,
    };
  }

  return {
    ...game,
    hauntState: nextHauntState,
    message: `${currentPlayer.name} rolled ${roll.total}. Learn about Jack failed.`,
  };
}

export function resolveStudyExorcismState(game, { resolveTraitRoll, createDamageChoice }) {
  if (game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || game.activeHauntId !== "haunt_1" || !game.hauntState) {
    return game;
  }

  const currentPlayerIndex = game.currentPlayerIndex;
  if (!isHero(game, currentPlayerIndex)) {
    return {
      ...game,
      message: "Only heroes can Study the Exorcism.",
    };
  }

  const currentPlayer = getCurrentPlayer(game);
  if (!currentPlayer?.isAlive) {
    return {
      ...game,
      message: "Dead heroes cannot Study the Exorcism.",
    };
  }

  const currentTile = getCurrentTile(game);
  if (!currentTile || currentTile.cardType !== "event") {
    return {
      ...game,
      message: "Study the Exorcism can only be used on an Event tile.",
    };
  }

  const usageKey = createUsageKey(game, "study-the-exorcism");
  if (game.hauntState.oncePerTurnUsage?.[usageKey]) {
    return {
      ...game,
      message: "Study the Exorcism has already been used this turn.",
    };
  }

  const roll = resolveTraitRoll(currentPlayer, {
    stat: "knowledge",
    baseDiceCount: currentPlayer.character.knowledge[currentPlayer.statIndex.knowledge],
    context: "haunt",
    board: game.board,
  });

  let nextHauntState = markHauntActionUsed(game.hauntState, usageKey);
  const scenarioState = getScenarioState(nextHauntState);

  if (roll.total >= 5) {
    const currentPlacement = {
      floor: currentPlayer.floor,
      x: currentPlayer.x,
      y: currentPlayer.y,
    };
    const alreadyPlacedHere = scenarioState.exorcismTokenPlacements.some(
      (placement) =>
        placement.floor === currentPlacement.floor &&
        placement.x === currentPlacement.x &&
        placement.y === currentPlacement.y
    );

    let nextPlacements = scenarioState.exorcismTokenPlacements;
    let tokenMessage = "";

    if (alreadyPlacedHere) {
      tokenMessage = "Exorcism Circle is already on this tile.";
    } else if (nextPlacements.length < 2) {
      nextPlacements = [...nextPlacements, currentPlacement];
      tokenMessage = "Placed an Exorcism Circle token.";
    } else {
      nextPlacements = [nextPlacements[1], currentPlacement];
      tokenMessage = "Moved an Exorcism Circle token.";
    }

    nextHauntState = {
      ...nextHauntState,
      scenarioState: {
        ...scenarioState,
        exorcismTokenPlacements: nextPlacements,
      },
    };

    return {
      ...game,
      hauntState: nextHauntState,
      message: `${currentPlayer.name} rolled ${roll.total}. ${tokenMessage}`,
    };
  }

  const damageChoice = createDamageChoice(
    {
      damage: 2,
      damageType: "mental",
      sourceName: "Study the Exorcism",
    },
    currentPlayer
  );

  return {
    ...game,
    hauntState: nextHauntState,
    damageChoice,
    message: `${currentPlayer.name} rolled ${roll.total}. Study failed and takes 2 Mental damage.`,
  };
}

export function resolveExorciseJacksSpiritState(game, { resolveTraitRoll }) {
  if (game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || game.activeHauntId !== "haunt_1" || !game.hauntState) {
    return game;
  }

  const currentPlayerIndex = game.currentPlayerIndex;
  if (!isHero(game, currentPlayerIndex)) {
    return {
      ...game,
      message: "Only heroes can Exorcise Jack's Spirit.",
    };
  }

  const currentPlayer = getCurrentPlayer(game);
  if (!currentPlayer?.isAlive) {
    return {
      ...game,
      message: "Dead heroes cannot Exorcise Jack's Spirit.",
    };
  }

  const usageKey = createUsageKey(game, "exorcise-jacks-spirit");
  if (game.hauntState.oncePerTurnUsage?.[usageKey]) {
    return {
      ...game,
      message: "Exorcise Jack's Spirit has already been used this turn.",
    };
  }

  const scenarioState = getScenarioState(game.hauntState);
  const spirit = scenarioState.jacksSpirit;
  if (!spirit?.active) {
    return {
      ...game,
      message: "Jack's Spirit is not on the board.",
    };
  }

  const sameTile = currentPlayer.floor === spirit.floor && currentPlayer.x === spirit.x && currentPlayer.y === spirit.y;
  if (!sameTile) {
    return {
      ...game,
      message: "You must stand on Jack's Spirit tile to exorcise it.",
    };
  }

  const exorcismBonus = scenarioState.exorcismTokenPlacements.filter(
    (placement) => placement.floor === currentPlayer.floor
  ).length;
  const roll = resolveTraitRoll(currentPlayer, {
    stat: "sanity",
    baseDiceCount: currentPlayer.character.sanity[currentPlayer.statIndex.sanity],
    context: "haunt",
    board: game.board,
  });
  const total = roll.total + exorcismBonus;

  let nextHauntState = markHauntActionUsed(game.hauntState, usageKey);

  if (total >= 7) {
    nextHauntState = {
      ...nextHauntState,
      scenarioState: {
        ...scenarioState,
        jacksSpirit: {
          ...spirit,
          active: false,
          movesLeft: 0,
          speedRoll: [],
          speedTotal: 0,
        },
      },
    };

    return {
      ...game,
      hauntState: nextHauntState,
      gamePhase: GAME_PHASES.GAME_OVER,
      message: `${currentPlayer.name} rolled ${roll.total} + ${exorcismBonus} = ${total}. Jack's Spirit is exorcised. Heroes win!`,
    };
  }

  let nextPlayers = game.players;
  for (const heroIndex of getHeroIndexes(game)) {
    if (!nextPlayers[heroIndex]?.isAlive) continue;
    nextPlayers = applyPhysicalDamageOne(nextPlayers, heroIndex);
  }

  return {
    ...game,
    players: nextPlayers,
    hauntState: nextHauntState,
    message: `${currentPlayer.name} rolled ${roll.total} + ${exorcismBonus} = ${total}. Exorcism failed. Each hero takes 1 Physical damage.`,
  };
}

export function resolveStalkPreyState(game) {
  if (game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || game.activeHauntId !== "haunt_1" || !game.hauntState) {
    return game;
  }

  const traitorIndex = game.hauntState.traitorPlayerIndex;
  if (game.currentPlayerIndex !== traitorIndex) {
    return {
      ...game,
      message: "Only the traitor can use Stalk the Prey.",
    };
  }
  if (game.hasAttackedThisTurn) {
    return {
      ...game,
      message: "Stalk the Prey cannot be used after attacking.",
    };
  }

  const usageKey = createUsageKey(game, "stalk-prey");
  if (game.hauntState.oncePerTurnUsage?.[usageKey]) {
    return {
      ...game,
      message: "Stalk the Prey has already been used this turn.",
    };
  }

  const heroIndexes = getHeroIndexes(game).filter((index) => game.players[index]?.isAlive);
  const heroInSight = heroIndexes.some((heroIndex) => hasLineOfSightSimple(game, traitorIndex, heroIndex));
  if (heroInSight) {
    return {
      ...game,
      message: "A hero is in line of sight. Stalk the Prey cannot be used.",
    };
  }

  const candidateTiles = Object.entries(game.board)
    .filter(([floor]) => floor === "upper" || floor === "ground")
    .flatMap(([floor, tiles]) =>
      (tiles || []).map((tile) => ({
        floor,
        x: tile.x,
        y: tile.y,
        name: tile.name,
      }))
    )
    .filter(
      (tile) =>
        !heroIndexes.some((heroIndex) => {
          const hero = game.players[heroIndex];
          if (!hero || !hero.isAlive) return false;
          if (hero.floor !== tile.floor) return false;
          return hero.x === tile.x || hero.y === tile.y;
        })
    );

  if (candidateTiles.length === 0) {
    return {
      ...game,
      message: "No valid tile to stalk to.",
    };
  }

  const destination = candidateTiles[0];
  const nextPlayers = game.players.map((player, index) =>
    index === traitorIndex
      ? {
          ...player,
          floor: destination.floor,
          x: destination.x,
          y: destination.y,
        }
      : player
  );

  return {
    ...game,
    players: nextPlayers,
    movePath: [{ x: destination.x, y: destination.y, floor: destination.floor, cost: 0 }],
    hauntState: markHauntActionUsed(game.hauntState, usageKey),
    message: `${game.players[traitorIndex].name} stalks the prey to ${destination.name}.`,
  };
}

export function resolveAfterDamageState(previousGame, nextGame) {
  if (nextGame.activeHauntId !== "haunt_1" || !nextGame.hauntState) return nextGame;

  const traitorIndex = nextGame.hauntState.traitorPlayerIndex;
  const previousTraitor = previousGame.players[traitorIndex];
  const nextTraitor = nextGame.players[traitorIndex];
  if (!previousTraitor || !nextTraitor) return nextGame;
  if (!previousTraitor.isAlive || nextTraitor.isAlive) return nextGame;

  const corpse = {
    floor: previousTraitor.floor,
    x: previousTraitor.x,
    y: previousTraitor.y,
  };
  const spawnTile = getFarthestOmenTileFrom(nextGame.board, corpse);
  if (!spawnTile) return nextGame;

  const scenarioState = getScenarioState(nextGame.hauntState);
  return {
    ...nextGame,
    hauntState: {
      ...nextGame.hauntState,
      scenarioState: {
        ...scenarioState,
        traitorCorpsePosition: corpse,
        jacksSpirit: {
          ...scenarioState.jacksSpirit,
          active: true,
          floor: spawnTile.floor,
          x: spawnTile.x,
          y: spawnTile.y,
          movesLeft: 0,
          speedRoll: [],
          speedTotal: 0,
        },
      },
    },
    message: `${nextTraitor.name} dies. Jack's Spirit appears at ${spawnTile.name}.`,
  };
}

function rollSpiritSpeed(rollDice) {
  const dice = rollDice(JACKS_SPIRIT_SPEED_DICE);
  const total = dice.reduce((sum, value) => sum + value, 0);
  return {
    dice,
    total,
    moves: Math.max(1, total),
  };
}

export function resolveTurnStartState(game, { rollDice }) {
  if (game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || game.activeHauntId !== "haunt_1" || !game.hauntState) {
    return game;
  }

  const traitorIndex = game.hauntState.traitorPlayerIndex;
  if (game.currentPlayerIndex !== traitorIndex) return game;

  const traitor = game.players[traitorIndex];
  const scenarioState = getScenarioState(game.hauntState);
  const spirit = scenarioState.jacksSpirit;
  if (traitor?.isAlive || !spirit?.active) return game;

  const corpse = scenarioState.traitorCorpsePosition;
  const onCorpse = corpse && spirit.floor === corpse.floor && spirit.x === corpse.x && spirit.y === corpse.y;
  if (onCorpse) {
    const healedTraitor = healAllTraits({
      ...traitor,
      floor: corpse.floor,
      x: corpse.x,
      y: corpse.y,
    });
    const speed = healedTraitor.character.speed[healedTraitor.statIndex.speed];
    const nextPlayers = game.players.map((player, index) =>
      index === traitorIndex
        ? {
            ...healedTraitor,
            movesLeft: speed,
          }
        : player
    );

    return {
      ...game,
      players: nextPlayers,
      movePath: [{ x: corpse.x, y: corpse.y, floor: corpse.floor, cost: 0 }],
      hauntState: {
        ...game.hauntState,
        scenarioState: {
          ...scenarioState,
          jacksSpirit: {
            ...spirit,
            active: false,
            movesLeft: 0,
            speedRoll: [],
            speedTotal: 0,
          },
        },
      },
      message: `${traitor.name} reforms at the corpse. Jack's Spirit is removed.`,
    };
  }

  const speedRoll = rollSpiritSpeed(rollDice);
  const nextPlayers = game.players.map((player, index) =>
    index === traitorIndex
      ? {
          ...player,
          floor: spirit.floor,
          x: spirit.x,
          y: spirit.y,
          movesLeft: speedRoll.moves,
        }
      : player
  );

  return {
    ...game,
    players: nextPlayers,
    movePath: [{ x: spirit.x, y: spirit.y, floor: spirit.floor, cost: 0 }],
    hauntState: {
      ...game.hauntState,
      scenarioState: {
        ...scenarioState,
        jacksSpirit: {
          ...spirit,
          movesLeft: speedRoll.moves,
          speedRoll: speedRoll.dice,
          speedTotal: speedRoll.total,
        },
      },
    },
    message: `Jack's Spirit rolls ${speedRoll.dice.join(", ")} (${speedRoll.total}) and may move ${speedRoll.moves} tile${
      speedRoll.moves !== 1 ? "s" : ""
    } this turn.`,
  };
}

export function getCombatKnowledgeBonus(game, actorIndex, defenderIndex) {
  if (game.activeHauntId !== "haunt_1" || !game.hauntState) return 0;

  const traitorIndex = game.hauntState.traitorPlayerIndex;
  const actorIsHero = actorIndex !== traitorIndex;
  if (!actorIsHero) return 0;

  const scenarioState = getScenarioState(game.hauntState);
  const hasKnowledgeToken = scenarioState.revealedKnowledgeOfJackHolders.includes(actorIndex);
  if (!hasKnowledgeToken) return 0;

  return defenderIndex === traitorIndex ? 2 : 0;
}
