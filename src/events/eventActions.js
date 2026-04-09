import { advanceEventResolution, getMatchingOutcome } from "./eventEngine";
import { appendEventSummary, describeEventEffects, getEventRollButtonLabel } from "./eventUtils";
import { GAME_PHASES } from "../haunts/hauntDomain";
import {
  applyMaskNowState as applyMaskNowStateFromAbility,
  confirmMaskTileChoiceState,
  isMaskPushAvailableThisTurn as isMaskPushAvailableThisTurnFromAbility,
  previewMaskTileChoiceState,
} from "../omens/maskAbility";
import {
  applyBookNowState as applyBookNowStateFromAbility,
  getBookUsageState as getBookUsageStateFromAbility,
} from "../omens/bookAbility";
import { isDogTradeAvailableThisTurn as isDogTradeAvailableThisTurnFromAbility } from "../omens/dogAbility";
import { isSupportedOmenAction } from "../omens/omenActionSupport";
import {
  applyFirstAidKitNowState as applyFirstAidKitNowStateFromTurnStateAbility,
  applyMysticalStopwatchNowState as applyMysticalStopwatchNowStateFromTurnStateAbility,
  canUseHealAbilityNow as canUseHealAbilityNowFromTurnStateAbility,
  getActiveHealRule as getActiveHealRuleFromTurnStateAbility,
  getHealTargetOptions as getHealTargetOptionsFromTurnStateAbility,
} from "../items/turnStateItemAbility";
import {
  applyCreepyDollNowState as applyCreepyDollNowStateFromRollAbility,
  applyLuckyCoinNowState as applyLuckyCoinNowStateFromRollAbility,
  applyMagicCameraNowState as applyMagicCameraNowStateFromRollAbility,
  applyRabbitsFootNowState as applyRabbitsFootNowStateFromRollAbility,
  chooseAngelsFeatherValueState as chooseAngelsFeatherValueStateFromRollAbility,
  getAngelsFeatherUsageState as getAngelsFeatherUsageStateFromRollAbility,
  getLuckyCoinSequenceRerollOptions as getLuckyCoinSequenceRerollOptionsFromRollAbility,
  getMagicCameraUsageState as getMagicCameraUsageStateFromRollAbility,
  isCreepyDollAvailableThisTurn as isCreepyDollAvailableThisTurnFromRollAbility,
  isLuckyCoinAvailableThisTurn as isLuckyCoinAvailableThisTurnFromRollAbility,
  isRabbitsFootAvailableThisTurn as isRabbitsFootAvailableThisTurnFromRollAbility,
} from "../items/rollManipulationItemAbility";
import {
  applyMapNowState as applyMapNowStateFromMovementAbility,
  applySkeletonKeyNowState as applySkeletonKeyNowStateFromMovementAbility,
  canUseNormalMovementNow as canUseNormalMovementNowFromMovementAbility,
  getSkeletonKeyResultDice,
  hasSkeletonKeyWallMoveAvailable as hasSkeletonKeyWallMoveAvailableFromMovementAbility,
  isSkeletonKeyResultEffectType,
} from "../items/movementItemAbility";
import {
  getDamageConversionOptions as getDamageConversionOptionsFromPassiveGroup,
  getDamageReduction as getDamageReductionFromPassiveGroup,
  getPassiveEffects as getPassiveEffectsFromPassiveGroup,
  getPostDamageEffectsForChoice as getPostDamageEffectsForChoiceFromPassiveGroup,
  getTraitRollBonus as getTraitRollBonusFromPassiveGroup,
  getTraitRollDiceBonus as getTraitRollDiceBonusFromPassiveGroup,
} from "../items/passiveItemEffectAbility";
import { getItemAbilitySelectionState } from "../items/itemAvailability";
import { chooseItemAbilityNowState, chooseItemAbilityValueState } from "../items/itemActionRegistry";
import { isUnsupportedItemAction } from "../items/unsupportedItemAbility";
import {
  applyDynamiteNowState as applyDynamiteNowStateFromAbility,
  buildDynamiteThrowState,
} from "../items/dynamiteAbility";

