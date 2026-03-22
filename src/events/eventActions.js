import { advanceEventResolution, getMatchingOutcome } from "./eventEngine";
import { appendEventSummary, describeEventEffects, getEventRollButtonLabel } from "./eventUtils";

const DAMAGE_STATS = {
  physical: ["might", "speed"],
  mental: ["sanity", "knowledge"],
  general: ["might", "speed", "sanity", "knowledge"],
};

const STAT_LABELS = {
  might: "Might",
  speed: "Speed",
  sanity: "Sanity",
  knowledge: "Knowledge",
};
const PLAYER_STAT_ORDER = ["might", "speed", "sanity", "knowledge"];
const CRITICAL_STAT_INDEX = 1;
const DIR = {
  N: { dx: 0, dy: -1 },
  S: { dx: 0, dy: 1 },
  E: { dx: 1, dy: 0 },
  W: { dx: -1, dy: 0 },
};
const OPPOSITE = { N: "S", S: "N", E: "W", W: "E" };

function getLeaveMoveCost(tile) {
  const hasObstacleToken = Array.isArray(tile?.tokens) && tile.tokens.some((token) => token?.type === "obstacle");
  return tile?.obstacle || hasObstacleToken ? 2 : 1;
}

function getTileByPosition(board, floor, x, y) {
  return board?.[floor]?.find((tile) => tile.x === x && tile.y === y) || null;
}

function getTileById(board, id) {
  if (!id) return null;
  for (const floor of ["ground", "upper", "basement"]) {
    const found = board?.[floor]?.find((tile) => tile.id === id);
    if (found) return { ...found, floor };
  }
  return null;
}

function getMovementNeighbors(board, current, options = {}) {
  const { ignoreObstacles = false } = options;
  if (!current) return [];
  const neighbors = [];
  const currentTile = getTileByPosition(board, current.floor, current.x, current.y);
  if (!currentTile) return neighbors;

  const stepCost = ignoreObstacles ? 1 : getLeaveMoveCost(currentTile);

  for (const dir of currentTile.doors || []) {
    const offset = DIR[dir];
    if (!offset) continue;
    const nx = current.x + offset.dx;
    const ny = current.y + offset.dy;
    const neighbor = getTileByPosition(board, current.floor, nx, ny);
    if (!neighbor) continue;
    if (!(neighbor.doors || []).includes(OPPOSITE[dir])) continue;
    neighbors.push({ floor: current.floor, x: nx, y: ny, cost: stepCost });
  }

  if (currentTile.connectsTo) {
    const connected = getTileById(board, currentTile.connectsTo);
    if (connected) {
      neighbors.push({ floor: connected.floor, x: connected.x, y: connected.y, cost: stepCost });
    }
  }

  for (const floor of ["ground", "upper", "basement"]) {
    for (const tile of board?.[floor] || []) {
      if (tile.connectsTo === currentTile.id) {
        neighbors.push({ floor, x: tile.x, y: tile.y, cost: stepCost });
      }
    }
  }

  return neighbors;
}

function computeReachableDistances(board, start, maxDistance, options = {}) {
  const distances = new Map();
  const queue = [{ ...start, distance: 0 }];
  const keyOf = (node) => `${node.floor}:${node.x}:${node.y}`;

  while (queue.length > 0) {
    queue.sort((a, b) => a.distance - b.distance);
    const current = queue.shift();
    const currentKey = keyOf(current);
    const known = distances.get(currentKey);
    if (known !== undefined && known <= current.distance) continue;
    distances.set(currentKey, current.distance);

    for (const neighbor of getMovementNeighbors(board, current, options)) {
      const nextDistance = current.distance + neighbor.cost;
      if (nextDistance > maxDistance) continue;
      const nextKey = keyOf(neighbor);
      const knownNext = distances.get(nextKey);
      if (knownNext !== undefined && knownNext <= nextDistance) continue;
      queue.push({ ...neighbor, distance: nextDistance });
    }
  }

  return distances;
}

