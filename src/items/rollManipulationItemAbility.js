function getInventoryCard(game, viewedCard) {
  if (!viewedCard || viewedCard.ownerCollection !== "inventory") return null;
  const owner = game.players[viewedCard.ownerIndex];
  return owner?.inventory?.[viewedCard.ownerCardIndex] || null;
}

function getTraitRollSource(game) {
  const hauntRoll = game.hauntActionRoll;
  if (hauntRoll?.status === "rolled-pending-continue" && hauntRoll.lastRoll && Array.isArray(hauntRoll.lastRoll.dice)) {
    return {
      sourceType: "haunt-action-roll",
      roll: hauntRoll.lastRoll,
    };
  }

  const eventRoll = game.eventState?.lastRoll;
  if (eventRoll && Array.isArray(eventRoll.dice)) {
    return {
      sourceType: "event-last-roll",
      roll: eventRoll,
    };
  }

  return null;
}

export function getAngelsFeatherUsageState({ game, drawnEventPrimaryAction, queuedTraitRollOverride }, deps) {
  const { getTraitRollRequiredUsageState } = deps;
  const base = getTraitRollRequiredUsageState({ game, drawnEventPrimaryAction, queuedTraitRollOverride });
  const canApplyToHauntActionRoll =
    game.hauntActionRoll?.status === "awaiting-roll" ||
    (game.hauntActionRoll?.status === "rolled-pending-continue" && !game.hauntActionRoll?.isCollapsedRoll);
  const canApplyNow = base.canApplyNow || canApplyToHauntActionRoll;
  return {
    ...base,
    canApplyNow,
    canUseNow: canApplyNow || base.canQueueForDrawnEvent,
    canUseAngelsFeatherNow: canApplyNow || base.canQueueForDrawnEvent,
  };
}

export function isCreepyDollAvailableThisTurn(game, viewedCard, deps) {
  const { isTraitRollResult } = deps;
  const inventoryCard = getInventoryCard(game, viewedCard);
  if (!inventoryCard || inventoryCard.id !== "creepy-doll") return false;
  if (inventoryCard.lastActiveAbilityTurnUsed === game.turnNumber) return false;

  const rollSource = getTraitRollSource(game);
  const lastRoll = rollSource?.roll;
  return !!lastRoll && Array.isArray(lastRoll.dice) && Array.isArray(lastRoll.outcomes) && isTraitRollResult(lastRoll);
}

export function isLuckyCoinAvailableThisTurn(game, viewedCard, deps) {
  const { isTraitRollResult } = deps;
  const inventoryCard = getInventoryCard(game, viewedCard);
  if (!inventoryCard || inventoryCard.id !== "lucky-coin") return false;
  if (inventoryCard.lastActiveAbilityTurnUsed === game.turnNumber) return false;

  const awaiting = game.eventState?.awaiting;
  if (awaiting?.type === "trait-roll-sequence-complete" && Array.isArray(awaiting.results)) {
    return awaiting.results.some((result) => Array.isArray(result?.dice) && result.dice.some((value) => value === 0));
  }

  const rollSource = getTraitRollSource(game);
  const lastRoll = rollSource?.roll;
  if (!lastRoll || !Array.isArray(lastRoll.dice) || !Array.isArray(lastRoll.outcomes)) return false;
  if (!isTraitRollResult(lastRoll)) return false;
  return lastRoll.dice.some((value) => value === 0);
}

export function isRabbitsFootAvailableThisTurn(game, viewedCard) {
  const inventoryCard = getInventoryCard(game, viewedCard);
  if (!inventoryCard || inventoryCard.id !== "rabbits-foot") return false;
  if (inventoryCard.lastActiveAbilityTurnUsed === game.turnNumber) return false;

  const rollSource = getTraitRollSource(game);
  const lastRoll = rollSource?.roll;
  if (!!lastRoll && Array.isArray(lastRoll.dice) && lastRoll.dice.length > 0 && Array.isArray(lastRoll.outcomes)) {
    return true;
  }

  return (
    game.tileEffect?.type === "skeleton-key-result" &&
    Array.isArray(game.tileEffect?.dice) &&
    game.tileEffect.dice.length > 0
  );
}

export function getLuckyCoinSequenceRerollOptions(game, deps) {
  const { statLabels } = deps;
  const awaiting = game.eventState?.awaiting;
  if (awaiting?.type !== "trait-roll-sequence-complete" || !Array.isArray(awaiting.results)) return [];

  return awaiting.results
    .map((result, index) => ({ result, index }))
    .filter(({ result }) => Array.isArray(result?.dice) && result.dice.some((value) => value === 0))
    .map(({ result, index }) => ({
      value: `sequence:${index}`,
      label: `${statLabels[result.stat] || result.stat || "Trait"} (${result.total})`,
    }));
}

