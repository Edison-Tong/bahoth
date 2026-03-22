export function isCreepyDollAvailableThisTurn(game, viewedCard, deps) {
  const { getInventoryCard, isTraitRollResult } = deps;
  const inventoryCard = getInventoryCard(game, viewedCard);
  if (!inventoryCard || inventoryCard.id !== "creepy-doll") return false;
  if (inventoryCard.lastActiveAbilityTurnUsed === game.turnNumber) return false;

  const lastRoll = game.eventState?.lastRoll;
  return !!lastRoll && Array.isArray(lastRoll.dice) && Array.isArray(lastRoll.outcomes) && isTraitRollResult(lastRoll);
}

export function isLuckyCoinAvailableThisTurn(game, viewedCard, deps) {
  const { getInventoryCard, isTraitRollResult } = deps;
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

export function isRabbitsFootAvailableThisTurn(game, viewedCard, deps) {
  const { getInventoryCard } = deps;
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
  const lastRoll = game.eventState?.lastRoll;
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
      eventState: {
        ...game.eventState,
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

export function applyLuckyCoinNowState(game, viewedCard, targetRollSelection = null, deps) {
  const { isLuckyCoinAvailable, getInventoryCard, getLuckyCoinSequenceRerollOptions, rollDice, statLabels } = deps;

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

  const baseRoll =
    resolvedSequenceTarget && awaiting?.type === "trait-roll-sequence-complete"
      ? awaiting.results?.[Number(String(resolvedSequenceTarget.value).replace("sequence:", ""))]
      : game.eventState?.lastRoll;
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
      purpose: "event-partial-reroll",
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
  const { isRabbitsFootAvailable, getInventoryCard } = deps;

  if (!viewedCard) return { game, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.activeAbilityRule?.action !== "reroll-one-die") {
    return { game, closeViewedCard: false, diceAnimation: null };
  }
  if (viewedCard.ownerCollection !== "inventory") return { game, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.ownerIndex !== game.currentPlayerIndex) return { game, closeViewedCard: false, diceAnimation: null };
  if (!isRabbitsFootAvailable(game, viewedCard)) return { game, closeViewedCard: false, diceAnimation: null };

  const owner = game.players[viewedCard.ownerIndex];
  const inventoryCard = getInventoryCard(game, viewedCard);
  const lastRoll = game.eventState?.lastRoll;
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
      ? "event-last-roll"
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