export function getDogTradeTargets(game, ownerIndex, maxDistance = 4) {
  const owner = game?.players?.[ownerIndex];
  if (!owner || !owner.isAlive) return [];

  const start = { floor: owner.floor, x: owner.x, y: owner.y };
  const distances = computeReachableDistances(game.board, start, maxDistance, { ignoreObstacles: true });

  return (game.players || [])
    .map((player, playerIndex) => ({ player, playerIndex }))
    .filter(({ player, playerIndex }) => playerIndex !== ownerIndex && player.isAlive)
    .map(({ player, playerIndex }) => {
      const key = `${player.floor}:${player.x}:${player.y}`;
      const distance = distances.get(key);
      if (distance === undefined || distance > maxDistance) return null;
      return {
        playerIndex,
        name: player.name,
        floor: player.floor,
        x: player.x,
        y: player.y,
        distance,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name));
}

export function getDogMoveOptions(game, position, movesLeft) {
  if (!game || !position || !Number.isFinite(movesLeft) || movesLeft <= 0) return [];

  const nextByKey = new Map();
  const neighbors = getMovementNeighbors(game.board, position, { ignoreObstacles: true });

  for (const neighbor of neighbors) {
    const cost = Number(neighbor.cost) || 0;
    if (cost <= 0 || cost > movesLeft) continue;

    const key = `${neighbor.floor}:${neighbor.x}:${neighbor.y}`;
    const previous = nextByKey.get(key);
    if (!previous || cost < previous.cost) {
      nextByKey.set(key, {
        floor: neighbor.floor,
        x: neighbor.x,
        y: neighbor.y,
        cost,
      });
    }
  }

  return Array.from(nextByKey.values()).sort((a, b) => a.cost - b.cost || a.y - b.y || a.x - b.x);
}

function getInventoryCard(game, viewedCard) {
  if (!viewedCard || viewedCard.ownerCollection !== "inventory") return null;
  const owner = game.players[viewedCard.ownerIndex];
  return owner?.inventory?.[viewedCard.ownerCardIndex] || null;
}

function isCreepyDollAvailableThisTurn(game, viewedCard) {
  const inventoryCard = getInventoryCard(game, viewedCard);
  if (!inventoryCard || inventoryCard.id !== "creepy-doll") return false;
  if (inventoryCard.lastActiveAbilityTurnUsed === game.turnNumber) return false;

  const lastRoll = game.eventState?.lastRoll;
  return !!lastRoll && Array.isArray(lastRoll.dice) && Array.isArray(lastRoll.outcomes) && isTraitRollResult(lastRoll);
}

function isTraitRollResult(lastRoll) {
  if (!lastRoll) return false;
  return Object.values(STAT_LABELS).includes(lastRoll.label);
}

function isTraitRollJustMadeContext(game) {
  if (isTraitRollResult(game.eventState?.lastRoll)) return true;

  const awaiting = game.eventState?.awaiting;
  if (awaiting?.type === "trait-roll-sequence-complete") {
    return Array.isArray(awaiting.results) && awaiting.results.length > 0;
  }

  return false;
}

function isLuckyCoinAvailableThisTurn(game, viewedCard) {
  const inventoryCard = getInventoryCard(game, viewedCard);
  if (!inventoryCard || inventoryCard.id !== "lucky-coin") return false;
  if (inventoryCard.lastActiveAbilityTurnUsed === game.turnNumber) return false;

  const awaiting = game.eventState?.awaiting;
  if (awaiting?.type === "trait-roll-sequence-complete" && Array.isArray(awaiting.results)) {
    return awaiting.results.some((result) => Array.isArray(result?.dice) && result.dice.some((value) => value === 0));
  }

  const lastRoll = game.eventState?.lastRoll;
  if (!lastRoll || !Array.isArray(lastRoll.dice) || !Array.isArray(lastRoll.outcomes)) return false;
  if (!isTraitRollResult(lastRoll)) return false;
  return lastRoll.dice.some((value) => value === 0);
}

function isRabbitsFootAvailableThisTurn(game, viewedCard) {
  const inventoryCard = getInventoryCard(game, viewedCard);
  if (!inventoryCard || inventoryCard.id !== "rabbits-foot") return false;
  if (inventoryCard.lastActiveAbilityTurnUsed === game.turnNumber) return false;

  const lastRoll = game.eventState?.lastRoll;
  if (!!lastRoll && Array.isArray(lastRoll.dice) && lastRoll.dice.length > 0 && Array.isArray(lastRoll.outcomes)) {
    return true;
  }

  return (
    game.tileEffect?.type === "skeleton-key-result" &&
    Array.isArray(game.tileEffect?.dice) &&
    game.tileEffect.dice.length > 0
  );
}

function isDogTradeAvailableThisTurn(game, viewedCard) {
  if (!viewedCard || viewedCard.ownerCollection !== "omens") return false;
  const owner = game.players?.[viewedCard.ownerIndex];
  const omenCard = owner?.omens?.[viewedCard.ownerCardIndex];
  if (!owner || !omenCard || omenCard.id !== "dog") return false;
  if (omenCard.lastActiveAbilityTurnUsed === game.turnNumber) return false;

  const targets = getDogTradeTargets(game, viewedCard.ownerIndex, 4);
  if (targets.length === 0) return false;

  const ownerHasItems = (owner.inventory || []).length > 0;
  const anyTargetHasItems = targets.some(({ playerIndex }) => (game.players[playerIndex]?.inventory || []).length > 0);
  return ownerHasItems || anyTargetHasItems;
}

function hasSkeletonKeyWallMoveAvailable(game, viewedCard) {
  const inventoryCard = getInventoryCard(game, viewedCard);
  if (!inventoryCard || inventoryCard.id !== "skeleton-key") return false;

  const owner = game.players[viewedCard.ownerIndex];
  const board = game.board?.[owner?.floor] || [];
  const currentTile = board.find((tile) => tile.x === owner.x && tile.y === owner.y);
  if (!owner || !currentTile) return false;

  const dirs = [
    { name: "N", dx: 0, dy: -1 },
    { name: "S", dx: 0, dy: 1 },
    { name: "E", dx: 1, dy: 0 },
    { name: "W", dx: -1, dy: 0 },
  ];
  const opposite = { N: "S", S: "N", E: "W", W: "E" };

  return dirs.some(({ name, dx, dy }) => {
    const neighbor = board.find((tile) => tile.x === owner.x + dx && tile.y === owner.y + dy);
    if (!neighbor) return false;

    const normalPassage = currentTile.doors?.includes(name) && neighbor.doors?.includes(opposite[name]);
    return !normalPassage;
  });
}

function canUseNormalMovementNow(game, viewedCard) {
  const owner = game.players?.[viewedCard?.ownerIndex];
  if (!owner || !owner.isAlive) return false;

  return (
    game.turnPhase === "move" &&
    !game.pendingExplore &&
    !game.pendingSpecialPlacement &&
    !game.tileEffect &&
    !game.damageChoice &&
    !game.drawnCard &&
    !game.eventState &&
    owner.movesLeft > 0
  );
}

function getTraitRollRequiredUsageState({ game, drawnEventPrimaryAction, queuedTraitRollOverride }) {
  const awaiting = game.eventState?.awaiting;
  const canApplyNow =
    (awaiting?.type === "roll-ready" && awaiting.rollKind === "trait-roll" && awaiting.overrideTotal === undefined) ||
    (awaiting?.type === "trait-roll-sequence-ready" && awaiting.overrideTotal === undefined);
  const canQueueForDrawnEvent =
    game.drawnCard?.type === "event" &&
    drawnEventPrimaryAction?.type === "roll" &&
    drawnEventPrimaryAction?.isTraitRoll &&
    !queuedTraitRollOverride;

  return {
    canApplyNow,
    canQueueForDrawnEvent,
    canUseNow: canApplyNow || canQueueForDrawnEvent,
  };
}

function getMagicCameraUsageState({ game, drawnEventPrimaryAction, queuedTraitRollOverride }) {
  const base = getTraitRollRequiredUsageState({ game, drawnEventPrimaryAction, queuedTraitRollOverride });
  const awaiting = game.eventState?.awaiting;
  const canApplyNow =
    base.canApplyNow &&
    awaiting?.type === "roll-ready" &&
    awaiting.rollKind === "trait-roll" &&
    awaiting.rollStat === "knowledge";
  const canQueueForDrawnEvent =
    base.canQueueForDrawnEvent &&
    drawnEventPrimaryAction?.isTraitRoll &&
    drawnEventPrimaryAction?.rollStat === "knowledge";

  return {
    canApplyNow,
    canQueueForDrawnEvent,
    canUseMagicCameraNow: canApplyNow || canQueueForDrawnEvent,
  };
}

function getBookUsageState({ game, viewedCard, drawnEventPrimaryAction, queuedTraitRollOverride }) {
  const owner = game.players?.[viewedCard?.ownerIndex];
  const omenCard = viewedCard?.ownerCollection === "omens" ? owner?.omens?.[viewedCard.ownerCardIndex] || null : null;
  if (!omenCard || omenCard.id !== "book") {
    return {
      canApplyNow: false,
      canQueueForDrawnEvent: false,
      canUseBookNow: false,
    };
  }
  if (omenCard.lastActiveAbilityTurnUsed === game.turnNumber) {
    return {
      canApplyNow: false,
      canQueueForDrawnEvent: false,
      canUseBookNow: false,
    };
  }

  const base = getTraitRollRequiredUsageState({ game, drawnEventPrimaryAction, queuedTraitRollOverride });
  const awaiting = game.eventState?.awaiting;
  const canApplyNow =
    base.canApplyNow && awaiting?.type === "roll-ready" && awaiting.rollKind === "trait-roll" && !!awaiting.rollStat;
  const canQueueForDrawnEvent = base.canQueueForDrawnEvent && !!drawnEventPrimaryAction?.isTraitRoll;

  return {
    canApplyNow,
    canQueueForDrawnEvent,
    canUseBookNow: canApplyNow || canQueueForDrawnEvent,
  };
}

function getLuckyCoinSequenceRerollOptions(game) {
  const awaiting = game.eventState?.awaiting;
  if (awaiting?.type !== "trait-roll-sequence-complete" || !Array.isArray(awaiting.results)) return [];

  return awaiting.results
    .map((result, index) => ({ result, index }))
    .filter(({ result }) => Array.isArray(result?.dice) && result.dice.some((value) => value === 0))
    .map(({ result, index }) => ({
      value: `sequence:${index}`,
      label: `${STAT_LABELS[result.stat] || result.stat || "Trait"} (${result.total})`,
    }));
}

function getCriticalStats(player) {
  if (!player) return [];
  return PLAYER_STAT_ORDER.filter((stat) => player.statIndex?.[stat] === CRITICAL_STAT_INDEX);
}

function getHealableStats(player, healRule = {}) {
  if (!player) return [];

  const target = healRule.target || healRule.healTarget || "critical";
  let candidateStats;
  if (target === "all") {
    candidateStats = PLAYER_STAT_ORDER;
  } else if (target === "critical") {
    candidateStats = getCriticalStats(player);
  } else if (target === "list") {
    candidateStats = Array.isArray(healRule.stats) ? healRule.stats : [];
  } else {
    candidateStats = [];
  }

  return candidateStats.filter((stat) => {
    const current = player.statIndex?.[stat];
    const start = player.character?.startIndex?.[stat];
    return current !== undefined && start !== undefined && current < start;
  });
}

function getActiveHealRule(viewedCard) {
  const rule = viewedCard?.activeAbilityRule;
  if (!rule) return null;

  if (rule.action === "heal-stats") {
    return {
      target: rule.target || rule.healTarget || "critical",
      stats: Array.isArray(rule.stats) ? rule.stats : undefined,
      consume: rule.consume || "bury-self",
      selfOnly: !!rule.selfOnly,
    };
  }

  if (rule.action === "heal-critical-traits") {
    return {
      target: "critical",
      consume: "bury-self",
    };
  }

  if (rule.action === "heal-knowledge-sanity") {
    return {
      target: "list",
      stats: ["knowledge", "sanity"],
      consume: "bury-self",
      selfOnly: true,
    };
  }

  if (rule.action === "heal-might-speed") {
    return {
      target: "list",
      stats: ["might", "speed"],
      consume: "bury-self",
      selfOnly: true,
    };
  }

  return null;
}

function canUseHealAbilityNow(game, viewedCard) {
  const inventoryCard = getInventoryCard(game, viewedCard);
  if (!inventoryCard) return false;
  const healRule = getActiveHealRule(viewedCard);
  if (!healRule) return false;

  return getHealTargetIndexes(game, viewedCard, healRule).length > 0;
}

function getHealTargetIndexes(game, viewedCard, healRule) {
  const owner = game.players[viewedCard.ownerIndex];
  if (!owner) return [];

  if (healRule?.selfOnly) {
    const ownerStats = getHealableStats(owner, healRule);
    return ownerStats.length > 0 ? [viewedCard.ownerIndex] : [];
  }

  return game.players
    .map((player, index) => ({ player, index }))
    .filter(({ player }) => player.isAlive)
    .filter(
      ({ player }) =>
        player.floor === owner.floor &&
        player.x === owner.x &&
        player.y === owner.y &&
        getHealableStats(player, healRule).length > 0
    )
    .map(({ index }) => index);
}

function getHealTargetOptions(game, viewedCard, healRule) {
  return getHealTargetIndexes(game, viewedCard, healRule).map((index) => ({
    value: index,
    label: game.players[index]?.name || `Player ${index + 1}`,
  }));
}

export function continueEventState(g, deps) {
  const { runAdvanceEventResolution, finalizeEventState } = deps;
  if (!g.eventState) return { game: g, cameraFloor: null };

  if (g.eventState.awaiting?.type === "trait-roll-sequence-complete") {
    const results = g.eventState.awaiting.results || [];
    const allSucceeded = results.every((entry) => !entry.failed);
    const rewardOutcome = allSucceeded
      ? (g.eventState.awaiting.outcomes || []).find((outcome) => outcome.when?.allRolls?.min !== undefined)
      : null;

    const resumed = runAdvanceEventResolution({
      ...g,
      eventState: {
        ...g.eventState,
        awaiting: null,
        summary: null,
        pendingEffects: [...(rewardOutcome?.effects || [])],
      },
    });
    return { game: resumed.game, cameraFloor: resumed.cameraFloor || null };
  }

  if (g.eventState.awaiting?.type === "event-damage-sequence-complete") {
    const resolvedEffects = g.eventState.awaiting.results || [];
    const hydratedState = {
      ...g,
      eventState: {
        ...g.eventState,
        awaiting: null,
        pendingEffects: [...resolvedEffects, ...(g.eventState.pendingEffects || [])],
      },
    };
    const resumed = runAdvanceEventResolution(hydratedState);
    return { game: resumed.game, cameraFloor: resumed.cameraFloor || null };
  }

  const result = runAdvanceEventResolution({
    ...g,
    eventState: {
      ...g.eventState,
      summary: null,
      lastRoll: null,
    },
  });
  const pendingEventState = result.game.eventState;
  if (
    pendingEventState &&
    !pendingEventState.awaiting &&
    (!pendingEventState.pendingEffects || pendingEventState.pendingEffects.length === 0) &&
    !pendingEventState.summary &&
    !pendingEventState.lastRoll
  ) {
    return {
      game: finalizeEventState(result.game, result.game.message || `${pendingEventState.card.name} resolved.`).game,
      cameraFloor: result.cameraFloor || null,
    };
  }

  return { game: result.game, cameraFloor: result.cameraFloor || null };
}

export function adjustEventRollTotalState(g, delta, deps) {
  const { getMatchingOutcome, describeEventEffects } = deps;
  const eventState = g.eventState;
  const lastRoll = eventState?.lastRoll;
  if (!eventState || !lastRoll || !Array.isArray(lastRoll.outcomes)) return g;

  const nextTotal = Math.max(0, (lastRoll.total || 0) + delta);
  const matchedOutcome = getMatchingOutcome(lastRoll.outcomes, nextTotal);
  const resolvedEffects = [...(matchedOutcome?.effects || [])];

  return {
    ...g,
    eventState: {
      ...eventState,
      lastRoll: {
        ...lastRoll,
        total: nextTotal,
      },
      summary: describeEventEffects(resolvedEffects),
      pendingEffects: resolvedEffects,
    },
    message: `${eventState.card.name}: roll adjusted to ${nextTotal}.`,
  };
}

export function eventAwaitingChoiceState(g, value, deps) {
  const { runAdvanceEventResolution, runApplyResolvedEventEffect, resolveRollReadyAwaiting, eventFlowDeps } = deps;

  const immediateAwaiting = g.eventState?.awaiting;
  if (immediateAwaiting?.type === "roll-ready") {
    const rollReady = resolveRollReadyAwaiting(g, immediateAwaiting, eventFlowDeps);
    return {
      game: rollReady.game,
      cameraFloor: null,
      diceAnimation: rollReady.animation || null,
    };
  }

  if (immediateAwaiting?.type === "trait-roll-sequence-ready") {
    return {
      game: {
        ...g,
        eventState: {
          ...g.eventState,
          awaiting: {
            ...g.eventState.awaiting,
            type: "trait-roll-sequence-rolling",
          },
        },
      },
      cameraFloor: null,
      diceAnimation: null,
    };
  }

  const awaiting = g.eventState?.awaiting;
  if (!awaiting) return { game: g, cameraFloor: null, diceAnimation: null };

  if (awaiting.type === "choice") {
    const nextState = {
      ...g,
      eventState: {
        ...g.eventState,
        awaiting: null,
        context: {
          ...g.eventState.context,
          choices: {
            ...g.eventState.context.choices,
            [awaiting.stepId]: value,
          },
        },
      },
    };
    const result = runAdvanceEventResolution(nextState);
    return { game: result.game, cameraFloor: result.cameraFloor || null, diceAnimation: null };
  }

  if (awaiting.type === "step-stat-choice") {
    const nextState = {
      ...g,
      eventState: {
        ...g.eventState,
        awaiting: null,
        context: {
          ...g.eventState.context,
          selectedStats: {
            ...g.eventState.context.selectedStats,
            [awaiting.stepKey]: value,
          },
        },
        stepIndex: Math.max(0, g.eventState.stepIndex - 1),
      },
    };
    let result = runAdvanceEventResolution(nextState);
    let nextDiceAnimation = null;
    if (result.game.eventState?.awaiting?.type === "roll-ready") {
      const rollReady = resolveRollReadyAwaiting(result.game, result.game.eventState.awaiting, eventFlowDeps);
      result = {
        ...result,
        game: rollReady.game,
      };
      nextDiceAnimation = rollReady.animation || null;
    }
    return { game: result.game, cameraFloor: result.cameraFloor || null, diceAnimation: nextDiceAnimation };
  }

  if (awaiting.type === "stat-choice") {
    const applied = runApplyResolvedEventEffect(g, awaiting.effect, value);
    const resumed = runAdvanceEventResolution({
      ...applied.game,
      eventState: {
        ...applied.game.eventState,
        awaiting: null,
      },
    });
    return {
      game: resumed.game,
      cameraFloor: applied.cameraFloor || resumed.cameraFloor || null,
      diceAnimation: null,
    };
  }

  if (awaiting.type === "item-choice") {
    const nextPlayers = g.players.map((player, index) =>
      index === g.currentPlayerIndex
        ? { ...player, inventory: player.inventory.filter((_, itemIndex) => itemIndex !== Number(value)) }
        : player
    );
    const resumed = runAdvanceEventResolution({
      ...g,
      players: nextPlayers,
      eventState: {
        ...g.eventState,
        awaiting: null,
      },
    });
    return { game: resumed.game, cameraFloor: resumed.cameraFloor || null, diceAnimation: null };
  }

  return { game: g, cameraFloor: null, diceAnimation: null };
}

export function eventTileChoiceState(g, option, deps) {
  const { getTileAtPosition } = deps;
  const awaiting = g.eventState?.awaiting;
  if (awaiting?.type !== "tile-choice") return { game: g, cameraFloor: null };

  if (awaiting.effect?.type === "move") {
    const tile = getTileAtPosition(g.board, option.x, option.y, option.floor);
    if (!tile) return { game: g, cameraFloor: null };

    return {
      game: {
        ...g,
        players: g.players.map((player, index) =>
          index === g.currentPlayerIndex ? { ...player, x: tile.x, y: tile.y, floor: option.floor } : player
        ),
        movePath: [{ x: tile.x, y: tile.y, floor: option.floor, cost: 0 }],
        eventState: {
          ...g.eventState,
          awaiting: {
            ...awaiting,
            selectedOptionId: option.id,
          },
        },
      },
      cameraFloor: option.floor,
    };
  }

  return {
    game: {
      ...g,
      eventState: {
        ...g.eventState,
        awaiting: {
          ...awaiting,
          selectedOptionId: option.id,
        },
      },
    },
    cameraFloor: option.floor,
  };
}

export function confirmEventTileChoiceState(g, deps) {
  const { getTileAtPosition, runAdvanceEventResolution } = deps;
  const awaiting = g.eventState?.awaiting;
  if (awaiting?.type !== "tile-choice") return { game: g, cameraFloor: null };

  const selectedOption =
    awaiting.options?.find((option) => option.id === awaiting.selectedOptionId) ||
    (awaiting.options?.length === 1 ? awaiting.options[0] : null);
  if (!selectedOption) return { game: g, cameraFloor: null };

  const tile = getTileAtPosition(g.board, selectedOption.x, selectedOption.y, selectedOption.floor);
  if (!tile) return { game: g, cameraFloor: null };

  if (awaiting.effect.type === "move") {
    if (awaiting.source === "item-active-ability") {
      return {
        game: {
          ...g,
          players: g.players.map((player, index) =>
            index === g.currentPlayerIndex ? { ...player, x: tile.x, y: tile.y, floor: selectedOption.floor } : player
          ),
          movePath: [{ x: tile.x, y: tile.y, floor: selectedOption.floor, cost: 0 }],
          eventState: null,
          message: `${g.players[g.currentPlayerIndex].name} uses ${awaiting.sourceName || "Map"} to move to ${selectedOption.label}.`,
        },
        cameraFloor: selectedOption.floor,
      };
    }

    const resumed = runAdvanceEventResolution({
      ...g,
      players: g.players.map((player, index) =>
        index === g.currentPlayerIndex ? { ...player, x: tile.x, y: tile.y, floor: selectedOption.floor } : player
      ),
      movePath: [{ x: tile.x, y: tile.y, floor: selectedOption.floor, cost: 0 }],
      eventState: {
        ...g.eventState,
        awaiting: null,
      },
    });
    return { game: resumed.game, cameraFloor: selectedOption.floor };
  }

  if (awaiting.effect.type === "place-token") {
    const nextBoard = {
      ...g.board,
      [selectedOption.floor]: g.board[selectedOption.floor].map((currentTile) =>
        currentTile.x === tile.x && currentTile.y === tile.y
          ? {
              ...currentTile,
              obstacle: awaiting.effect.token === "obstacle" ? true : currentTile.obstacle,
              tokens:
                awaiting.effect.token === "obstacle"
                  ? currentTile.tokens || []
                  : [...(currentTile.tokens || []), { type: awaiting.effect.token }],
            }
          : currentTile
      ),
    };
    const resumed = runAdvanceEventResolution({
      ...g,
      board: nextBoard,
      eventState: {
        ...g.eventState,
        awaiting: null,
      },
    });
    return { game: resumed.game, cameraFloor: selectedOption.floor };
  }

  return { game: g, cameraFloor: null };
}

export function startEventFromDrawnCardState(
  g,
  { card, initialEventChoice = null, autoRollIfReady = false, queuedTraitRollOverride = null },
  deps
) {
  const { runAdvanceEventResolution, resolveRollReadyAwaiting, eventFlowDeps } = deps;

  const eventGame = {
    ...g,
    drawnCard: null,
    turnPhase: "event",
    eventState: {
      card,
      stepIndex: 0,
      context: {
        choices: {},
        selectedStats: {},
      },
      pendingEffects: [],
      awaiting: null,
      summary: null,
      lastRoll: null,
    },
    message: `${card.name} begins...`,
  };

  const result = runAdvanceEventResolution(eventGame);
  let nextState = result.game;
  let nextCameraFloor = result.cameraFloor || null;
  let nextDiceAnimation = null;
  let shouldClearQueuedTraitRollOverride = false;

  if (initialEventChoice !== null && nextState.eventState?.awaiting?.type === "choice") {
    const choiceStepId = nextState.eventState.awaiting.stepId;
    const choiceApplied = {
      ...nextState,
      eventState: {
        ...nextState.eventState,
        awaiting: null,
        context: {
          ...nextState.eventState.context,
          choices: {
            ...nextState.eventState.context.choices,
            [choiceStepId]: initialEventChoice,
          },
        },
      },
    };
    const choiceResult = runAdvanceEventResolution(choiceApplied);
    nextState = choiceResult.game;
    nextCameraFloor = choiceResult.cameraFloor || nextCameraFloor;
  }

  if (queuedTraitRollOverride) {
    if (queuedTraitRollOverride.kind === "set-total") {
      if (
        nextState.eventState?.awaiting?.type === "roll-ready" &&
        nextState.eventState.awaiting.rollKind === "trait-roll"
      ) {
        nextState = {
          ...nextState,
          eventState: {
            ...nextState.eventState,
            awaiting: {
              ...nextState.eventState.awaiting,
              overrideTotal: Math.max(0, Math.min(8, Number(queuedTraitRollOverride.total))),
            },
          },
        };
        shouldClearQueuedTraitRollOverride = true;
      } else if (nextState.eventState?.awaiting?.type === "trait-roll-sequence-ready") {
        nextState = {
          ...nextState,
          eventState: {
            ...nextState.eventState,
            awaiting: {
              ...nextState.eventState.awaiting,
              overrideTotal: Math.max(0, Math.min(8, Number(queuedTraitRollOverride.total))),
            },
          },
        };
        shouldClearQueuedTraitRollOverride = true;
      }
    }

    if (
      queuedTraitRollOverride.kind === "substitute-stat" &&
      nextState.eventState?.awaiting?.type === "roll-ready" &&
      nextState.eventState.awaiting.rollKind === "trait-roll" &&
      (queuedTraitRollOverride.from === "any" ||
        nextState.eventState.awaiting.rollStat === queuedTraitRollOverride.from)
    ) {
      const currentPlayer = nextState.players[nextState.currentPlayerIndex];
      const targetStat = queuedTraitRollOverride.to;
      const fromStat = nextState.eventState.awaiting.rollStat;
      const nextDiceCount =
        currentPlayer?.character?.[targetStat]?.[currentPlayer?.statIndex?.[targetStat]] ??
        nextState.eventState.awaiting.baseDiceCount;

      nextState = {
        ...nextState,
        eventState: {
          ...nextState.eventState,
          awaiting: {
            ...nextState.eventState.awaiting,
            rollStat: targetStat,
            baseDiceCount: nextDiceCount,
            prompt: `${getEventRollButtonLabel(nextDiceCount)} for ${STAT_LABELS[targetStat] || targetStat}.`,
          },
        },
        message: `${currentPlayer?.name || "Explorer"} uses ${queuedTraitRollOverride.sourceName || "an item"} and will roll ${STAT_LABELS[targetStat] || targetStat} instead of ${STAT_LABELS[fromStat] || fromStat}.`,
      };
      shouldClearQueuedTraitRollOverride = true;
    }
  }

  if (autoRollIfReady && nextState.eventState?.awaiting?.type === "roll-ready") {
    const rollReady = resolveRollReadyAwaiting(nextState, nextState.eventState.awaiting, eventFlowDeps);
    nextState = rollReady.game;
    nextDiceAnimation = rollReady.animation;
  } else if (autoRollIfReady && nextState.eventState?.awaiting?.type === "trait-roll-sequence-ready") {
    nextState = {
      ...nextState,
      eventState: {
        ...nextState.eventState,
        awaiting: {
          ...nextState.eventState.awaiting,
          type: "trait-roll-sequence-rolling",
        },
      },
    };
  }

  return {
    game: nextState,
    cameraFloor: nextCameraFloor,
    diceAnimation: nextDiceAnimation,
    shouldClearQueuedTraitRollOverride,
  };
}

export function resolveEventDamageChoiceState(g, choice, baseState, postDamageMessage, deps) {
  const { runAdvanceEventResolution } = deps;

  if (choice.source === "event-effect") {
    const resumed = runAdvanceEventResolution({
      ...baseState,
      eventState: g.eventState
        ? {
            ...g.eventState,
            awaiting: null,
            summary: null,
            lastRoll: null,
            pendingEffects: [...(g.eventState.pendingEffects || [])],
          }
        : null,
      message: postDamageMessage || g.message,
    });
    return { game: resumed.game, cameraFloor: resumed.cameraFloor || null };
  }

  if (choice.source === "event-stat-choice") {
    const resumed = runAdvanceEventResolution(baseState);
    return { game: resumed.game, cameraFloor: resumed.cameraFloor || null };
  }

  return null;
}

export function getAngelsFeatherUsageState({ game, drawnEventPrimaryAction, queuedTraitRollOverride }) {
  const base = getTraitRollRequiredUsageState({ game, drawnEventPrimaryAction, queuedTraitRollOverride });
  return {
    ...base,
    canUseAngelsFeatherNow: base.canUseNow,
  };
}

const ACTIVE_ABILITY_TRIGGER_HANDLERS = {
  "trait-roll-required": ({ game, viewedCard, drawnEventPrimaryAction, queuedTraitRollOverride }) => {
    const action = viewedCard?.activeAbilityRule?.action;
    if (action === "set-trait-roll-total") {
      return getAngelsFeatherUsageState({ game, drawnEventPrimaryAction, queuedTraitRollOverride })
        .canUseAngelsFeatherNow;
    }
    if (action === "substitute-sanity-for-knowledge") {
      return getMagicCameraUsageState({ game, drawnEventPrimaryAction, queuedTraitRollOverride }).canUseMagicCameraNow;
    }
    if (action === "substitute-knowledge-for-trait") {
      return getBookUsageState({ game, viewedCard, drawnEventPrimaryAction, queuedTraitRollOverride }).canUseBookNow;
    }

    return getTraitRollRequiredUsageState({ game, drawnEventPrimaryAction, queuedTraitRollOverride }).canUseNow;
  },
  "on-your-turn": ({ game, viewedCard }) =>
    viewedCard.ownerIndex === game.currentPlayerIndex && game.turnPhase !== "card" && !game.drawnCard,
  "trait-roll-just-made": ({ game, viewedCard }) =>
    viewedCard.ownerIndex === game.currentPlayerIndex && isTraitRollJustMadeContext(game),
  "die-just-rolled": ({ game, viewedCard }) => {
    const action = viewedCard?.activeAbilityRule?.action;
    if (action === "reroll-one-die") {
      return viewedCard.ownerIndex === game.currentPlayerIndex && isRabbitsFootAvailableThisTurn(game, viewedCard);
    }

    return viewedCard.ownerIndex === game.currentPlayerIndex && !!game.eventState;
  },
  attack: ({ game, viewedCard }) => viewedCard.ownerIndex === game.currentPlayerIndex,
};

export function getCardActiveAbilityState({
  game,
  viewedCard,
  drawnEventPrimaryAction,
  queuedTraitRollOverride = null,
}) {
  if (!viewedCard) return { canUseNow: false, requiresValueSelection: false, valueOptions: [] };

  const rule = viewedCard.activeAbilityRule;
  if (!rule) return { canUseNow: false, requiresValueSelection: false, valueOptions: [] };

  if (viewedCard.ownerCollection !== "inventory" && viewedCard.ownerCollection !== "omens") {
    return { canUseNow: false, requiresValueSelection: false, valueOptions: [] };
  }

  if (viewedCard.ownerIndex !== game.currentPlayerIndex) {
    return { canUseNow: false, requiresValueSelection: false, valueOptions: [] };
  }

  const isTrackingUnconfirmedMovePath =
    game.turnPhase === "move" && Array.isArray(game.movePath) && game.movePath.length > 1;
  if (isTrackingUnconfirmedMovePath) {
    return { canUseNow: false, requiresValueSelection: false, valueOptions: [] };
  }

  const triggerHandler = ACTIVE_ABILITY_TRIGGER_HANDLERS[rule.trigger];
  const triggerSatisfied = triggerHandler
    ? triggerHandler({ game, viewedCard, drawnEventPrimaryAction, queuedTraitRollOverride })
    : false;

  const hasSupportedAction =
    rule.action === "set-trait-roll-total" ||
    rule.action === "reroll-all-trait-dice" ||
    rule.action === "reroll-blank-trait-dice" ||
    rule.action === "reroll-one-die" ||
    rule.action === "holy-symbol-bury-discovered-tile" ||
    rule.action === "dog-remote-trade" ||
    rule.action === "move-through-walls" ||
    rule.action === "substitute-sanity-for-knowledge" ||
    rule.action === "substitute-knowledge-for-trait" ||
    rule.action === "teleport-any-tile" ||
    rule.action === "extra-turn-after-current" ||
    rule.action === "heal-critical-traits" ||
    rule.action === "heal-stats" ||
    rule.action === "heal-knowledge-sanity" ||
    rule.action === "heal-might-speed";
  const healRule = getActiveHealRule(viewedCard);
  const luckyCoinSequenceOptions =
    rule.action === "reroll-blank-trait-dice" ? getLuckyCoinSequenceRerollOptions(game) : [];
  const healTargetOptions =
    rule.action === "heal-critical-traits" ||
    rule.action === "heal-stats" ||
    rule.action === "heal-knowledge-sanity" ||
    rule.action === "heal-might-speed"
      ? getHealTargetOptions(game, viewedCard, healRule || {})
      : [];
  const valueOptions =
    rule.action === "set-trait-roll-total"
      ? rule.valueSelection === "number-0-8"
        ? Array.from({ length: 9 }, (_, value) => value)
        : rule.valueOptions || []
      : rule.action === "heal-critical-traits" ||
          rule.action === "heal-stats" ||
          rule.action === "heal-knowledge-sanity" ||
          rule.action === "heal-might-speed"
        ? healTargetOptions
        : rule.action === "reroll-blank-trait-dice" && luckyCoinSequenceOptions.length > 0
          ? luckyCoinSequenceOptions
          : rule.valueOptions || [];
  const requiresValueSelection =
    rule.action === "set-trait-roll-total" ||
    ((rule.action === "heal-critical-traits" ||
      rule.action === "heal-stats" ||
      rule.action === "heal-knowledge-sanity" ||
      rule.action === "heal-might-speed") &&
      healTargetOptions.length > 1) ||
    (rule.action === "reroll-blank-trait-dice" && luckyCoinSequenceOptions.length > 0);
  const actionSatisfied =
    rule.action === "heal-critical-traits" ||
    rule.action === "heal-stats" ||
    rule.action === "heal-knowledge-sanity" ||
    rule.action === "heal-might-speed"
      ? canUseHealAbilityNow(game, viewedCard)
      : rule.action === "reroll-all-trait-dice"
        ? isCreepyDollAvailableThisTurn(game, viewedCard)
        : rule.action === "reroll-blank-trait-dice"
          ? isLuckyCoinAvailableThisTurn(game, viewedCard)
          : rule.action === "reroll-one-die"
            ? isRabbitsFootAvailableThisTurn(game, viewedCard)
            : rule.action === "holy-symbol-bury-discovered-tile"
              ? game.turnPhase === "rotate" && !!game.pendingExplore && !game.pendingExplore.holySymbolReplacement
              : rule.action === "dog-remote-trade"
                ? isDogTradeAvailableThisTurn(game, viewedCard)
                : rule.action === "move-through-walls"
                  ? canUseNormalMovementNow(game, viewedCard) && hasSkeletonKeyWallMoveAvailable(game, viewedCard)
                  : rule.action === "substitute-sanity-for-knowledge"
                    ? getMagicCameraUsageState({ game, drawnEventPrimaryAction, queuedTraitRollOverride })
                        .canUseMagicCameraNow
                    : rule.action === "substitute-knowledge-for-trait"
                      ? getBookUsageState({ game, viewedCard, drawnEventPrimaryAction, queuedTraitRollOverride })
                          .canUseBookNow
                      : true;

  return {
    canUseNow: triggerSatisfied && hasSupportedAction && actionSatisfied,
    requiresValueSelection,
    valueOptions,
    action: rule.action,
    trigger: rule.trigger,
  };
}

export function applyFirstAidKitNowState(g, viewedCard, targetPlayerIndex = null) {
  if (!viewedCard) return { game: g, closeViewedCard: false, diceAnimation: null };

  const healRule = getActiveHealRule(viewedCard);
  if (!healRule) {
    return { game: g, closeViewedCard: false, diceAnimation: null };
  }
  if (viewedCard.ownerCollection !== "inventory") return { game: g, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.ownerIndex !== g.currentPlayerIndex) return { game: g, closeViewedCard: false, diceAnimation: null };

  const owner = g.players[viewedCard.ownerIndex];
  const inventoryCard = getInventoryCard(g, viewedCard);
  if (!inventoryCard) {
    return { game: g, closeViewedCard: false, diceAnimation: null };
  }

  const healTargetIndexes = getHealTargetIndexes(g, viewedCard, healRule);
  if (healTargetIndexes.length === 0) {
    return { game: g, closeViewedCard: false, diceAnimation: null };
  }

  const resolvedTargetIndex =
    healTargetIndexes.find((index) => index === Number(targetPlayerIndex)) ??
    healTargetIndexes.find((index) => index === viewedCard.ownerIndex) ??
    healTargetIndexes[0];
  const targetPlayer = g.players[resolvedTargetIndex];
  const healableStats = getHealableStats(targetPlayer, healRule);
  if (healableStats.length === 0) {
    return { game: g, closeViewedCard: false, diceAnimation: null };
  }

  const nextPlayers = g.players.map((player, playerIndex) => {
    if (playerIndex !== viewedCard.ownerIndex && playerIndex !== resolvedTargetIndex) return player;

    const nextInventory =
      healRule.consume === "bury-self"
        ? player.inventory.filter((_, cardIndex) => cardIndex !== viewedCard.ownerCardIndex)
        : player.inventory;
    const nextStatIndex = { ...player.statIndex };
    if (playerIndex === resolvedTargetIndex) {
      for (const stat of healableStats) {
        nextStatIndex[stat] = Math.max(nextStatIndex[stat], player.character.startIndex[stat]);
      }
    }
    const isAlive = Object.values(nextStatIndex).every((value) => value > 0);

    return {
      ...player,
      inventory: nextInventory,
      statIndex: nextStatIndex,
      isAlive,
    };
  });

  return {
    game: {
      ...g,
      players: nextPlayers,
      message: `${owner.name} uses ${inventoryCard.name} to heal ${targetPlayer.name}'s ${
        healableStats.length === 1 ? "critical trait" : "critical traits"
      } to starting values.`,
    },
    closeViewedCard: true,
    diceAnimation: null,
  };
}

export function applyMapNowState(g, viewedCard) {
  if (!viewedCard) return { game: g, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.activeAbilityRule?.action !== "teleport-any-tile") {
    return { game: g, closeViewedCard: false, diceAnimation: null };
  }
  if (viewedCard.ownerCollection !== "inventory") return { game: g, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.ownerIndex !== g.currentPlayerIndex) return { game: g, closeViewedCard: false, diceAnimation: null };

  const owner = g.players[viewedCard.ownerIndex];
  const inventoryCard = getInventoryCard(g, viewedCard);
  if (!owner || !inventoryCard || inventoryCard.id !== "map") {
    return { game: g, closeViewedCard: false, diceAnimation: null };
  }

  const options = Object.entries(g.board)
    .flatMap(([floor, tiles]) =>
      (tiles || []).map((tile) => ({
        id: `${floor}:${tile.x}:${tile.y}`,
        label: tile.name || tile.id || `${floor} (${tile.x}, ${tile.y})`,
        x: tile.x,
        y: tile.y,
        floor,
      }))
    )
    .filter((option) => !(option.floor === owner.floor && option.x === owner.x && option.y === owner.y));

  if (options.length === 0) {
    return { game: g, closeViewedCard: false, diceAnimation: null };
  }

  const nextPlayers = g.players.map((player, index) =>
    index === viewedCard.ownerIndex
      ? {
          ...player,
          inventory: player.inventory.filter((_, cardIndex) => cardIndex !== viewedCard.ownerCardIndex),
        }
      : player
  );

  return {
    game: {
      ...g,
      players: nextPlayers,
      eventState: {
        card: {
          id: "item-map-teleport",
          name: inventoryCard.name,
        },
        stepIndex: 0,
        context: {
          choices: {},
          selectedStats: {},
        },
        pendingEffects: [],
        summary: null,
        lastRoll: null,
        awaiting: {
          type: "tile-choice",
          source: "item-active-ability",
          sourceName: inventoryCard.name,
          effect: {
            type: "move",
            destination: "any-tile",
          },
          options,
          selectedOptionId: null,
          prompt: "Choose any discovered tile.",
        },
      },
      message: `${owner.name} uses ${inventoryCard.name}. Choose a destination tile.`,
    },
    closeViewedCard: true,
    diceAnimation: null,
  };
}

export function applyMysticalStopwatchNowState(g, viewedCard) {
  if (!viewedCard) return { game: g, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.activeAbilityRule?.action !== "extra-turn-after-current") {
    return { game: g, closeViewedCard: false, diceAnimation: null };
  }
  if (viewedCard.ownerCollection !== "inventory") return { game: g, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.ownerIndex !== g.currentPlayerIndex) return { game: g, closeViewedCard: false, diceAnimation: null };

  const owner = g.players[viewedCard.ownerIndex];
  const inventoryCard = getInventoryCard(g, viewedCard);
  if (!owner || !inventoryCard || inventoryCard.id !== "mystical-stopwatch") {
    return { game: g, closeViewedCard: false, diceAnimation: null };
  }

  const nextPlayers = g.players.map((player, index) =>
    index === viewedCard.ownerIndex
      ? {
          ...player,
          inventory: player.inventory.filter((_, cardIndex) => cardIndex !== viewedCard.ownerCardIndex),
        }
      : player
  );

  return {
    game: {
      ...g,
      players: nextPlayers,
      extraTurnAfterCurrent: true,
      message: `${owner.name} uses ${inventoryCard.name} and will take another turn after this one.`,
    },
    closeViewedCard: true,
    diceAnimation: null,
  };
}

export function applyCreepyDollNowState(g, viewedCard) {
  if (!viewedCard) return { game: g, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.activeAbilityRule?.action !== "reroll-all-trait-dice") {
    return { game: g, closeViewedCard: false, diceAnimation: null };
  }
  if (viewedCard.ownerCollection !== "inventory") return { game: g, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.ownerIndex !== g.currentPlayerIndex) return { game: g, closeViewedCard: false, diceAnimation: null };
  if (!isCreepyDollAvailableThisTurn(g, viewedCard)) return { game: g, closeViewedCard: false, diceAnimation: null };

  const owner = g.players[viewedCard.ownerIndex];
  const inventoryCard = owner?.inventory?.[viewedCard.ownerCardIndex];
  const lastRoll = g.eventState?.lastRoll;
  if (!inventoryCard || inventoryCard.id !== "creepy-doll" || !lastRoll || !Array.isArray(lastRoll.dice)) {
    return { game: g, closeViewedCard: false, diceAnimation: null };
  }

  const rerolledDice = rollDice(lastRoll.dice.length);
  const previousDiceTotal = (lastRoll.dice || []).reduce((sum, value) => sum + value, 0);
  const staticBonus = (lastRoll.total || 0) - previousDiceTotal;
  const rerolledTotal = rerolledDice.reduce((sum, value) => sum + value, 0) + staticBonus;

  const nextPlayers = g.players.map((player, playerIndex) => {
    if (playerIndex !== viewedCard.ownerIndex) return player;

    const nextInventory = player.inventory.map((card, cardIndex) =>
      cardIndex === viewedCard.ownerCardIndex
        ? {
            ...card,
            lastActiveAbilityTurnUsed: g.turnNumber,
          }
        : card
    );
    const nextStatIndex = {
      ...player.statIndex,
      sanity: Math.max(0, player.statIndex.sanity - 1),
    };
    const isAlive = Object.values(nextStatIndex).every((value) => value > 0);

    return {
      ...player,
      inventory: nextInventory,
      statIndex: nextStatIndex,
      isAlive,
    };
  });

  return {
    game: {
      ...g,
      players: nextPlayers,
      eventState: {
        ...g.eventState,
        summary: null,
      },
      message: `${owner.name} uses Creepy Doll, rerolls the trait roll, and loses 1 Sanity...`,
    },
    closeViewedCard: true,
    diceAnimation: {
      purpose: "event-roll",
      final: rerolledDice,
      display: Array.from({ length: rerolledDice.length }, () => Math.floor(Math.random() * 3)),
      settled: false,
      label: lastRoll.label || "Trait",
      total: rerolledTotal,
      modifier: lastRoll.modifier || null,
      outcomes: [...(lastRoll.outcomes || [])],
    },
  };
}

export function applyMagicCameraNowState(
  g,
  viewedCard,
  { drawnEventPrimaryAction, queuedTraitRollOverride = null } = {}
) {
  if (!viewedCard) return { game: g, closeViewedCard: false, diceAnimation: null, queueTraitRollOverride: undefined };
  if (viewedCard.activeAbilityRule?.action !== "substitute-sanity-for-knowledge") {
    return { game: g, closeViewedCard: false, diceAnimation: null, queueTraitRollOverride: undefined };
  }
  if (viewedCard.ownerCollection !== "inventory") {
    return { game: g, closeViewedCard: false, diceAnimation: null, queueTraitRollOverride: undefined };
  }
  if (viewedCard.ownerIndex !== g.currentPlayerIndex) {
    return { game: g, closeViewedCard: false, diceAnimation: null, queueTraitRollOverride: undefined };
  }

  const usageState = getMagicCameraUsageState({ game: g, drawnEventPrimaryAction, queuedTraitRollOverride });
  if (!usageState.canApplyNow && !usageState.canQueueForDrawnEvent) {
    return { game: g, closeViewedCard: false, diceAnimation: null, queueTraitRollOverride: undefined };
  }

  const owner = g.players[viewedCard.ownerIndex];
  const inventoryCard = getInventoryCard(g, viewedCard);

  if (usageState.canQueueForDrawnEvent && !usageState.canApplyNow) {
    return {
      game: {
        ...g,
        message: `${owner.name} will use ${inventoryCard?.name || "Magic Camera"} on this Knowledge roll.`,
      },
      closeViewedCard: true,
      diceAnimation: null,
      queueTraitRollOverride: {
        kind: "substitute-stat",
        from: "knowledge",
        to: "sanity",
      },
    };
  }

  const awaiting = g.eventState?.awaiting;
  if (!owner || !inventoryCard || !awaiting || awaiting.type !== "roll-ready") {
    return { game: g, closeViewedCard: false, diceAnimation: null, queueTraitRollOverride: undefined };
  }

  const sanityDiceCount = owner.character?.sanity?.[owner.statIndex?.sanity] ?? awaiting.baseDiceCount;
  return {
    game: {
      ...g,
      eventState: {
        ...g.eventState,
        awaiting: {
          ...awaiting,
          rollStat: "sanity",
          baseDiceCount: sanityDiceCount,
          prompt: `${getEventRollButtonLabel(sanityDiceCount)} for ${STAT_LABELS.sanity}.`,
        },
      },
      message: `${owner.name} uses ${inventoryCard.name} and will roll Sanity instead of Knowledge.`,
    },
    closeViewedCard: true,
    diceAnimation: null,
    queueTraitRollOverride: undefined,
  };
}

export function applyBookNowState(g, viewedCard, { drawnEventPrimaryAction, queuedTraitRollOverride = null } = {}) {
  if (!viewedCard) return { game: g, closeViewedCard: false, diceAnimation: null, queueTraitRollOverride: undefined };
  if (viewedCard.activeAbilityRule?.action !== "substitute-knowledge-for-trait") {
    return { game: g, closeViewedCard: false, diceAnimation: null, queueTraitRollOverride: undefined };
  }
  if (viewedCard.ownerCollection !== "omens") {
    return { game: g, closeViewedCard: false, diceAnimation: null, queueTraitRollOverride: undefined };
  }
  if (viewedCard.ownerIndex !== g.currentPlayerIndex) {
    return { game: g, closeViewedCard: false, diceAnimation: null, queueTraitRollOverride: undefined };
  }

  const usageState = getBookUsageState({ game: g, viewedCard, drawnEventPrimaryAction, queuedTraitRollOverride });
  if (!usageState.canApplyNow && !usageState.canQueueForDrawnEvent) {
    return { game: g, closeViewedCard: false, diceAnimation: null, queueTraitRollOverride: undefined };
  }

  const owner = g.players[viewedCard.ownerIndex];
  const omenCard = owner?.omens?.[viewedCard.ownerCardIndex] || null;
  if (!owner || !omenCard) {
    return { game: g, closeViewedCard: false, diceAnimation: null, queueTraitRollOverride: undefined };
  }

  const nextPlayers = g.players.map((player, playerIndex) => {
    if (playerIndex !== viewedCard.ownerIndex) return player;

    return {
      ...player,
      omens: player.omens.map((card, cardIndex) =>
        cardIndex === viewedCard.ownerCardIndex
          ? {
              ...card,
              lastActiveAbilityTurnUsed: g.turnNumber,
            }
          : card
      ),
      statIndex: {
        ...player.statIndex,
        sanity: Math.max(0, player.statIndex.sanity - 1),
      },
    };
  });

  const nextOwner = nextPlayers[viewedCard.ownerIndex];
  const ownerKnowledgeDice =
    nextOwner?.character?.knowledge?.[nextOwner?.statIndex?.knowledge] ?? g.eventState?.awaiting?.baseDiceCount;

  if (usageState.canQueueForDrawnEvent && !usageState.canApplyNow) {
    return {
      game: {
        ...g,
        players: nextPlayers,
        message: `${owner.name} uses ${omenCard.name}, loses 1 Sanity, and will roll Knowledge for the next trait roll.`,
      },
      closeViewedCard: true,
      diceAnimation: null,
      queueTraitRollOverride: {
        kind: "substitute-stat",
        from: "any",
        to: "knowledge",
        sourceName: omenCard.name,
      },
    };
  }

  const awaiting = g.eventState?.awaiting;
  if (!awaiting || awaiting.type !== "roll-ready" || awaiting.rollKind !== "trait-roll" || !awaiting.rollStat) {
    return { game: g, closeViewedCard: false, diceAnimation: null, queueTraitRollOverride: undefined };
  }

  return {
    game: {
      ...g,
      players: nextPlayers,
      eventState: {
        ...g.eventState,
        awaiting: {
          ...awaiting,
          rollStat: "knowledge",
          baseDiceCount: ownerKnowledgeDice,
          prompt: `${getEventRollButtonLabel(ownerKnowledgeDice)} for ${STAT_LABELS.knowledge}.`,
        },
      },
      message: `${owner.name} uses ${omenCard.name}, loses 1 Sanity, and will roll Knowledge instead of ${STAT_LABELS[awaiting.rollStat] || awaiting.rollStat}.`,
    },
    closeViewedCard: true,
    diceAnimation: null,
    queueTraitRollOverride: undefined,
  };
}

export function applyLuckyCoinNowState(g, viewedCard, targetRollSelection = null) {
  if (!viewedCard) return { game: g, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.activeAbilityRule?.action !== "reroll-blank-trait-dice") {
    return { game: g, closeViewedCard: false, diceAnimation: null };
  }
  if (viewedCard.ownerCollection !== "inventory") return { game: g, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.ownerIndex !== g.currentPlayerIndex) return { game: g, closeViewedCard: false, diceAnimation: null };
  if (!isLuckyCoinAvailableThisTurn(g, viewedCard)) return { game: g, closeViewedCard: false, diceAnimation: null };

  const owner = g.players[viewedCard.ownerIndex];
  const inventoryCard = getInventoryCard(g, viewedCard);
  if (!inventoryCard) {
    return { game: g, closeViewedCard: false, diceAnimation: null };
  }

  const awaiting = g.eventState?.awaiting;
  const sequenceOptions = getLuckyCoinSequenceRerollOptions(g);
  const sequenceTargetValue = String(targetRollSelection || "");
  const resolvedSequenceTarget =
    sequenceOptions.find((option) => option.value === sequenceTargetValue) ||
    (sequenceOptions.length > 0 && awaiting?.type === "trait-roll-sequence-complete" ? sequenceOptions[0] : null);

  const baseRoll =
    resolvedSequenceTarget && awaiting?.type === "trait-roll-sequence-complete"
      ? awaiting.results?.[Number(String(resolvedSequenceTarget.value).replace("sequence:", ""))]
      : g.eventState?.lastRoll;
  if (!baseRoll || !Array.isArray(baseRoll.dice)) {
    return { game: g, closeViewedCard: false, diceAnimation: null };
  }

  const blankIndexes = baseRoll.dice.reduce((acc, die, index) => {
    if (die === 0) acc.push(index);
    return acc;
  }, []);
  if (blankIndexes.length === 0) {
    return { game: g, closeViewedCard: false, diceAnimation: null };
  }

  const rerolledBlankDice = rollDice(blankIndexes.length);
  const nextDice = [...baseRoll.dice];
  blankIndexes.forEach((dieIndex, index) => {
    nextDice[dieIndex] = rerolledBlankDice[index];
  });

  const previousDiceTotal = (baseRoll.dice || []).reduce((sum, value) => sum + value, 0);
  const staticBonus = (baseRoll.total || 0) - previousDiceTotal;
  const nextTotal = nextDice.reduce((sum, value) => sum + value, 0) + staticBonus;
  const rerollBlankCount = rerolledBlankDice.filter((value) => value === 0).length;
  const nextPlayers = g.players.map((player, playerIndex) => {
    if (playerIndex !== viewedCard.ownerIndex) return player;

    const nextInventory = player.inventory.map((card, cardIndex) =>
      cardIndex === viewedCard.ownerCardIndex
        ? {
            ...card,
            lastActiveAbilityTurnUsed: g.turnNumber,
          }
        : card
    );

    return {
      ...player,
      inventory: nextInventory,
    };
  });

  return {
    game: {
      ...g,
      players: nextPlayers,
      message: `${owner.name} flips Lucky Coin and rerolls blank dice...`,
    },
    closeViewedCard: true,
    diceAnimation: {
      purpose: "event-partial-reroll",
      final: nextDice,
      display: [...baseRoll.dice],
      settled: false,
      label: baseRoll.label || STAT_LABELS[baseRoll.stat] || "Trait",
      total: nextTotal,
      modifier: baseRoll.modifier || null,
      outcomes:
        resolvedSequenceTarget && awaiting?.type === "trait-roll-sequence-complete"
          ? [...(awaiting.outcomes || [])]
          : [...(baseRoll.outcomes || [])],
      rerollIndexes: blankIndexes,
      rerollDescription: "blank dice",
      ownerIndex: viewedCard.ownerIndex,
      sanityLoss: rerollBlankCount,
      sourceName: inventoryCard.name,
      sequenceResultIndex:
        resolvedSequenceTarget && awaiting?.type === "trait-roll-sequence-complete"
          ? Number(String(resolvedSequenceTarget.value).replace("sequence:", ""))
          : undefined,
      sequenceStat:
        resolvedSequenceTarget && awaiting?.type === "trait-roll-sequence-complete"
          ? awaiting.results?.[Number(String(resolvedSequenceTarget.value).replace("sequence:", ""))]?.stat
          : undefined,
    },
  };
}

export function applyRabbitsFootNowState(g, viewedCard) {
  if (!viewedCard) return { game: g, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.activeAbilityRule?.action !== "reroll-one-die") {
    return { game: g, closeViewedCard: false, diceAnimation: null };
  }
  if (viewedCard.ownerCollection !== "inventory") return { game: g, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.ownerIndex !== g.currentPlayerIndex) return { game: g, closeViewedCard: false, diceAnimation: null };
  if (!isRabbitsFootAvailableThisTurn(g, viewedCard)) return { game: g, closeViewedCard: false, diceAnimation: null };

  const owner = g.players[viewedCard.ownerIndex];
  const inventoryCard = getInventoryCard(g, viewedCard);
  const lastRoll = g.eventState?.lastRoll;
  const skeletonKeyRollDice =
    g.tileEffect?.type === "skeleton-key-result" && Array.isArray(g.tileEffect?.dice) ? g.tileEffect.dice : null;
  if (
    !owner ||
    !inventoryCard ||
    ((!lastRoll || !Array.isArray(lastRoll.dice) || lastRoll.dice.length === 0 || !Array.isArray(lastRoll.outcomes)) &&
      (!skeletonKeyRollDice || skeletonKeyRollDice.length === 0))
  ) {
    return { game: g, closeViewedCard: false, diceAnimation: null };
  }

  const sourceType =
    !!lastRoll && Array.isArray(lastRoll.dice) && lastRoll.dice.length > 0 && Array.isArray(lastRoll.outcomes)
      ? "event-last-roll"
      : "skeleton-key-roll";

  return {
    game: {
      ...g,
      rabbitFootPendingReroll: {
        ownerIndex: viewedCard.ownerIndex,
        ownerCardIndex: viewedCard.ownerCardIndex,
        sourceName: inventoryCard.name,
        sourceType,
        selectedDieIndex: null,
      },
      message: `${owner.name} uses ${inventoryCard.name}. Select one die, then press Reroll.`,
    },
    closeViewedCard: true,
    diceAnimation: null,
  };
}

export function applySkeletonKeyNowState(g, viewedCard) {
  if (!viewedCard) return { game: g, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.activeAbilityRule?.action !== "move-through-walls") {
    return { game: g, closeViewedCard: false, diceAnimation: null };
  }
  if (viewedCard.ownerCollection !== "inventory") return { game: g, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.ownerIndex !== g.currentPlayerIndex) return { game: g, closeViewedCard: false, diceAnimation: null };
  if (!canUseNormalMovementNow(g, viewedCard)) {
    return { game: g, closeViewedCard: false, diceAnimation: null };
  }
  if (!hasSkeletonKeyWallMoveAvailable(g, viewedCard)) {
    return { game: g, closeViewedCard: false, diceAnimation: null };
  }

  const owner = g.players[viewedCard.ownerIndex];
  const inventoryCard = getInventoryCard(g, viewedCard);
  if (!owner || !inventoryCard || inventoryCard.id !== "skeleton-key") {
    return { game: g, closeViewedCard: false, diceAnimation: null };
  }

  const nextPlayers = g.players.map((player, playerIndex) => {
    if (playerIndex !== viewedCard.ownerIndex) return player;

    return {
      ...player,
      inventory: player.inventory.map((card, cardIndex) =>
        cardIndex === viewedCard.ownerCardIndex
          ? {
              ...card,
              lastActiveAbilityTurnUsed: g.turnNumber,
            }
          : card
      ),
    };
  });

  return {
    game: {
      ...g,
      players: nextPlayers,
      skeletonKeyArmed: true,
      message: `${owner.name} uses ${inventoryCard.name}. Your next wall move costs movement normally.`,
    },
    closeViewedCard: true,
    diceAnimation: null,
  };
}

export function chooseRabbitFootDieState(g, dieIndex) {
  const pending = g.rabbitFootPendingReroll;
  const dice =
    pending?.sourceType === "skeleton-key-roll"
      ? g.tileEffect?.type === "skeleton-key-result"
        ? g.tileEffect?.dice
        : null
      : g.eventState?.lastRoll?.dice;
  const selectedIndex = Number(dieIndex);
  if (!pending || !Array.isArray(dice)) return g;
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= dice.length) return g;

  return {
    ...g,
    rabbitFootPendingReroll: {
      ...pending,
      selectedDieIndex: selectedIndex,
    },
  };
}

