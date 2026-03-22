import {
  applyCreepyDollNowState as applyCreepyDollNowStateFromReroll,
  applyLuckyCoinNowState as applyLuckyCoinNowStateFromReroll,
  applyRabbitsFootNowState as applyRabbitsFootNowStateFromReroll,
  getLuckyCoinSequenceRerollOptions as getLuckyCoinSequenceRerollOptionsFromReroll,
  isCreepyDollAvailableThisTurn as isCreepyDollAvailableThisTurnFromReroll,
  isLuckyCoinAvailableThisTurn as isLuckyCoinAvailableThisTurnFromReroll,
  isRabbitsFootAvailableThisTurn as isRabbitsFootAvailableThisTurnFromReroll,
} from "./rerollItemAbility";
import {
  applyMagicCameraNowState as applyMagicCameraNowStateFromSource,
  getMagicCameraUsageState as getMagicCameraUsageStateFromSource,
} from "./skeletonKeyMagicCameraAbility";

export function getAngelsFeatherUsageState({ game, drawnEventPrimaryAction, queuedTraitRollOverride }, deps) {
  const { getTraitRollRequiredUsageState } = deps;
  const base = getTraitRollRequiredUsageState({ game, drawnEventPrimaryAction, queuedTraitRollOverride });
  return {
    ...base,
    canUseAngelsFeatherNow: base.canUseNow,
  };
}

export function isCreepyDollAvailableThisTurn(game, viewedCard, deps) {
  return isCreepyDollAvailableThisTurnFromReroll(game, viewedCard, deps);
}

export function isLuckyCoinAvailableThisTurn(game, viewedCard, deps) {
  return isLuckyCoinAvailableThisTurnFromReroll(game, viewedCard, deps);
}

export function isRabbitsFootAvailableThisTurn(game, viewedCard, deps) {
  return isRabbitsFootAvailableThisTurnFromReroll(game, viewedCard, deps);
}

export function getLuckyCoinSequenceRerollOptions(game, deps) {
  return getLuckyCoinSequenceRerollOptionsFromReroll(game, deps);
}

export function applyCreepyDollNowState(game, viewedCard, deps) {
  return applyCreepyDollNowStateFromReroll(game, viewedCard, deps);
}

export function applyLuckyCoinNowState(game, viewedCard, targetRollSelection = null, deps) {
  return applyLuckyCoinNowStateFromReroll(game, viewedCard, targetRollSelection, deps);
}

export function applyRabbitsFootNowState(game, viewedCard, deps) {
  return applyRabbitsFootNowStateFromReroll(game, viewedCard, deps);
}

export function getMagicCameraUsageState(params, deps) {
  return getMagicCameraUsageStateFromSource(params, deps);
}

export function applyMagicCameraNowState(game, viewedCard, args = {}, deps) {
  return applyMagicCameraNowStateFromSource(game, viewedCard, args, deps);
}

export function chooseAngelsFeatherValueState(g, total, viewedCard, deps, helpers) {
  const {
    getMatchingOutcome,
    describeEventEffects,
    statLabels,
    getAngelsFeatherUsageState,
  } = helpers;

  const { drawnEventPrimaryAction, queuedTraitRollOverride = null } = deps;
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
            label: statLabels[awaiting.rollStat] || awaiting.label || "Trait",
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