export function applyCreepyDollNowState(game, viewedCard, deps) {
  const { isCreepyDollAvailable, rollDice } = deps;

  if (!viewedCard) return { game, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.activeAbilityRule?.action !== "reroll-all-trait-dice") {
    return { game, closeViewedCard: false, diceAnimation: null };
  }
  if (viewedCard.ownerCollection !== "inventory") return { game, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.ownerIndex !== game.currentPlayerIndex) return { game, closeViewedCard: false, diceAnimation: null };
  if (!isCreepyDollAvailable(game, viewedCard)) return { game, closeViewedCard: false, diceAnimation: null };

  const owner = game.players[viewedCard.ownerIndex];
  const inventoryCard = owner?.inventory?.[viewedCard.ownerCardIndex];
  const rollSource = getTraitRollSource(game);
  const lastRoll = rollSource?.roll;
  const isHauntRoll = rollSource?.sourceType === "haunt-action-roll";
  if (!inventoryCard || inventoryCard.id !== "creepy-doll" || !lastRoll || !Array.isArray(lastRoll.dice)) {
    return { game, closeViewedCard: false, diceAnimation: null };
  }

  const rerolledDice = rollDice(lastRoll.dice.length);
  const previousDiceTotal = (lastRoll.dice || []).reduce((sum, value) => sum + value, 0);
  const staticBonus = (lastRoll.total || 0) - previousDiceTotal;
  const rerolledTotal = rerolledDice.reduce((sum, value) => sum + value, 0) + staticBonus;

  const nextPlayers = game.players.map((player, playerIndex) => {
    if (playerIndex !== viewedCard.ownerIndex) return player;

    const nextInventory = player.inventory.map((card, cardIndex) =>
      cardIndex === viewedCard.ownerCardIndex
        ? {
            ...card,
            lastActiveAbilityTurnUsed: game.turnNumber,
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
      ...game,
      players: nextPlayers,
      eventState: game.eventState
        ? {
            ...game.eventState,
            summary: null,
          }
        : game.eventState,
      message: `${owner.name} uses Creepy Doll, rerolls the trait roll, and loses 1 Sanity...`,
    },
    closeViewedCard: true,
    diceAnimation: {
      purpose: isHauntRoll ? "haunt-action-roll" : "event-roll",
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

export function applyLuckyCoinNowState(game, viewedCard, targetRollSelection = null, deps) {
  const { isLuckyCoinAvailable, getLuckyCoinSequenceRerollOptions, rollDice, statLabels } = deps;

  if (!viewedCard) return { game, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.activeAbilityRule?.action !== "reroll-blank-trait-dice") {
    return { game, closeViewedCard: false, diceAnimation: null };
  }
  if (viewedCard.ownerCollection !== "inventory") return { game, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.ownerIndex !== game.currentPlayerIndex) return { game, closeViewedCard: false, diceAnimation: null };
  if (!isLuckyCoinAvailable(game, viewedCard)) return { game, closeViewedCard: false, diceAnimation: null };

  const owner = game.players[viewedCard.ownerIndex];
  const inventoryCard = getInventoryCard(game, viewedCard);
  if (!inventoryCard) {
    return { game, closeViewedCard: false, diceAnimation: null };
  }

  const awaiting = game.eventState?.awaiting;
  const sequenceOptions = getLuckyCoinSequenceRerollOptions(game);
  const sequenceTargetValue = String(targetRollSelection || "");
  const resolvedSequenceTarget =
    sequenceOptions.find((option) => option.value === sequenceTargetValue) ||
    (sequenceOptions.length > 0 && awaiting?.type === "trait-roll-sequence-complete" ? sequenceOptions[0] : null);

  const rollSource = getTraitRollSource(game);
  const defaultBaseRoll = rollSource?.roll;
  const isHauntRoll = rollSource?.sourceType === "haunt-action-roll";
  const baseRoll =
    resolvedSequenceTarget && awaiting?.type === "trait-roll-sequence-complete"
      ? awaiting.results?.[Number(String(resolvedSequenceTarget.value).replace("sequence:", ""))]
      : defaultBaseRoll;
  if (!baseRoll || !Array.isArray(baseRoll.dice)) {
    return { game, closeViewedCard: false, diceAnimation: null };
  }

  const blankIndexes = baseRoll.dice.reduce((acc, die, index) => {
    if (die === 0) acc.push(index);
    return acc;
  }, []);
  if (blankIndexes.length === 0) {
    return { game, closeViewedCard: false, diceAnimation: null };
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
  const nextPlayers = game.players.map((player, playerIndex) => {
    if (playerIndex !== viewedCard.ownerIndex) return player;

    const nextInventory = player.inventory.map((card, cardIndex) =>
      cardIndex === viewedCard.ownerCardIndex
        ? {
            ...card,
            lastActiveAbilityTurnUsed: game.turnNumber,
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
      ...game,
      players: nextPlayers,
      message: `${owner.name} flips Lucky Coin and rerolls blank dice...`,
    },
    closeViewedCard: true,
    diceAnimation: {
      purpose: isHauntRoll ? "haunt-action-partial-reroll" : "event-partial-reroll",
      final: nextDice,
      display: [...baseRoll.dice],
      settled: false,
      label: baseRoll.label || statLabels[baseRoll.stat] || "Trait",
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

export function applyRabbitsFootNowState(game, viewedCard, deps) {
  const { isRabbitsFootAvailable } = deps;

  if (!viewedCard) return { game, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.activeAbilityRule?.action !== "reroll-one-die") {
    return { game, closeViewedCard: false, diceAnimation: null };
  }
  if (viewedCard.ownerCollection !== "inventory") return { game, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.ownerIndex !== game.currentPlayerIndex) return { game, closeViewedCard: false, diceAnimation: null };
  if (!isRabbitsFootAvailable(game, viewedCard)) return { game, closeViewedCard: false, diceAnimation: null };

  const owner = game.players[viewedCard.ownerIndex];
  const inventoryCard = getInventoryCard(game, viewedCard);
  const rollSource = getTraitRollSource(game);
  const lastRoll = rollSource?.roll;
  const isHauntRoll = rollSource?.sourceType === "haunt-action-roll";
  const skeletonKeyRollDice =
    game.tileEffect?.type === "skeleton-key-result" && Array.isArray(game.tileEffect?.dice)
      ? game.tileEffect.dice
      : null;

  if (
    !owner ||
    !inventoryCard ||
    ((!lastRoll || !Array.isArray(lastRoll.dice) || lastRoll.dice.length === 0 || !Array.isArray(lastRoll.outcomes)) &&
      (!skeletonKeyRollDice || skeletonKeyRollDice.length === 0))
  ) {
    return { game, closeViewedCard: false, diceAnimation: null };
  }

  const sourceType =
    !!lastRoll && Array.isArray(lastRoll.dice) && lastRoll.dice.length > 0 && Array.isArray(lastRoll.outcomes)
      ? isHauntRoll
        ? "haunt-action-roll"
        : "event-last-roll"
      : "skeleton-key-roll";

  return {
    game: {
      ...game,
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

export function getMagicCameraUsageState(params, deps) {
  const { game, drawnEventPrimaryAction, queuedTraitRollOverride } = params;
  const { getTraitRollRequiredUsageState } = deps;

  const base = getTraitRollRequiredUsageState({ game, drawnEventPrimaryAction, queuedTraitRollOverride });
  const awaiting = game.eventState?.awaiting;
  const hauntRoll = game.hauntActionRoll;
  const canApplyNow =
    base.canApplyNow &&
    ((awaiting?.type === "roll-ready" && awaiting.rollKind === "trait-roll" && awaiting.rollStat === "knowledge") ||
      (hauntRoll?.status === "awaiting-roll" && hauntRoll.stat === "knowledge") ||
      (awaiting?.type === "step-stat-choice" && (awaiting.options || []).includes("knowledge")));
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

export function applyMagicCameraNowState(game, viewedCard, args = {}, deps) {
  const { drawnEventPrimaryAction, queuedTraitRollOverride = null } = args;
  const { getMagicCameraUsageState, getEventRollButtonLabel, statLabels } = deps;

  if (!viewedCard) return { game, closeViewedCard: false, diceAnimation: null, queueTraitRollOverride: undefined };
  if (viewedCard.activeAbilityRule?.action !== "substitute-sanity-for-knowledge") {
    return { game, closeViewedCard: false, diceAnimation: null, queueTraitRollOverride: undefined };
  }
  if (viewedCard.ownerCollection !== "inventory") {
    return { game, closeViewedCard: false, diceAnimation: null, queueTraitRollOverride: undefined };
  }
  if (viewedCard.ownerIndex !== game.currentPlayerIndex) {
    return { game, closeViewedCard: false, diceAnimation: null, queueTraitRollOverride: undefined };
  }

  const usageState = getMagicCameraUsageState({ game, drawnEventPrimaryAction, queuedTraitRollOverride });
  if (!usageState.canApplyNow && !usageState.canQueueForDrawnEvent) {
    return { game, closeViewedCard: false, diceAnimation: null, queueTraitRollOverride: undefined };
  }

  const owner = game.players[viewedCard.ownerIndex];
  const inventoryCard = getInventoryCard(game, viewedCard);

  if (usageState.canQueueForDrawnEvent && !usageState.canApplyNow) {
    return {
      game: {
        ...game,
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

  const awaiting = game.eventState?.awaiting;
  if (!owner || !inventoryCard) {
    return { game, closeViewedCard: false, diceAnimation: null, queueTraitRollOverride: undefined };
  }

  if (game.hauntActionRoll?.status === "awaiting-roll" && game.hauntActionRoll.stat === "knowledge") {
    const sanityDiceCount = owner.character?.sanity?.[owner.statIndex?.sanity] ?? game.hauntActionRoll.baseDiceCount;
    return {
      game: {
        ...game,
        hauntActionRoll: {
          ...game.hauntActionRoll,
          stat: "sanity",
          label: statLabels.sanity,
          baseDiceCount: sanityDiceCount,
        },
        message: `${owner.name} uses ${inventoryCard.name} and will roll Sanity instead of Knowledge.`,
      },
      closeViewedCard: true,
      diceAnimation: null,
      queueTraitRollOverride: undefined,
    };
  }

  if (awaiting?.type === "step-stat-choice") {
    return {
      game: {
        ...game,
        eventState: {
          ...game.eventState,
          pendingRollSubstitute: { to: "sanity", from: "knowledge", sourceName: inventoryCard.name },
        },
        message: `${owner.name} will use ${inventoryCard.name} on the Knowledge roll they choose.`,
      },
      closeViewedCard: true,
      diceAnimation: null,
      queueTraitRollOverride: undefined,
    };
  }

  if (!awaiting || awaiting.type !== "roll-ready") {
    return { game, closeViewedCard: false, diceAnimation: null, queueTraitRollOverride: undefined };
  }

  const sanityDiceCount = owner.character?.sanity?.[owner.statIndex?.sanity] ?? awaiting.baseDiceCount;
  return {
    game: {
      ...game,
      eventState: {
        ...game.eventState,
        awaiting: {
          ...awaiting,
          rollStat: "sanity",
          baseDiceCount: sanityDiceCount,
          prompt: `${getEventRollButtonLabel(sanityDiceCount)} for ${statLabels.sanity}.`,
        },
      },
      message: `${owner.name} uses ${inventoryCard.name} and will roll Sanity instead of Knowledge.`,
    },
    closeViewedCard: true,
    diceAnimation: null,
    queueTraitRollOverride: undefined,
  };
}

export function chooseAngelsFeatherValueState(g, total, viewedCard, deps, helpers) {
  const { getMatchingOutcome, describeEventEffects, statLabels, getAngelsFeatherUsageState } = helpers;

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

  if (canApplyNow && awaiting?.type === "step-stat-choice") {
    return {
      game: {
        ...g,
        players: nextPlayers,
        eventState: {
          ...g.eventState,
          featherPendingTotal: forcedTotal,
        },
        message: `${owner.name} buries Angel's Feather and sets the next roll to ${forcedTotal}. Choose a trait to apply it to.`,
      },
      queueTraitRollOverride: null,
      closeViewedCard: true,
    };
  }

  if (canApplyNow && g.hauntActionRoll?.status === "awaiting-roll") {
    return {
      game: {
        ...g,
        players: nextPlayers,
        hauntActionRoll: {
          ...g.hauntActionRoll,
          forcedTotal,
        },
        message: `${owner.name} buries Angel's Feather and sets this roll to ${forcedTotal}.`,
      },
      queueTraitRollOverride: null,
      closeViewedCard: true,
    };
  }

  if (canApplyNow && g.hauntActionRoll?.status === "rolled-pending-continue") {
    return {
      game: {
        ...g,
        players: nextPlayers,
        hauntActionRoll: {
          ...g.hauntActionRoll,
          forcedTotal,
          lastRoll: {
            ...(g.hauntActionRoll.lastRoll || {}),
            total: forcedTotal,
          },
        },
        message: `${owner.name} buries Angel's Feather and sets this roll to ${forcedTotal}.`,
      },
      queueTraitRollOverride: null,
      closeViewedCard: true,
    };
  }

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