export function applyRabbitFootRerollState(g) {
  const pending = g.rabbitFootPendingReroll;
  const isSkeletonKeyRoll = pending?.sourceType === "skeleton-key-roll";
  const lastRoll = g.eventState?.lastRoll;
  const skeletonKeyRollDice =
    g.tileEffect?.type === "skeleton-key-result" && Array.isArray(g.tileEffect?.dice) ? g.tileEffect.dice : null;

  if (
    !pending ||
    (!isSkeletonKeyRoll && (!lastRoll || !Array.isArray(lastRoll.dice) || !Array.isArray(lastRoll.outcomes))) ||
    (isSkeletonKeyRoll && (!skeletonKeyRollDice || skeletonKeyRollDice.length === 0))
  ) {
    return { game: g, diceAnimation: null };
  }

  const sourceDice = isSkeletonKeyRoll ? skeletonKeyRollDice : lastRoll.dice;

  const selectedIndex = Number(pending.selectedDieIndex);
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= sourceDice.length) {
    return { game: g, diceAnimation: null };
  }

  const ownerIndex = Number(pending.ownerIndex);
  if (!Number.isInteger(ownerIndex) || ownerIndex < 0 || ownerIndex >= g.players.length) {
    return { game: g, diceAnimation: null };
  }

  const rerolledValue = rollDice(1)[0];
  const nextDice = [...sourceDice];
  nextDice[selectedIndex] = rerolledValue;

  const previousDiceTotal = (sourceDice || []).reduce((sum, value) => sum + value, 0);
  const staticBonus = isSkeletonKeyRoll ? 0 : (lastRoll.total || 0) - previousDiceTotal;
  const nextTotal = nextDice.reduce((sum, value) => sum + value, 0) + staticBonus;

  const nextPlayers = g.players.map((player, index) => {
    if (index !== ownerIndex) return player;

    return {
      ...player,
      inventory: player.inventory.map((card, cardIndex) =>
        cardIndex === pending.ownerCardIndex
          ? {
              ...card,
              lastActiveAbilityTurnUsed: g.turnNumber,
            }
          : card
      ),
    };
  });

  const ownerName = g.players[ownerIndex]?.name || "Explorer";

  if (isSkeletonKeyRoll) {
    return {
      game: {
        ...g,
        players: nextPlayers,
        rabbitFootPendingReroll: null,
        message: `${ownerName} uses ${pending.sourceName || "Rabbit's Foot"} to reroll the Skeleton Key die...`,
      },
      diceAnimation: {
        purpose: "skeleton-key",
        final: [...nextDice],
        display: [...sourceDice],
        settled: false,
        tileName: "Skeleton Key",
        rerollIndexes: [selectedIndex],
      },
    };
  }

  return {
    game: {
      ...g,
      players: nextPlayers,
      rabbitFootPendingReroll: null,
      message: `${ownerName} uses ${pending.sourceName || "Rabbit's Foot"} and rerolls one die...`,
    },
    diceAnimation: {
      purpose: "event-partial-reroll",
      final: nextDice,
      display: [...sourceDice],
      settled: false,
      label: lastRoll.label || "Roll",
      total: nextTotal,
      modifier: lastRoll.modifier || null,
      outcomes: [...(lastRoll.outcomes || [])],
      rerollIndexes: [selectedIndex],
      rerollDescription: "one die",
      ownerIndex,
      sanityLoss: 0,
      sourceName: pending.sourceName || "Rabbit's Foot",
    },
  };
}