import { DAMAGE_STATS, STAT_LABELS, DIR, OPPOSITE } from "../game/gameState";

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
  const traitorPlayerIndex = game?.hauntState?.traitorPlayerIndex;
  const ownerIsTraitor = Number.isInteger(traitorPlayerIndex) && ownerIndex === traitorPlayerIndex;

  const start = { floor: owner.floor, x: owner.x, y: owner.y };
  const distances = computeReachableDistances(game.board, start, maxDistance, { ignoreObstacles: true });

  return (game.players || [])
    .map((player, playerIndex) => ({ player, playerIndex }))
    .filter(({ player, playerIndex }) => {
      if (playerIndex === ownerIndex || !player.isAlive) return false;
      if (!Number.isInteger(traitorPlayerIndex)) return true;
      const targetIsTraitor = playerIndex === traitorPlayerIndex;
      return ownerIsTraitor === targetIsTraitor;
    })
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

function isCreepyDollAvailableThisTurn(game, viewedCard) {
  return isCreepyDollAvailableThisTurnFromRollAbility(game, viewedCard, {
    isTraitRollResult,
  });
}

function isTraitRollResult(lastRoll) {
  if (!lastRoll) return false;
  return Object.values(STAT_LABELS).includes(lastRoll.label);
}

function isTraitRollJustMadeContext(game) {
  if (game.hauntActionRoll?.status === "rolled-pending-continue") return true;
  if (isTraitRollResult(game.eventState?.lastRoll)) return true;

  const awaiting = game.eventState?.awaiting;
  if (awaiting?.type === "trait-roll-sequence-complete") {
    return Array.isArray(awaiting.results) && awaiting.results.length > 0;
  }

  return false;
}

export function isItemAbilityTileChoiceAwaiting(eventState) {
  return eventState?.awaiting?.type === "tile-choice" && eventState.awaiting?.source === "item-active-ability";
}

function isLuckyCoinAvailableThisTurn(game, viewedCard) {
  return isLuckyCoinAvailableThisTurnFromRollAbility(game, viewedCard, {
    isTraitRollResult,
  });
}

function isRabbitsFootAvailableThisTurn(game, viewedCard) {
  return isRabbitsFootAvailableThisTurnFromRollAbility(game, viewedCard, {});
}

function isDogTradeAvailableThisTurn(game, viewedCard) {
  return isDogTradeAvailableThisTurnFromAbility(game, viewedCard, getDogTradeTargets);
}

function isMaskPushAvailableThisTurn(game, viewedCard) {
  return isMaskPushAvailableThisTurnFromAbility(game, viewedCard, getMovementNeighbors);
}

function hasSkeletonKeyWallMoveAvailable(game, viewedCard) {
  return hasSkeletonKeyWallMoveAvailableFromMovementAbility(game, viewedCard);
}

function canUseNormalMovementNow(game, viewedCard) {
  return canUseNormalMovementNowFromMovementAbility(game, viewedCard);
}

function getTraitRollRequiredUsageState({ game, drawnEventPrimaryAction, queuedTraitRollOverride }) {
  const awaiting = game.eventState?.awaiting;
  const hauntActionRoll = game.hauntActionRoll;
  const canApplyNow =
    (awaiting?.type === "roll-ready" && awaiting.rollKind === "trait-roll" && awaiting.overrideTotal === undefined) ||
    (awaiting?.type === "trait-roll-sequence-ready" && awaiting.overrideTotal === undefined) ||
    awaiting?.type === "step-stat-choice" ||
    (hauntActionRoll?.status === "awaiting-roll" && hauntActionRoll.forcedTotal === null) ||
    game.tileEffect?.type === "collapsed-prompt";
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
  return getMagicCameraUsageStateFromRollAbility(
    { game, drawnEventPrimaryAction, queuedTraitRollOverride },
    { getTraitRollRequiredUsageState }
  );
}

