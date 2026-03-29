import { GAME_PHASES, HAUNT_TEAMS } from "../core/hauntPhases";

const JACKS_SPIRIT_SPEED_DICE = 3;
const STAT_LABELS = {
  might: "Might",
  speed: "Speed",
  sanity: "Sanity",
  knowledge: "Knowledge",
};

export function createInitialScenarioState() {
  return {
    traitorCorpsePosition: null,
    jacksSpiritActorId: "jacks-spirit",
    revealedKnowledgeOfJackHolders: [],
    exorcismTokenPlacements: [],
    pendingChoice: null,
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
    pendingChoice: scenarioState.pendingChoice || defaults.pendingChoice,
    jacksSpirit: scenarioState.jacksSpirit || defaults.jacksSpirit,
  };
}

function formatTileReference(game, placement) {
  const tile = (game.board?.[placement.floor] || []).find(
    (candidate) => candidate.x === placement.x && candidate.y === placement.y
  );
  if (tile?.name) return `${tile.name} (${placement.floor})`;
  return `(${placement.x}, ${placement.y}) ${placement.floor}`;
}

function getKnowledgeEligibleHeroIndexes(game, tokenHolders = []) {
  const holderSet = new Set(tokenHolders);
  return getHeroIndexes(game).filter((playerIndex) => !holderSet.has(playerIndex));
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

  const origin = {
    floor: proxy.floor,
    x: proxy.x,
    y: proxy.y,
  };
  const movesLeft = Number(currentPlayer?.movesLeft) || 0;

  const spiritMoves = [];
  for (const dir of ["N", "S", "E", "W"]) {
    const { dx, dy } = DIR[dir];
    const nx = origin.x + dx;
    const ny = origin.y + dy;
    const neighbor = getTileAt(nx, ny, origin.floor);
    if (!neighbor) continue;

    const isBacktrack =
      backtrackPos && backtrackPos.x === nx && backtrackPos.y === ny && backtrackPos.floor === origin.floor;
    if (isBacktrack) {
      spiritMoves.push({ dir, x: nx, y: ny, type: "backtrack" });
    } else if (movesLeft >= 1) {
      spiritMoves.push({ dir, x: nx, y: ny, type: "move", cost: 1 });
    }
  }

  return spiritMoves;
}

export function getTileTokenLabelsState(game, { floor, x, y }) {
  if (game.activeHauntId !== "haunt_1" || !game.hauntState) return [];

  const scenarioState = getScenarioState(game.hauntState);
  const labels = [];
  const corpse = scenarioState.traitorCorpsePosition;
  if (corpse && corpse.floor === floor && corpse.x === x && corpse.y === y) {
    const traitor = game.players[game.hauntState?.traitorPlayerIndex];
    const corpseLabel = traitor?.name ? `${traitor.name} Corpse` : "Traitor Corpse";
    labels.push({ label: corpseLabel, variant: "corpse" });
  }
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
  const currentPlayer = getCurrentPlayer(game);
  const currentTile = getCurrentTile(game);
  const scenarioState = getScenarioState(game.hauntState);
  if (scenarioState.pendingChoice) {
    return {
      learnAboutJack: false,
      studyExorcism: false,
      exorciseJacksSpirit: false,
      stalkPrey: false,
    };
  }

  const spirit = scenarioState.jacksSpirit;
  const onSpiritTile =
    !!currentPlayer &&
    !!spirit?.active &&
    currentPlayer.floor === spirit.floor &&
    currentPlayer.x === spirit.x &&
    currentPlayer.y === spirit.y;
  const onLibrary = !!currentTile && currentTile.id === "library";
  const onEventTile = !!currentTile && currentTile.cardType === "event";
  const canUseHeroAction = !isTraitorTurn && !!currentPlayer?.isAlive && !hauntActionLocked;
  const knowledgeTokenHolders = scenarioState.revealedKnowledgeOfJackHolders.slice(0, 2);
  const canGainKnowledgeToken =
    knowledgeTokenHolders.length < 2 && getKnowledgeEligibleHeroIndexes(game, knowledgeTokenHolders).length > 0;

  return {
    learnAboutJack: canUseHeroAction && onLibrary && canGainKnowledgeToken,
    studyExorcism: canUseHeroAction && onEventTile,
    exorciseJacksSpirit: canUseHeroAction && onSpiritTile,
    stalkPrey: isTraitorTurn && !hauntActionLocked,
  };
}