export function chooseAngelsFeatherValueState(
  g,
  total,
  viewedCard,
  { drawnEventPrimaryAction, queuedTraitRollOverride = null }
) {
  const usageState = getAngelsFeatherUsageState({ game: g, drawnEventPrimaryAction, queuedTraitRollOverride });
  const { canApplyNow, canQueueForDrawnEvent } = usageState;
  if (!viewedCard) return { game: g, queueTraitRollOverride: undefined, closeViewedCard: false };
  if (viewedCard.activeAbilityRule?.action !== "set-trait-roll-total") {
    return { game: g, queueTraitRollOverride: undefined, closeViewedCard: false };
  }
  if (viewedCard.ownerCollection !== "inventory")
    return { game: g, queueTraitRollOverride: undefined, closeViewedCard: false };
  if (viewedCard.ownerIndex !== g.currentPlayerIndex) {
    return { game: g, queueTraitRollOverride: undefined, closeViewedCard: false };
  }
  if (!canApplyNow && !canQueueForDrawnEvent) {
    return { game: g, queueTraitRollOverride: undefined, closeViewedCard: false };
  }

  const owner = g.players[viewedCard.ownerIndex];
  const inventoryCard = owner?.inventory?.[viewedCard.ownerCardIndex];
  if (!inventoryCard || inventoryCard.id !== "angels-feather") {
    return { game: g, queueTraitRollOverride: undefined, closeViewedCard: false };
  }

  const nextPlayers = g.players.map((player, index) => {
    if (index !== viewedCard.ownerIndex) return player;
    return {
      ...player,
      inventory: player.inventory.filter((_, cardIndex) => cardIndex !== viewedCard.ownerCardIndex),
    };
  });

  const forcedTotal = Math.max(0, Math.min(8, Number(total)));
  const awaiting = g.eventState?.awaiting;

  if (canApplyNow && awaiting?.type === "roll-ready" && awaiting.rollKind === "trait-roll") {
    const matchedOutcome = getMatchingOutcome(awaiting.outcomes || [], forcedTotal);
    const resolvedEffects = [...(matchedOutcome?.effects || [])];

    return {
      game: {
        ...g,
        players: nextPlayers,
        eventState: {
          ...g.eventState,
          awaiting: null,
          lastRoll: {
            label: STAT_LABELS[awaiting.rollStat] || awaiting.label || "Trait",
            dice: [forcedTotal],
            total: forcedTotal,
            modifier: null,
            outcomes: [...(awaiting.outcomes || [])],
          },
          summary: describeEventEffects(resolvedEffects),
          pendingEffects: resolvedEffects,
        },
        message: `${owner.name} buries Angel's Feather and sets this roll to ${forcedTotal}.`,
      },
      queueTraitRollOverride: null,
      closeViewedCard: true,
    };
  }

  if (canApplyNow && awaiting?.type === "trait-roll-sequence-ready") {
    return {
      game: {
        ...g,
        players: nextPlayers,
        eventState: {
          ...g.eventState,
          awaiting: {
            ...awaiting,
            type: "trait-roll-sequence-rolling",
            overrideTotal: forcedTotal,
          },
        },
        message: `${owner.name} buries Angel's Feather and sets this roll to ${forcedTotal}.`,
      },
      queueTraitRollOverride: null,
      closeViewedCard: true,
    };
  }

  const nextGame = {
    ...g,
    players: nextPlayers,
    eventState:
      canApplyNow && g.eventState
        ? {
            ...g.eventState,
            awaiting: {
              ...g.eventState.awaiting,
              overrideTotal: forcedTotal,
            },
          }
        : g.eventState,
    message: `${owner.name} buries Angel's Feather and sets this roll to ${forcedTotal}.`,
  };

  return {
    game: nextGame,
    queueTraitRollOverride:
      canQueueForDrawnEvent && !canApplyNow
        ? {
            kind: "set-total",
            total: forcedTotal,
          }
        : null,
    closeViewedCard: true,
  };
}