function getBookUsageState({ game, viewedCard, drawnEventPrimaryAction, queuedTraitRollOverride }) {
  return getBookUsageStateFromAbility({
    game,
    viewedCard,
    drawnEventPrimaryAction,
    queuedTraitRollOverride,
    getTraitRollRequiredUsageState,
  });
}

function getLuckyCoinSequenceRerollOptions(game) {
  return getLuckyCoinSequenceRerollOptionsFromRollAbility(game, {
    statLabels: STAT_LABELS,
  });
}

function getActiveHealRule(viewedCard) {
  return getActiveHealRuleFromTurnStateAbility(viewedCard);
}

function canUseHealAbilityNow(game, viewedCard) {
  return canUseHealAbilityNowFromTurnStateAbility(game, viewedCard);
}

function getHealTargetOptions(game, viewedCard, healRule) {
  return getHealTargetOptionsFromTurnStateAbility(game, viewedCard, healRule);
}

function matchesSequenceRollCondition(condition, total) {
  if (!condition) return false;
  if (condition.exact !== undefined) return total === condition.exact;
  if (condition.min !== undefined && total < condition.min) return false;
  if (condition.max !== undefined && total > condition.max) return false;
  return true;
}

export function continueEventState(g, deps) {
  const { runAdvanceEventResolution, finalizeEventState } = deps;
  if (!g.eventState) return { game: g, cameraFloor: null };

  if (g.eventState.awaiting?.type === "trait-roll-sequence-complete") {
    const results = g.eventState.awaiting.results || [];
    const outcomes = g.eventState.awaiting.outcomes || [];
    const allSucceeded = results.every((entry) => !entry.failed);

    const perRollEffects = results.flatMap((result) => {
      const matchingOutcome = outcomes.find(
        (outcome) => outcome.when?.perRoll && matchesSequenceRollCondition(outcome.when.perRoll, result.total)
      );
      if (!matchingOutcome) return [];
      return (matchingOutcome.effects || []).map((effect) => ({ ...effect, rolledStat: result.stat }));
    });

    const rewardOutcome = allSucceeded ? outcomes.find((outcome) => outcome.when?.allRolls?.min !== undefined) : null;

    const resumed = runAdvanceEventResolution({
      ...g,
      eventState: {
        ...g.eventState,
        awaiting: null,
        summary: null,
        pendingEffects: [...perRollEffects, ...(rewardOutcome?.effects || [])],
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

  const currentLastRoll = g.eventState.lastRoll;
  const result = runAdvanceEventResolution({
    ...g,
    eventState: {
      ...g.eventState,
      summary: null,
      lastRoll: null,
      rollHistory: currentLastRoll
        ? [...(g.eventState.rollHistory || []), currentLastRoll]
        : g.eventState.rollHistory || [],
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
    const pendingFeatherTotal = g.eventState.featherPendingTotal;
    const pendingRollSubstitute = g.eventState.pendingRollSubstitute;
    const nextState = {
      ...g,
      eventState: {
        ...g.eventState,
        featherPendingTotal: undefined,
        pendingRollSubstitute: undefined,
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
      if (pendingFeatherTotal !== undefined) {
        const rollReadyAwaiting = result.game.eventState.awaiting;
        const matchedOutcome = getMatchingOutcome(rollReadyAwaiting.outcomes || [], pendingFeatherTotal);
        const resolvedEffects = (matchedOutcome?.effects || []).map((effect) =>
          effect.stat === "rolled-trait" && rollReadyAwaiting.rollStat
            ? { ...effect, rolledStat: rollReadyAwaiting.rollStat }
            : effect
        );
        const prevLastRoll = result.game.eventState.lastRoll;
        const nextRollHistory = prevLastRoll
          ? [...(result.game.eventState.rollHistory || []), prevLastRoll]
          : result.game.eventState.rollHistory || [];
        result = {
          ...result,
          game: {
            ...result.game,
            eventState: {
              ...result.game.eventState,
              featherPendingTotal: undefined,
              awaiting: null,
              rollHistory: nextRollHistory,
              lastRoll: {
                label: STAT_LABELS[rollReadyAwaiting.rollStat] || rollReadyAwaiting.label || "Trait",
                dice: [pendingFeatherTotal],
                total: pendingFeatherTotal,
                modifier: null,
                outcomes: [...(rollReadyAwaiting.outcomes || [])],
              },
              summary: describeEventEffects(resolvedEffects),
              pendingEffects: resolvedEffects,
            },
            message: `${g.eventState.card.name}: roll set to ${pendingFeatherTotal} by Angel's Feather.`,
          },
        };
      } else if (pendingRollSubstitute) {
        const rollReadyAwaiting = result.game.eventState.awaiting;
        if (pendingRollSubstitute.from === "any" || rollReadyAwaiting.rollStat === pendingRollSubstitute.from) {
          const currentPlayer = result.game.players[result.game.currentPlayerIndex];
          const targetStat = pendingRollSubstitute.to;
          const targetDiceCount =
            currentPlayer?.character?.[targetStat]?.[currentPlayer?.statIndex?.[targetStat]] ??
            rollReadyAwaiting.baseDiceCount;
          result = {
            ...result,
            game: {
              ...result.game,
              eventState: {
                ...result.game.eventState,
                awaiting: {
                  ...rollReadyAwaiting,
                  rollStat: targetStat,
                  baseDiceCount: targetDiceCount,
                },
              },
            },
          };
        }
        const rollReady = resolveRollReadyAwaiting(result.game, result.game.eventState.awaiting, eventFlowDeps);
        result = { ...result, game: rollReady.game };
        nextDiceAnimation = rollReady.animation || null;
      } else {
        const rollReady = resolveRollReadyAwaiting(result.game, result.game.eventState.awaiting, eventFlowDeps);
        result = {
          ...result,
          game: rollReady.game,
        };
        nextDiceAnimation = rollReady.animation || null;
      }
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

  const maskPreview = previewMaskTileChoiceState(g, option, getTileAtPosition);
  if (maskPreview) return maskPreview;

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

  if (awaiting.effect.type === "mask-push-players" && awaiting.source === "item-active-ability") {
    const maskResult = confirmMaskTileChoiceState(g, selectedOption, tile);
    if (maskResult) return maskResult;
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

  if (awaiting.effect.type === "dynamite-throw" && awaiting.source === "item-active-ability") {
    const { dynamiteState, rollReadyEventState } = buildDynamiteThrowState(
      g,
      selectedOption.floor,
      selectedOption.x,
      selectedOption.y
    );
    if (dynamiteState.queue.length === 0) {
      return {
        game: {
          ...g,
          eventState: null,
          message: "Dynamite lands on an empty tile — no one is hurt!",
        },
        cameraFloor: selectedOption.floor,
      };
    }
    const firstRollerName = g.players[dynamiteState.queue[0]]?.name || "Someone";
    return {
      game: {
        ...g,
        eventState: rollReadyEventState,
        dynamiteState,
        message: `Dynamite lands! ${firstRollerName} must roll Speed first.`,
      },
      cameraFloor: selectedOption.floor,
    };
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
  return getAngelsFeatherUsageStateFromRollAbility(
    { game, drawnEventPrimaryAction, queuedTraitRollOverride },
    { getTraitRollRequiredUsageState }
  );
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
  "on-your-turn": ({ game, viewedCard }) => {
    if (viewedCard?.activeAbilityRule?.action === "extra-turn-after-current") {
      return (
        viewedCard.ownerIndex === game.currentPlayerIndex &&
        game.turnPhase !== "card" &&
        !game.drawnCard &&
        game.gamePhase === GAME_PHASES.HAUNT_ACTIVE
      );
    }
    return viewedCard.ownerIndex === game.currentPlayerIndex && game.turnPhase !== "card" && !game.drawnCard;
  },
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

  const isPlacingTile = game.turnPhase === "rotate" && rule.action !== "holy-symbol-bury-discovered-tile";
  if (isPlacingTile) {
    return { canUseNow: false, requiresValueSelection: false, valueOptions: [] };
  }

  const isPostDiscoveryActionItem =
    game.postDiscovery && (rule.trigger === "on-your-turn" || rule.trigger === "attack");
  if (isPostDiscoveryActionItem) {
    return { canUseNow: false, requiresValueSelection: false, valueOptions: [] };
  }

  const triggerHandler = ACTIVE_ABILITY_TRIGGER_HANDLERS[rule.trigger];
  const triggerSatisfied = triggerHandler
    ? triggerHandler({ game, viewedCard, drawnEventPrimaryAction, queuedTraitRollOverride })
    : false;

  const hasSupportedItemAction =
    rule.action === "set-trait-roll-total" ||
    rule.action === "reroll-all-trait-dice" ||
    rule.action === "reroll-blank-trait-dice" ||
    rule.action === "reroll-one-die" ||
    rule.action === "move-through-walls" ||
    rule.action === "substitute-sanity-for-knowledge" ||
    rule.action === "teleport-any-tile" ||
    rule.action === "extra-turn-after-current" ||
    rule.action === "heal-critical-traits" ||
    rule.action === "heal-stats" ||
    rule.action === "heal-knowledge-sanity" ||
    rule.action === "heal-might-speed" ||
    rule.action === "dynamite-aoe-attack";
  const hasSupportedAction = hasSupportedItemAction || isSupportedOmenAction(rule.action);
  const isSupportedInventoryAction =
    viewedCard.ownerCollection !== "inventory" || !isUnsupportedItemAction(rule.action);
  const itemAbilitySelectionState = getItemAbilitySelectionState({
    game,
    viewedCard,
    rule,
    drawnEventPrimaryAction,
    queuedTraitRollOverride,
    deps: {
      getActiveHealRule,
      getHealTargetOptions,
      getLuckyCoinSequenceRerollOptions,
      isCreepyDollAvailableThisTurn,
      isLuckyCoinAvailableThisTurn,
      isRabbitsFootAvailableThisTurn,
      canUseHealAbilityNow,
      isMaskPushAvailableThisTurn,
      isDogTradeAvailableThisTurn,
      canUseNormalMovementNow,
      hasSkeletonKeyWallMoveAvailable,
      getMagicCameraUsageState,
      getBookUsageState,
    },
  });

  return {
    canUseNow:
      triggerSatisfied && hasSupportedAction && isSupportedInventoryAction && itemAbilitySelectionState.actionSatisfied,
    requiresValueSelection: itemAbilitySelectionState.requiresValueSelection,
    valueOptions: itemAbilitySelectionState.valueOptions,
    action: rule.action,
    trigger: rule.trigger,
  };
}

export function applyFirstAidKitNowState(g, viewedCard, targetPlayerIndex = null) {
  return applyFirstAidKitNowStateFromTurnStateAbility(g, viewedCard, targetPlayerIndex);
}

export function applyMapNowState(g, viewedCard) {
  return applyMapNowStateFromMovementAbility(g, viewedCard);
}

export function applyDynamiteNowState(g, viewedCard) {
  return applyDynamiteNowStateFromAbility(g, viewedCard, {
    getMovementNeighbors,
    getTileByPosition,
  });
}

export function applyMaskNowState(g, viewedCard) {
  return applyMaskNowStateFromAbility(g, viewedCard, {
    isMaskAvailable: isMaskPushAvailableThisTurn,
    getDogMoveOptions,
    getTileByPosition,
  });
}

export function applyMysticalStopwatchNowState(g, viewedCard) {
  return applyMysticalStopwatchNowStateFromTurnStateAbility(g, viewedCard);
}

export function applyCreepyDollNowState(g, viewedCard) {
  return applyCreepyDollNowStateFromRollAbility(g, viewedCard, {
    isCreepyDollAvailable: isCreepyDollAvailableThisTurn,
    rollDice,
  });
}

export function applyMagicCameraNowState(
  g,
  viewedCard,
  { drawnEventPrimaryAction, queuedTraitRollOverride = null } = {}
) {
  return applyMagicCameraNowStateFromRollAbility(
    g,
    viewedCard,
    { drawnEventPrimaryAction, queuedTraitRollOverride },
    {
      getMagicCameraUsageState,
      getEventRollButtonLabel,
      statLabels: STAT_LABELS,
    }
  );
}

export function applyBookNowState(g, viewedCard, { drawnEventPrimaryAction, queuedTraitRollOverride = null } = {}) {
  return applyBookNowStateFromAbility(g, viewedCard, {
    drawnEventPrimaryAction,
    queuedTraitRollOverride,
    getBookUsageStateForContext: getBookUsageState,
    getEventRollButtonLabel,
    statLabels: STAT_LABELS,
  });
}

export function applyLuckyCoinNowState(g, viewedCard, targetRollSelection = null) {
  return applyLuckyCoinNowStateFromRollAbility(g, viewedCard, targetRollSelection, {
    isLuckyCoinAvailable: isLuckyCoinAvailableThisTurn,
    getLuckyCoinSequenceRerollOptions,
    rollDice,
    statLabels: STAT_LABELS,
  });
}

export function applyRabbitsFootNowState(g, viewedCard) {
  return applyRabbitsFootNowStateFromRollAbility(g, viewedCard, {
    isRabbitsFootAvailable: isRabbitsFootAvailableThisTurn,
  });
}

export function applySkeletonKeyNowState(g, viewedCard) {
  return applySkeletonKeyNowStateFromMovementAbility(g, viewedCard);
}

export function chooseRabbitFootDieState(g, dieIndex) {
  const pending = g.rabbitFootPendingReroll;
  const dice =
    pending?.sourceType === "skeleton-key-roll"
      ? getSkeletonKeyResultDice(g.tileEffect)
      : pending?.sourceType === "haunt-action-roll"
        ? g.hauntActionRoll?.lastRoll?.dice
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
  const isHauntActionRoll = pending?.sourceType === "haunt-action-roll";
  const lastRoll = g.eventState?.lastRoll;
  const hauntLastRoll = g.hauntActionRoll?.lastRoll;
  const skeletonKeyRollDice = getSkeletonKeyResultDice(g.tileEffect);

  if (
    !pending ||
    (!isSkeletonKeyRoll &&
      !isHauntActionRoll &&
      (!lastRoll || !Array.isArray(lastRoll.dice) || !Array.isArray(lastRoll.outcomes))) ||
    (isHauntActionRoll &&
      (!hauntLastRoll || !Array.isArray(hauntLastRoll.dice) || !Array.isArray(hauntLastRoll.outcomes))) ||
    (isSkeletonKeyRoll && (!skeletonKeyRollDice || skeletonKeyRollDice.length === 0))
  ) {
    return { game: g, diceAnimation: null };
  }

  const sourceDice = isSkeletonKeyRoll ? skeletonKeyRollDice : isHauntActionRoll ? hauntLastRoll.dice : lastRoll.dice;

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
  const staticBonus = isSkeletonKeyRoll
    ? 0
    : ((isHauntActionRoll ? hauntLastRoll?.total : lastRoll.total) || 0) - previousDiceTotal;
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

  if (isHauntActionRoll) {
    return {
      game: {
        ...g,
        players: nextPlayers,
        rabbitFootPendingReroll: null,
        message: `${ownerName} uses ${pending.sourceName || "Rabbit's Foot"} and rerolls one die...`,
      },
      diceAnimation: {
        purpose: "haunt-action-partial-reroll",
        final: nextDice,
        display: [...sourceDice],
        settled: false,
        label: hauntLastRoll.label || "Trait",
        total: nextTotal,
        modifier: hauntLastRoll.modifier || null,
        outcomes: [...(hauntLastRoll.outcomes || [])],
        rerollIndexes: [selectedIndex],
        rerollDescription: "one die",
        ownerIndex,
        sanityLoss: 0,
        sourceName: pending.sourceName || "Rabbit's Foot",
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
  return chooseAngelsFeatherValueStateFromRollAbility(
    g,
    total,
    viewedCard,
    { drawnEventPrimaryAction, queuedTraitRollOverride },
    {
      getMatchingOutcome,
      describeEventEffects,
      statLabels: STAT_LABELS,
      getAngelsFeatherUsageState,
    }
  );
}

export function chooseCardActiveAbilityValueState(g, total, viewedCard, deps) {
  return chooseItemAbilityValueState(g, total, viewedCard, deps, {
    chooseAngelsFeatherValueState,
    applyLuckyCoinNowState,
    applyFirstAidKitNowState,
  });
}

export function chooseCardActiveAbilityNowState(g, viewedCard, deps = {}) {
  return chooseItemAbilityNowState(g, viewedCard, deps, {
    applyCreepyDollNowState,
    applyLuckyCoinNowState,
    applyRabbitsFootNowState,
    applySkeletonKeyNowState,
    applyMagicCameraNowState,
    applyBookNowState,
    applyMapNowState,
    applyMaskNowState,
    applyMysticalStopwatchNowState,
    applyFirstAidKitNowState,
    applyDynamiteNowState,
  });
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
  return (
    ["discover-gain", "armory", "junk-room", "panic-room", "mystic-elevator-result"].includes(type) ||
    isSkeletonKeyResultEffectType(type)
  );
}

export function applyTileEffectConsequences(g, players, effect) {
  if (!effect) return players;

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
  const showEventResolutionModal = !!eventState && !game.dynamiteState && eventState.awaiting?.type !== "tile-choice";
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
  return getPassiveEffectsFromPassiveGroup(player);
}

export function getTraitRollBonus(player, stat) {
  return getTraitRollBonusFromPassiveGroup(player, stat);
}

export function getDamageReduction(player, damageType) {
  return getDamageReductionFromPassiveGroup(player, damageType);
}

export function getTraitRollDiceBonus(player, context) {
  return getTraitRollDiceBonusFromPassiveGroup(player, context);
}

export function getDamageConversionOptions(player, damageType) {
  return getDamageConversionOptionsFromPassiveGroup(player, damageType);
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

export function resolveTraitRoll(
  player,
  { stat, baseDiceCount, context, board = null, usePassives = true, extraDiceBonus = null }
) {
  const passiveDiceBonus = usePassives ? getTraitRollDiceBonus(player, context) : { amount: 0, sourceNames: [] };
  const boardDiceBonus = board ? getBoardTraitRollDiceBonus(board, player) : { amount: 0, sourceNames: [] };
  const diceBonus = {
    amount: passiveDiceBonus.amount + boardDiceBonus.amount + (extraDiceBonus?.amount || 0),
    sourceNames: [
      ...passiveDiceBonus.sourceNames,
      ...boardDiceBonus.sourceNames,
      ...(extraDiceBonus?.sourceNames || []),
    ],
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

export function getPostDamageEffectsForChoice(player, choice) {
  return getPostDamageEffectsForChoiceFromPassiveGroup(player, choice);
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
      disabledOptions: awaiting.disabledOptions || [],
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
        rollStat: awaiting.rollStat,
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
    const resolvedEffects = (matchedOutcome?.effects || []).map((effect) =>
      effect.stat === "rolled-trait" && da.rollStat ? { ...effect, rolledStat: da.rollStat } : effect
    );
    const prevLastRoll = g.eventState.lastRoll;
    const nextRollHistory = prevLastRoll
      ? [...(g.eventState.rollHistory || []), prevLastRoll]
      : g.eventState.rollHistory || [];

    return {
      handled: true,
      game: {
        ...g,
        eventState: {
          ...g.eventState,
          awaiting: null,
          rollHistory: nextRollHistory,
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
          const minSanity = g.gamePhase === "preHaunt" ? 1 : 0;
          const nextStatIndex = {
            ...player.statIndex,
            sanity: Math.max(minSanity, player.statIndex.sanity - sanityLoss),
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