export function canDeadPlayerTakeTurn(game, playerIndex) {
  if (game.activeHauntId !== "haunt_1" || !game.hauntState) return false;
  const traitorIndex = game.hauntState.traitorPlayerIndex;
  if (playerIndex !== traitorIndex) return false;
  const traitor = game.players[traitorIndex];
  const spirit = getScenarioState(game.hauntState).jacksSpirit;
  return !traitor?.isAlive && !!spirit?.active;
}

export function getActionButtonsState(game, context) {
  const scenarioState = getScenarioState(game.hauntState);
  const pendingChoice = scenarioState.pendingChoice;
  if (pendingChoice?.type === "assign-knowledge-token") {
    return (pendingChoice.options || []).map((option) => ({
      id: `pending-assign-knowledge:${option.playerIndex}`,
      label: `Give Knowledge of Jack to ${option.label}`,
      tone: "secondary",
      enabled: true,
    }));
  }

  if (pendingChoice?.type === "move-exorcism-token") {
    return (pendingChoice.options || []).map((option) => ({
      id: `pending-move-exorcism:${option.index}`,
      label: `Move Exorcism Circle from ${option.label}`,
      tone: "secondary",
      enabled: true,
    }));
  }

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

export function resolveActionState(game, { actionId }) {
  if (typeof actionId === "string" && actionId.startsWith("pending-assign-knowledge:")) {
    const playerIndex = Number(actionId.replace("pending-assign-knowledge:", ""));
    return resolvePendingAssignKnowledgeState(game, playerIndex);
  }
  if (typeof actionId === "string" && actionId.startsWith("pending-move-exorcism:")) {
    const placementIndex = Number(actionId.replace("pending-move-exorcism:", ""));
    return resolvePendingMoveExorcismState(game, placementIndex);
  }

  if (actionId === "learn-about-jack") {
    return resolveLearnAboutJackState(game);
  }
  if (actionId === "study-exorcism") {
    return resolveStudyExorcismState(game);
  }
  if (actionId === "exorcise-jacks-spirit") {
    return resolveExorciseJacksSpiritState(game);
  }
  if (actionId === "stalk-prey") {
    return resolveStalkPreyState(game);
  }

  return game;
}

function getTraitDiceCount(player, stat) {
  return player?.character?.[stat]?.[player?.statIndex?.[stat]] ?? 0;
}

function getEmptyLastRoll(stat, total = null) {
  return {
    label: STAT_LABELS[stat] || "Trait",
    stat,
    dice: [],
    total,
    modifier: null,
    outcomes: [],
  };
}

function buildPendingActionRoll(game, actionId, stat, options = {}) {
  const currentPlayer = getCurrentPlayer(game);
  if (!currentPlayer) return game;

  const usageKey = options.usageKey || createUsageKey(game, actionId);
  const baseDiceCount = Number.isInteger(options.baseDiceCount)
    ? options.baseDiceCount
    : getTraitDiceCount(currentPlayer, stat);
  const bonus = Number.isFinite(options.bonus) ? options.bonus : 0;
  const threshold = Number.isFinite(options.threshold) ? options.threshold : 0;

  return {
    ...game,
    hauntActionRoll: {
      actionId,
      actorIndex: game.currentPlayerIndex,
      usageKey,
      stat,
      label: STAT_LABELS[stat] || "Trait",
      baseDiceCount,
      threshold,
      bonus,
      forcedTotal: null,
      status: "awaiting-roll",
      lastRoll: getEmptyLastRoll(stat),
    },
  };
}

function getActionRoll(game) {
  return game.hauntActionRoll || null;
}

function getActionRollResult(game) {
  const rollState = getActionRoll(game);
  const rollTotal = Number(rollState?.lastRoll?.total);
  if (!rollState || !Number.isFinite(rollTotal)) return null;

  const bonus = Number(rollState.bonus) || 0;
  const effectiveTotal = rollTotal + bonus;
  return {
    actionId: rollState.actionId,
    stat: rollState.stat,
    rollTotal,
    bonus,
    effectiveTotal,
    threshold: Number(rollState.threshold) || 0,
    success: effectiveTotal >= (Number(rollState.threshold) || 0),
  };
}

export function getActionRollPreviewState(game) {
  if (game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || game.activeHauntId !== "haunt_1") {
    return null;
  }
  const rollResult = getActionRollResult(game);
  if (!rollResult) return null;

  if (rollResult.actionId === "learn-about-jack") {
    return {
      title: "Learn about Jack",
      thresholdLabel: "Need 5+ Knowledge",
      outcomeLabel: rollResult.success ? "Success" : "Failed",
      outcomeDescription: rollResult.success ? "A hero gains Knowledge of Jack." : "No hero gains Knowledge of Jack.",
      totalLabel: `${rollResult.rollTotal}`,
    };
  }

  if (rollResult.actionId === "study-the-exorcism") {
    return {
      title: "Study Exorcism",
      thresholdLabel: "Need 5+ Knowledge",
      outcomeLabel: rollResult.success ? "Success" : "Failed",
      outcomeDescription: rollResult.success ? "Place or move an Exorcism Circle token." : "Take 2 Mental damage.",
      totalLabel: `${rollResult.rollTotal}`,
    };
  }

  if (rollResult.actionId === "exorcise-jacks-spirit") {
    return {
      title: "Exorcise Jack's Spirit",
      thresholdLabel: "Need 7+ (Sanity + Exorcism bonus)",
      outcomeLabel: rollResult.success ? "Success" : "Failed",
      outcomeDescription: rollResult.success
        ? "Jack's Spirit is exorcised and heroes win."
        : "Each living hero takes 1 Physical damage.",
      totalLabel:
        rollResult.bonus > 0
          ? `${rollResult.rollTotal} + ${rollResult.bonus} = ${rollResult.effectiveTotal}`
          : `${rollResult.rollTotal}`,
    };
  }

  return null;
}

function clearHauntActionRoll(game) {
  if (!game.hauntActionRoll) return game;
  return {
    ...game,
    hauntActionRoll: null,
  };
}

function syncSpiritWithTraitorPosition(previousGame, nextGame) {
  if (nextGame.activeHauntId !== "haunt_1" || !nextGame.hauntState) return nextGame;
  const traitorIndex = nextGame.hauntState.traitorPlayerIndex;
  if (nextGame.currentPlayerIndex !== traitorIndex) return nextGame;

  const previousTraitor = previousGame.players?.[traitorIndex];
  const nextTraitor = nextGame.players?.[traitorIndex];
  if (!previousTraitor || !nextTraitor) return nextGame;

  const scenarioState = getScenarioState(nextGame.hauntState);
  const spirit = scenarioState.jacksSpirit;
  if (nextTraitor.isAlive || !spirit?.active) return nextGame;

  const moved =
    previousTraitor.floor !== nextTraitor.floor ||
    previousTraitor.x !== nextTraitor.x ||
    previousTraitor.y !== nextTraitor.y;
  if (!moved && spirit.floor === nextTraitor.floor && spirit.x === nextTraitor.x && spirit.y === nextTraitor.y) {
    return nextGame;
  }

  return {
    ...nextGame,
    hauntState: {
      ...nextGame.hauntState,
      scenarioState: {
        ...scenarioState,
        jacksSpirit: {
          ...spirit,
          floor: nextTraitor.floor,
          x: nextTraitor.x,
          y: nextTraitor.y,
          movesLeft: nextTraitor.movesLeft,
        },
      },
    },
  };
}

export function resolveAfterMovementState(previousGame, nextGame) {
  return syncSpiritWithTraitorPosition(previousGame, nextGame);
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

function _healAllTraits(player) {
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

function restoreStartingTraits(player) {
  const nextStatIndex = {
    might: player.character?.startIndex?.might ?? player.statIndex.might,
    speed: player.character?.startIndex?.speed ?? player.statIndex.speed,
    sanity: player.character?.startIndex?.sanity ?? player.statIndex.sanity,
    knowledge: player.character?.startIndex?.knowledge ?? player.statIndex.knowledge,
  };
  return {
    ...player,
    statIndex: nextStatIndex,
    isAlive: true,
  };
}

function resolvePendingAssignKnowledgeState(game, recipientIndex) {
  if (game.activeHauntId !== "haunt_1" || !game.hauntState) return game;
  const scenarioState = getScenarioState(game.hauntState);
  const pendingChoice = scenarioState.pendingChoice;
  if (pendingChoice?.type !== "assign-knowledge-token") return game;
  if (pendingChoice.actorIndex !== game.currentPlayerIndex) return game;

  const tokenHolders = Array.from(new Set(scenarioState.revealedKnowledgeOfJackHolders)).slice(0, 2);
  if (tokenHolders.length >= 2) {
    return {
      ...game,
      hauntState: {
        ...game.hauntState,
        scenarioState: {
          ...scenarioState,
          pendingChoice: null,
          revealedKnowledgeOfJackHolders: tokenHolders,
        },
      },
      message: "Both Knowledge of Jack tokens are already claimed.",
    };
  }

  const isEligible = (pendingChoice.options || []).some((option) => option.playerIndex === recipientIndex);
  if (!isEligible) return game;

  const nextHolders = [...tokenHolders, recipientIndex].slice(0, 2);
  const actor = game.players[pendingChoice.actorIndex];
  const recipient = game.players[recipientIndex];

  return {
    ...game,
    hauntState: {
      ...game.hauntState,
      scenarioState: {
        ...scenarioState,
        pendingChoice: null,
        revealedKnowledgeOfJackHolders: nextHolders,
      },
    },
    message: `${actor?.name || "Explorer"} gives Knowledge of Jack to ${recipient?.name || "a hero"}.`,
  };
}

function resolvePendingMoveExorcismState(game, placementIndex) {
  if (game.activeHauntId !== "haunt_1" || !game.hauntState) return game;
  const scenarioState = getScenarioState(game.hauntState);
  const pendingChoice = scenarioState.pendingChoice;
  if (pendingChoice?.type !== "move-exorcism-token") return game;
  if (pendingChoice.actorIndex !== game.currentPlayerIndex) return game;

  const sourcePlacement = scenarioState.exorcismTokenPlacements[placementIndex];
  if (!sourcePlacement) return game;

  const target = pendingChoice.targetPlacement;
  if (!target) return game;

  const nextPlacements = scenarioState.exorcismTokenPlacements.map((placement, index) =>
    index === placementIndex ? { ...target } : placement
  );

  const actor = game.players[pendingChoice.actorIndex];
  return {
    ...game,
    hauntState: {
      ...game.hauntState,
      scenarioState: {
        ...scenarioState,
        pendingChoice: null,
        exorcismTokenPlacements: nextPlacements,
      },
    },
    message: `${actor?.name || "Explorer"} moves an Exorcism Circle token.`,
  };
}

export function resolveLearnAboutJackState(game) {
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

  return {
    ...buildPendingActionRoll(game, "learn-about-jack", "knowledge", {
      usageKey,
      threshold: 5,
    }),
    message: `${currentPlayer.name} prepares to Learn about Jack. Roll Knowledge to resolve.`,
  };
}

export function resolveStudyExorcismState(game) {
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

  return {
    ...buildPendingActionRoll(game, "study-the-exorcism", "knowledge", {
      usageKey,
      threshold: 5,
    }),
    message: `${currentPlayer.name} prepares to Study the Exorcism. Roll Knowledge to resolve.`,
  };
}

export function resolveExorciseJacksSpiritState(game) {
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

  return {
    ...buildPendingActionRoll(game, "exorcise-jacks-spirit", "sanity", {
      usageKey,
      threshold: 7,
      bonus: exorcismBonus,
    }),
    message: `${currentPlayer.name} prepares to Exorcise Jack's Spirit. Roll Sanity to resolve.`,
  };
}

export function resolveActionRollContinueState(game, { createDamageChoice }) {
  if (game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || game.activeHauntId !== "haunt_1" || !game.hauntState) {
    return game;
  }

  const actionRoll = getActionRoll(game);
  const rollResult = getActionRollResult(game);
  if (!actionRoll || !rollResult || actionRoll.status !== "rolled-pending-continue") {
    return game;
  }

  const actor = game.players[actionRoll.actorIndex] || getCurrentPlayer(game);
  const actorName = actor?.name || "Explorer";
  const scenarioState = getScenarioState(game.hauntState);
  const nextHauntState = markHauntActionUsed(game.hauntState, actionRoll.usageKey);

  if (rollResult.actionId === "learn-about-jack") {
    if (!rollResult.success) {
      return {
        ...clearHauntActionRoll(game),
        hauntState: nextHauntState,
        message: `${actorName} rolled ${rollResult.rollTotal}. Learn about Jack failed.`,
      };
    }

    const tokenHolders = Array.from(new Set(scenarioState.revealedKnowledgeOfJackHolders)).slice(0, 2);
    const eligibleHeroes = getKnowledgeEligibleHeroIndexes(game, tokenHolders);
    if (tokenHolders.length >= 2 || eligibleHeroes.length === 0) {
      return {
        ...clearHauntActionRoll(game),
        hauntState: nextHauntState,
        message: `${actorName} rolled ${rollResult.rollTotal}, but all heroes already have Knowledge of Jack.`,
      };
    }

    return {
      ...clearHauntActionRoll(game),
      hauntState: {
        ...nextHauntState,
        scenarioState: {
          ...scenarioState,
          pendingChoice: {
            type: "assign-knowledge-token",
            actorIndex: actionRoll.actorIndex,
            options: eligibleHeroes.map((playerIndex) => ({
              playerIndex,
              label: game.players[playerIndex]?.name || `Hero ${playerIndex + 1}`,
            })),
          },
        },
      },
      message: `${actorName} rolled ${rollResult.rollTotal}. Choose a hero to receive Knowledge of Jack.`,
    };
  }

  if (rollResult.actionId === "study-the-exorcism") {
    if (!rollResult.success) {
      const damageChoice = createDamageChoice(
        {
          damage: 2,
          damageType: "mental",
          sourceName: "Study the Exorcism",
        },
        actor
      );
      return {
        ...clearHauntActionRoll(game),
        hauntState: nextHauntState,
        damageChoice,
        message: `${actorName} rolled ${rollResult.rollTotal}. Study failed and takes 2 Mental damage.`,
      };
    }

    const currentPlacement = {
      floor: actor.floor,
      x: actor.x,
      y: actor.y,
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
      return {
        ...clearHauntActionRoll(game),
        hauntState: {
          ...nextHauntState,
          scenarioState: {
            ...scenarioState,
            pendingChoice: {
              type: "move-exorcism-token",
              actorIndex: actionRoll.actorIndex,
              targetPlacement: currentPlacement,
              options: nextPlacements.map((placement, index) => ({
                index,
                label: formatTileReference(game, placement),
              })),
            },
          },
        },
        message: `${actorName} rolled ${rollResult.rollTotal}. Choose which Exorcism Circle to move to this tile.`,
      };
    }

    return {
      ...clearHauntActionRoll(game),
      hauntState: {
        ...nextHauntState,
        scenarioState: {
          ...scenarioState,
          exorcismTokenPlacements: nextPlacements,
        },
      },
      message: `${actorName} rolled ${rollResult.rollTotal}. ${tokenMessage}`,
    };
  }

  if (rollResult.actionId === "exorcise-jacks-spirit") {
    const spirit = scenarioState.jacksSpirit;
    if (rollResult.success) {
      return {
        ...clearHauntActionRoll(game),
        hauntState: {
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
        },
        gamePhase: GAME_PHASES.GAME_OVER,
        message: `${actorName} rolled ${rollResult.rollTotal} + ${rollResult.bonus} = ${rollResult.effectiveTotal}. Jack's Spirit is exorcised. Heroes win!`,
      };
    }

    let nextPlayers = game.players;
    for (const heroIndex of getHeroIndexes(game)) {
      if (!nextPlayers[heroIndex]?.isAlive) continue;
      nextPlayers = applyPhysicalDamageOne(nextPlayers, heroIndex);
    }

    return {
      ...clearHauntActionRoll(game),
      players: nextPlayers,
      hauntState: nextHauntState,
      message: `${actorName} rolled ${rollResult.rollTotal} + ${rollResult.bonus} = ${rollResult.effectiveTotal}. Exorcism failed. Each hero takes 1 Physical damage.`,
    };
  }

  return clearHauntActionRoll(game);
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
  const scenarioState = getScenarioState(game.hauntState);
  const spirit = scenarioState.jacksSpirit;
  const nextScenarioState =
    !game.players[traitorIndex]?.isAlive && spirit?.active
      ? {
          ...scenarioState,
          jacksSpirit: {
            ...spirit,
            floor: destination.floor,
            x: destination.x,
            y: destination.y,
          },
        }
      : scenarioState;

  return {
    ...clearHauntActionRoll(game),
    players: nextPlayers,
    movePath: [{ x: destination.x, y: destination.y, floor: destination.floor, cost: 0 }],
    hauntState: {
      ...markHauntActionUsed(game.hauntState, usageKey),
      scenarioState: nextScenarioState,
    },
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
    return { game, diceAnimation: null };
  }

  const traitorIndex = game.hauntState.traitorPlayerIndex;
  if (game.currentPlayerIndex !== traitorIndex) return { game, diceAnimation: null };

  const traitor = game.players[traitorIndex];
  const scenarioState = getScenarioState(game.hauntState);
  const spirit = scenarioState.jacksSpirit;
  if (traitor?.isAlive || !spirit?.active) return { game, diceAnimation: null };

  const corpse = scenarioState.traitorCorpsePosition;
  const onCorpse = corpse && spirit.floor === corpse.floor && spirit.x === corpse.x && spirit.y === corpse.y;
  if (onCorpse) {
    const healedTraitor = restoreStartingTraits({
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
      game: {
        ...game,
        players: nextPlayers,
        movePath: [{ x: corpse.x, y: corpse.y, floor: corpse.floor, cost: 0 }],
        hauntState: {
          ...game.hauntState,
          scenarioState: {
            ...scenarioState,
            traitorCorpsePosition: null,
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
      },
      diceAnimation: null,
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
          movesLeft: 0,
        }
      : player
  );

  return {
    game: {
      ...game,
      players: nextPlayers,
      movePath: [{ x: spirit.x, y: spirit.y, floor: spirit.floor, cost: 0 }],
      hauntState: {
        ...game.hauntState,
        scenarioState: {
          ...scenarioState,
          jacksSpirit: {
            ...spirit,
            movesLeft: 0,
            speedRoll: [],
            speedTotal: 0,
          },
        },
      },
      message: "Jack's Spirit is rolling for movement...",
    },
    diceAnimation: {
      purpose: "monster-speed-roll",
      final: [...speedRoll.dice],
      display: Array.from({ length: speedRoll.dice.length }, () => Math.floor(Math.random() * 3)),
      settled: false,
      label: "Movement",
      total: speedRoll.total,
      monsterName: "Jack's Spirit",
    },
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