export function chooseCardActiveAbilityValueState(g, total, viewedCard, deps) {
  const action = viewedCard?.activeAbilityRule?.action;
  if (action === "set-trait-roll-total") {
    const result = chooseAngelsFeatherValueState(g, total, viewedCard, deps);
    return {
      ...result,
      diceAnimation: null,
    };
  }
  if (action === "reroll-blank-trait-dice") {
    const result = applyLuckyCoinNowState(g, viewedCard, total);
    return {
      game: result.game,
      queueTraitRollOverride: undefined,
      closeViewedCard: result.closeViewedCard,
      diceAnimation: result.diceAnimation || null,
    };
  }
  if (
    action === "heal-critical-traits" ||
    action === "heal-stats" ||
    action === "heal-knowledge-sanity" ||
    action === "heal-might-speed"
  ) {
    const result = applyFirstAidKitNowState(g, viewedCard, total);
    return {
      game: result.game,
      queueTraitRollOverride: undefined,
      closeViewedCard: result.closeViewedCard,
      diceAnimation: null,
    };
  }

  return {
    game: g,
    queueTraitRollOverride: undefined,
    closeViewedCard: false,
    diceAnimation: null,
  };
}

export function chooseCardActiveAbilityNowState(g, viewedCard, deps = {}) {
  const action = viewedCard?.activeAbilityRule?.action;
  if (action === "reroll-all-trait-dice") {
    return applyCreepyDollNowState(g, viewedCard);
  }
  if (action === "reroll-blank-trait-dice") {
    return applyLuckyCoinNowState(g, viewedCard);
  }
  if (action === "reroll-one-die") {
    return applyRabbitsFootNowState(g, viewedCard);
  }
  if (action === "move-through-walls") {
    return applySkeletonKeyNowState(g, viewedCard);
  }
  if (action === "substitute-sanity-for-knowledge") {
    return applyMagicCameraNowState(g, viewedCard, deps);
  }
  if (action === "substitute-knowledge-for-trait") {
    return applyBookNowState(g, viewedCard, deps);
  }
  if (action === "teleport-any-tile") {
    return applyMapNowState(g, viewedCard);
  }
  if (action === "extra-turn-after-current") {
    return applyMysticalStopwatchNowState(g, viewedCard);
  }
  if (
    action === "heal-critical-traits" ||
    action === "heal-stats" ||
    action === "heal-knowledge-sanity" ||
    action === "heal-might-speed"
  ) {
    return applyFirstAidKitNowState(g, viewedCard);
  }

  return {
    game: g,
    closeViewedCard: false,
    diceAnimation: null,
    queueTraitRollOverride: undefined,
  };
}

export function createDamageChoice(effect, player) {
  const damageType = effect.damageType || "physical";
  const allowedStats = DAMAGE_STATS[damageType] || DAMAGE_STATS.physical;
  const allocation = Object.fromEntries(allowedStats.map((stat) => [stat, 0]));
  const conversionOptions = getDamageConversionOptions(player, damageType);
  const postDamageEffects =
    effect.damage > 0
      ? getPostDamageEffectsForChoice(player, {
          damageType,
          originalDamageType: damageType,
          allocation,
        })
      : [];

  return {
    source: "tile-effect",
    effect,
    originalDamageType: damageType,
    damageType,
    adjustmentMode: "decrease",
    amount: effect.damage,
    allowedStats,
    allocation,
    playerName: player.name,
    canConvertToGeneral: damageType !== "general" && conversionOptions.canConvertToGeneral,
    conversionSourceNames: conversionOptions.sourceNames,
    postDamageEffects,
  };
}

export function updateDamageChoiceType(choice, player, damageType) {
  const allowedStats = DAMAGE_STATS[damageType] || DAMAGE_STATS.physical;
  const nextChoice = {
    ...choice,
    damageType,
    allowedStats,
    allocation: Object.fromEntries(allowedStats.map((stat) => [stat, 0])),
  };

  return {
    ...nextChoice,
    postDamageEffects: choice.amount > 0 ? getPostDamageEffectsForChoice(player, nextChoice) : [],
  };
}

export function getMysticElevatorDestination(total) {
  if (total >= 4) {
    return {
      floors: ["upper", "ground", "basement"],
      label: "any floor",
    };
  }

  if (total === 3) {
    return {
      floors: ["upper"],
      label: "the upper floor",
    };
  }

  if (total === 2) {
    return {
      floors: ["ground"],
      label: "the ground floor",
    };
  }

  return {
    floors: ["basement"],
    label: "the basement",
  };
}

export function isQueuedTileEffectType(type) {
  return [
    "discover-gain",
    "armory",
    "junk-room",
    "panic-room",
    "mystic-elevator-result",
    "skeleton-key-result",
  ].includes(type);
}

export function applyTileEffectConsequences(g, players, effect) {
  let updatedPlayers = [...players];
  const pi = g.currentPlayerIndex;

  if (effect.type === "collapsed" && effect.collapsed) {
    const basementLanding = g.board.basement?.find((t) => t.id === "basement-landing");
    if (basementLanding) {
      updatedPlayers = updatedPlayers.map((pl, i) =>
        i === pi ? { ...pl, x: basementLanding.x, y: basementLanding.y, floor: "basement" } : pl
      );
    }
  }

  if (effect.type === "laundry-chute") {
    const basementLanding = g.board.basement?.find((t) => t.id === "basement-landing");
    if (basementLanding) {
      updatedPlayers = updatedPlayers.map((pl, i) =>
        i === pi ? { ...pl, x: basementLanding.x, y: basementLanding.y, floor: "basement" } : pl
      );
    }
  }

  return updatedPlayers;
}

export function getEventUiState(game, eventEngineDeps, queuedTraitRollOverride = null) {
  const eventState = game.eventState;
  const drawnEventPrimaryAction =
    game.drawnCard?.type === "event" ? getInitialEventPrimaryAction(game, game.drawnCard, eventEngineDeps) : null;
  const eventTileChoiceOptions = eventState?.awaiting?.type === "tile-choice" ? eventState.awaiting.options || [] : [];
  const selectedEventTileChoiceId =
    eventState?.awaiting?.type === "tile-choice" ? eventState.awaiting.selectedOptionId || null : null;
  const showEventResolutionModal = !!eventState && eventState.awaiting?.type !== "tile-choice";
  const angelsFeatherUsageState = getAngelsFeatherUsageState({
    game,
    drawnEventPrimaryAction,
    queuedTraitRollOverride,
  });

  return {
    drawnEventPrimaryAction,
    eventTileChoiceOptions,
    selectedEventTileChoiceId,
    showEventResolutionModal,
    canUseAngelsFeatherNow: angelsFeatherUsageState.canUseAngelsFeatherNow,
  };
}

export function rollDice(n) {
  const results = [];
  for (let i = 0; i < n; i++) {
    results.push(Math.floor(Math.random() * 3));
  }
  return results;
}

export function formatSourceNames(names) {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function getTileAtPosition(board, x, y, floor) {
  return board?.[floor]?.find((tile) => tile.x === x && tile.y === y) || null;
}

export function getBoardTraitRollDiceBonus(board, player) {
  const tile = getTileAtPosition(board, player?.x, player?.y, player?.floor);
  const blessingCount = tile?.tokens?.filter((token) => token.type === "blessing").length || 0;

  return {
    amount: blessingCount,
    sourceNames: blessingCount > 0 ? Array.from({ length: blessingCount }, () => "Blessing") : [],
  };
}

export function getPassiveEffects(player) {
  const ownedCards = [...(player?.omens ?? []), ...(player?.inventory ?? [])];

  return ownedCards.flatMap((card) =>
    (card.passiveEffects ?? []).map((effect) => ({
      ...effect,
      sourceName: card.name,
    }))
  );
}

export function getTraitRollBonus(player, stat) {
  const matchingEffects = getPassiveEffects(player).filter(
    (effect) => effect.type === "trait-roll-bonus" && effect.stat === stat
  );

  return {
    amount: matchingEffects.reduce((sum, effect) => sum + (effect.amount || 0), 0),
    sourceNames: matchingEffects.map((effect) => effect.sourceName),
  };
}

export function getDamageReduction(player, damageType) {
  const matchingEffects = getPassiveEffects(player).filter(
    (effect) => effect.type === "damage-reduction" && effect.damageTypes?.includes(damageType)
  );

  return {
    amount: matchingEffects.reduce((sum, effect) => sum + (effect.amount || 0), 0),
    sourceNames: matchingEffects.map((effect) => effect.sourceName),
  };
}

export function getTraitRollDiceBonus(player, context) {
  const matchingEffects = getPassiveEffects(player).filter(
    (effect) =>
      effect.type === "trait-roll-dice-bonus" &&
      (!effect.contexts || effect.contexts.length === 0 || effect.contexts.includes(context))
  );

  return {
    amount: matchingEffects.reduce((sum, effect) => sum + (effect.amount || 0), 0),
    sourceNames: matchingEffects.map((effect) => effect.sourceName),
  };
}

export function getDamageConversionOptions(player, damageType) {
  const matchingEffects = getPassiveEffects(player).filter(
    (effect) =>
      effect.type === "damage-conversion-option" &&
      effect.damageTypes?.includes(damageType) &&
      effect.convertTo === "general"
  );

  return {
    canConvertToGeneral: matchingEffects.length > 0,
    sourceNames: matchingEffects.map((effect) => effect.sourceName),
  };
}

export function createTraitRollModifier(traitBonus, diceBonus) {
  const sourceNames = [...new Set([...(traitBonus?.sourceNames || []), ...(diceBonus?.sourceNames || [])])];
  if (sourceNames.length === 0) return null;

  const parts = [];
  if ((diceBonus?.amount || 0) > 0) parts.push(`+${diceBonus.amount} dice`);
  if ((traitBonus?.amount || 0) > 0) parts.push(`+${traitBonus.amount}`);

  return {
    value: parts.join(" "),
    label: `from ${formatSourceNames(sourceNames)}`,
    tone: "positive",
  };
}

export function resolveTraitRoll(player, { stat, baseDiceCount, context, board = null, usePassives = true }) {
  const passiveDiceBonus = usePassives ? getTraitRollDiceBonus(player, context) : { amount: 0, sourceNames: [] };
  const boardDiceBonus = board ? getBoardTraitRollDiceBonus(board, player) : { amount: 0, sourceNames: [] };
  const diceBonus = {
    amount: passiveDiceBonus.amount + boardDiceBonus.amount,
    sourceNames: [...passiveDiceBonus.sourceNames, ...boardDiceBonus.sourceNames],
  };
  const traitBonus = usePassives ? getTraitRollBonus(player, stat) : { amount: 0, sourceNames: [] };
  const dice = rollDice(baseDiceCount + diceBonus.amount);

  return {
    dice,
    total: dice.reduce((sum, value) => sum + value, 0) + traitBonus.amount,
    modifier: createTraitRollModifier(traitBonus, diceBonus),
  };
}

export function createDiceModifier({ amount, sourceNames, sign = "+", labelPrefix = "from", tone = "positive" }) {
  if (!amount || sourceNames.length === 0) return null;

  return {
    value: `${sign}${amount}`,
    label: `${labelPrefix} ${formatSourceNames(sourceNames)}`,
    tone,
  };
}

export function resolveDamageEffect(player, effect) {
  if (!effect?.damageType || effect.damage === undefined || effect.damageResolved) return effect;

  const damageReduction = getDamageReduction(player, effect.damageType);

  return {
    ...effect,
    damage: Math.max(0, effect.damage - damageReduction.amount),
    damageResolved: true,
    damageModifier:
      damageReduction.amount > 0
        ? createDiceModifier({
            amount: damageReduction.amount,
            sourceNames: damageReduction.sourceNames,
            sign: "-",
            labelPrefix: "blocked by",
          })
        : null,
  };
}

export function getDamageTypesFromAllocation(choice) {
  if (!choice) return [];

  if (choice.damageType !== "general") {
    return [choice.damageType];
  }

  const damageTypes = new Set();
  for (const [stat, amount] of Object.entries(choice.allocation || {})) {
    if (!amount) continue;
    if (stat === "might" || stat === "speed") damageTypes.add("physical");
    if (stat === "sanity" || stat === "knowledge") damageTypes.add("mental");
  }

  return [...damageTypes];
}

export function getPostDamageEffectsForChoice(player, choice) {
  const damageTypes = getDamageTypesFromAllocation(choice);
  if (damageTypes.length === 0) return [];

  return getPassiveEffects(player).filter(
    (effect) => effect.type === "stat-gain-on-damage" && effect.damageTypes?.some((type) => damageTypes.includes(type))
  );
}

export function getInitialEventPrimaryAction(g, card, eventEngineDeps) {
  const simulatedEvent = {
    ...g,
    drawnCard: null,
    turnPhase: "event",
    eventState: {
      card,
      stepIndex: 0,
      context: {
        choices: {},
        selectedStats: {},
      },
      pendingEffects: [],
      awaiting: null,
      summary: null,
      lastRoll: null,
    },
  };

  const result = advanceEventResolution(simulatedEvent, eventEngineDeps);
  const awaiting = result.game.eventState?.awaiting;

  if (awaiting?.type === "roll-ready") {
    return {
      type: "roll",
      label: getEventRollButtonLabel(awaiting.baseDiceCount || 0),
      autoRoll: true,
      isTraitRoll: awaiting.rollKind === "trait-roll",
      rollStat: awaiting.rollKind === "trait-roll" ? awaiting.rollStat : null,
    };
  }

  if (awaiting?.type === "trait-roll-sequence-ready") {
    return {
      type: "roll",
      label: "Roll",
      autoRoll: true,
      isTraitRoll: true,
    };
  }

  if (awaiting?.type === "choice" && Array.isArray(awaiting.options) && awaiting.options.length > 0) {
    return {
      type: "choice",
      options: awaiting.options,
      prompt: awaiting.prompt || "Choose an option.",
      autoRoll: false,
    };
  }

  return {
    type: "continue",
    label: "Continue",
    autoRoll: false,
    isTraitRoll: false,
  };
}

export function resolveRollReadyAwaiting(g, awaiting, deps) {
  const { STAT_LABELS, rollDice: depRollDice, resolveTraitRoll: depResolveTraitRoll } = deps;
  const currentPlayerState = g.players[g.currentPlayerIndex];

  if (awaiting.rollKind === "trait-roll") {
    if (awaiting.overrideTotal !== undefined && awaiting.overrideTotal !== null) {
      const forcedTotal = Math.max(0, Math.min(8, awaiting.overrideTotal));
      const matchedOutcome = getMatchingOutcome(awaiting.outcomes || [], forcedTotal);
      const resolvedEffects = [...(matchedOutcome?.effects || [])];

      return {
        game: {
          ...g,
          eventState: {
            ...g.eventState,
            awaiting: null,
            lastRoll: {
              label: STAT_LABELS[awaiting.rollStat],
              dice: [forcedTotal],
              total: forcedTotal,
              modifier: null,
              outcomes: [...(awaiting.outcomes || [])],
            },
            summary: describeEventEffects(resolvedEffects),
            pendingEffects: resolvedEffects,
          },
          message: `${g.eventState.card.name}: roll set to ${forcedTotal} by Angel's Feather.`,
        },
        animation: null,
      };
    }

    const roll = depResolveTraitRoll(currentPlayerState, {
      stat: awaiting.rollStat,
      baseDiceCount: awaiting.baseDiceCount,
      context: "event",
      board: g.board,
      usePassives: awaiting.usePassives !== false,
    });

    return {
      game: {
        ...g,
        eventState: {
          ...g.eventState,
          awaiting: {
            ...awaiting,
            type: "rolling",
          },
        },
      },
      animation: {
        purpose: "event-roll",
        final: roll.dice,
        display: Array.from({ length: roll.dice.length }, () => Math.floor(Math.random() * 3)),
        settled: false,
        label: STAT_LABELS[awaiting.rollStat],
        total: roll.total,
        modifier: roll.modifier,
        outcomes: [...(awaiting.outcomes || [])],
      },
    };
  }

  if (awaiting.rollKind === "dice-roll" || awaiting.rollKind === "haunt-roll") {
    const dice = depRollDice(awaiting.baseDiceCount || 0);
    const total = dice.reduce((sum, die) => sum + die, 0);

    return {
      game: {
        ...g,
        eventState: {
          ...g.eventState,
          awaiting: {
            ...awaiting,
            type: "rolling",
          },
        },
      },
      animation: {
        purpose: "event-roll",
        final: dice,
        display: Array.from({ length: dice.length }, () => Math.floor(Math.random() * 3)),
        settled: false,
        label: awaiting.label || `${dice.length} dice`,
        total,
        modifier: null,
        outcomes: [...(awaiting.outcomes || [])],
      },
    };
  }

  return { game: g, animation: null };
}

export function resolveEventAnimationSettlement(g, da) {
  if (da.purpose === "event-roll") {
    if (!g.eventState) return { handled: true, game: g };

    const matchedOutcome = getMatchingOutcome(da.outcomes || [], da.total);
    const resolvedEffects = [...(matchedOutcome?.effects || [])];

    return {
      handled: true,
      game: {
        ...g,
        eventState: {
          ...g.eventState,
          awaiting: null,
          lastRoll: {
            label: da.label,
            dice: da.final,
            total: da.total,
            modifier: da.modifier || null,
            outcomes: [...(da.outcomes || [])],
          },
          summary: describeEventEffects(resolvedEffects),
          pendingEffects: resolvedEffects,
        },
        message: `${g.eventState.card.name}: roll resolved.`,
      },
    };
  }

  if (da.purpose === "event-partial-reroll") {
    if (!g.eventState) return { handled: true, game: g };

    const matchedOutcome = getMatchingOutcome(da.outcomes || [], da.total);
    const resolvedEffects = [...(matchedOutcome?.effects || [])];
    const sanityLoss = Math.max(0, Number(da.sanityLoss) || 0);
    const ownerIndex = Number(da.ownerIndex);
    const nextPlayers = Number.isInteger(ownerIndex)
      ? g.players.map((player, index) => {
          if (index !== ownerIndex) return player;
          const nextStatIndex = {
            ...player.statIndex,
            sanity: Math.max(0, player.statIndex.sanity - sanityLoss),
          };
          const isAlive = Object.values(nextStatIndex).every((value) => value > 0);
          return {
            ...player,
            statIndex: nextStatIndex,
            isAlive,
          };
        })
      : g.players;

    const ownerName = Number.isInteger(ownerIndex) ? g.players[ownerIndex]?.name || "Explorer" : "Explorer";
    const rerollDescription = da.rerollDescription || "dice";
    const sequenceResultIndex = Number(da.sequenceResultIndex);
    const isSequenceTarget =
      Number.isInteger(sequenceResultIndex) && g.eventState.awaiting?.type === "trait-roll-sequence-complete";

    const nextAwaiting = isSequenceTarget
      ? {
          ...g.eventState.awaiting,
          results: (g.eventState.awaiting.results || []).map((result, index) =>
            index === sequenceResultIndex
              ? {
                  ...result,
                  stat: da.sequenceStat || result.stat,
                  dice: [...(da.final || [])],
                  total: da.total,
                  modifier: da.modifier || null,
                  failed: da.total <= 1,
                }
              : result
          ),
        }
      : g.eventState.awaiting;

    return {
      handled: true,
      game: {
        ...g,
        players: nextPlayers,
        eventState: {
          ...g.eventState,
          awaiting: nextAwaiting,
          ...(isSequenceTarget
            ? {}
            : {
                lastRoll: {
                  label: da.label,
                  dice: da.final,
                  total: da.total,
                  modifier: da.modifier || null,
                  outcomes: [...(da.outcomes || [])],
                },
                summary: describeEventEffects(resolvedEffects),
                pendingEffects: resolvedEffects,
              }),
        },
        message:
          sanityLoss > 0
            ? `${ownerName} uses ${da.sourceName || "Lucky Coin"}, rerolls ${rerollDescription}, and loses ${sanityLoss} Sanity.`
            : `${ownerName} uses ${da.sourceName || "Lucky Coin"} and rerolls ${rerollDescription}.`,
      },
    };
  }

  if (da.purpose === "event-damage-roll") {
    if (!g.eventState) return { handled: true, game: g };

    const rolledAmount = da.final.reduce((sum, die) => sum + die, 0);
    const awaitingEffect = g.eventState.awaiting?.effect;
    const baseEffect = da.effect || awaitingEffect;
    if (!baseEffect) return { handled: true, game: g };

    const resolvedEffect = {
      ...baseEffect,
      resolvedAmount: rolledAmount,
    };

    return {
      handled: true,
      game: {
        ...g,
        eventState: {
          ...g.eventState,
          awaiting: null,
          summary: appendEventSummary(
            g.eventState.summary,
            `${g.players[g.currentPlayerIndex].name} rolls ${rolledAmount} for ${baseEffect.damageType} damage.`
          ),
          pendingEffects: [resolvedEffect, ...(g.eventState.pendingEffects || [])],
        },
        message: `${g.eventState.card.name}: damage roll resolved.`,
      },
    };
  }

  if (da.purpose === "event-damage-sequence") {
    const awaiting = g.eventState?.awaiting;
    if (!g.eventState || awaiting?.type !== "event-damage-sequence-rolling") {
      return { handled: true, game: g };
    }

    const rolledAmount = da.final.reduce((sum, die) => sum + die, 0);
    const currentEffect = awaiting.effects?.[awaiting.currentIndex];
    if (!currentEffect) return { handled: true, game: g };

    const resolvedEffect = {
      ...currentEffect,
      resolvedAmount: rolledAmount,
      rolledDice: da.final,
    };
    const nextResults = [...(awaiting.results || []), resolvedEffect];
    const hasMoreRolls = awaiting.currentIndex + 1 < (awaiting.effects?.length || 0);

    return {
      handled: true,
      game: {
        ...g,
        eventState: {
          ...g.eventState,
          summary: appendEventSummary(
            g.eventState.summary,
            `${g.players[g.currentPlayerIndex].name} rolls ${rolledAmount} for ${currentEffect.damageType} damage.`
          ),
          awaiting: hasMoreRolls
            ? {
                ...awaiting,
                type: "event-damage-sequence-ready",
                currentIndex: awaiting.currentIndex + 1,
                results: nextResults,
              }
            : {
                ...awaiting,
                type: "event-damage-sequence-complete",
                results: nextResults,
              },
        },
        message: hasMoreRolls
          ? `${g.eventState.card.name}: rolling next damage die.`
          : `${g.eventState.card.name}: damage rolls resolved.`,
      },
    };
  }

  if (da.purpose === "event-trait-sequence-roll") {
    const awaiting = g.eventState?.awaiting;
    if (!g.eventState || awaiting?.type !== "trait-roll-sequence-rolling") {
      return { handled: true, game: g };
    }

    const currentStat = awaiting.stats?.[awaiting.currentIndex];
    if (!currentStat) return { handled: true, game: g };

    const failed = da.total <= 1;
    const nextResults = [
      ...(awaiting.results || []),
      {
        stat: currentStat,
        dice: da.final,
        total: da.total,
        modifier: da.modifier || null,
        failed,
      },
    ];
    const hasMoreRolls = awaiting.currentIndex + 1 < (awaiting.stats?.length || 0);

    return {
      handled: true,
      game: {
        ...g,
        eventState: {
          ...g.eventState,
          awaiting: hasMoreRolls
            ? {
                ...awaiting,
                currentIndex: awaiting.currentIndex + 1,
                results: nextResults,
              }
            : {
                ...awaiting,
                type: "trait-roll-sequence-complete",
                results: nextResults,
              },
        },
        message: hasMoreRolls
          ? `${g.eventState.card.name}: rolling next trait.`
          : `${g.eventState.card.name}: trait sequence complete.`,
      },
    };
  }

  return { handled: false, game: g };
}
