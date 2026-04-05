const PLAYER_STAT_ORDER = ["might", "speed", "sanity", "knowledge"];
const CRITICAL_STAT_INDEX = 1;
const NECKLACE_OF_TEETH_ID = "necklace-of-teeth";
const NECKLACE_OF_TEETH_CHOICE_TYPE = "necklace-of-teeth-choice";

function getInventoryCard(game, viewedCard) {
  if (!viewedCard || viewedCard.ownerCollection !== "inventory") return null;
  const owner = game.players[viewedCard.ownerIndex];
  return owner?.inventory?.[viewedCard.ownerCardIndex] || null;
}

function getCriticalStats(player) {
  if (!player) return [];
  return PLAYER_STAT_ORDER.filter((stat) => player.statIndex?.[stat] === CRITICAL_STAT_INDEX);
}

function getNecklaceOfTeethCriticalStats(player) {
  if (!player) return [];

  return PLAYER_STAT_ORDER.filter((stat) => {
    const currentIndex = player.statIndex?.[stat];
    const maxIndex = (player.character?.[stat] || []).length - 1;
    return currentIndex === CRITICAL_STAT_INDEX && currentIndex < maxIndex;
  });
}

function applyNecklaceOfTeethGain(players, playerIndex, stat) {
  return players.map((player, index) => {
    if (index !== playerIndex) return player;

    const statTrack = player.character?.[stat];
    const currentIndex = player.statIndex?.[stat];
    if (!Array.isArray(statTrack) || currentIndex === undefined) return player;

    const maxIndex = statTrack.length - 1;
    const nextIndex = Math.min(maxIndex, currentIndex + 1);

    return {
      ...player,
      statIndex: {
        ...player.statIndex,
        [stat]: nextIndex,
      },
    };
  });
}

export function isNecklaceOfTeethChoiceEffect(effect) {
  return effect?.type === NECKLACE_OF_TEETH_CHOICE_TYPE;
}

function resolveNecklaceOfTeethEndTurnState(game) {
  const currentPlayer = game?.players?.[game.currentPlayerIndex];
  if (!currentPlayer) return { type: "none" };

  const necklaceCard = currentPlayer.inventory?.find((card) => card.id === NECKLACE_OF_TEETH_ID);
  if (!necklaceCard) return { type: "none" };

  const criticalStats = getNecklaceOfTeethCriticalStats(currentPlayer);
  if (criticalStats.length > 1) {
    return {
      type: "choice",
      tileEffect: {
        type: NECKLACE_OF_TEETH_CHOICE_TYPE,
        tileName: necklaceCard.name,
        statOptions: criticalStats,
        message: "Choose a critical trait to gain 1, or skip.",
      },
    };
  }

  if (criticalStats.length === 1) {
    const gainedStat = criticalStats[0];
    return {
      type: "auto-gain",
      gainedStat,
      players: applyNecklaceOfTeethGain(game.players, game.currentPlayerIndex, gainedStat),
    };
  }

  return { type: "none" };
}

function resolveNecklaceOfTeethChoiceState(game, stat) {
  const effect = game?.tileEffect;
  if (!isNecklaceOfTeethChoiceEffect(effect)) return null;
  if (!Array.isArray(effect.statOptions) || !effect.statOptions.includes(stat)) return null;

  return {
    gainedStat: stat,
    players: applyNecklaceOfTeethGain(game.players, game.currentPlayerIndex, stat),
  };
}

export function resolveEndTurnItemPassiveState(game) {
  const necklaceResolution = resolveNecklaceOfTeethEndTurnState(game);
  if (necklaceResolution.type === "choice") {
    return {
      type: "choice",
      source: NECKLACE_OF_TEETH_ID,
      tileEffect: necklaceResolution.tileEffect,
    };
  }

  if (necklaceResolution.type === "auto-gain") {
    return {
      type: "auto-apply",
      source: NECKLACE_OF_TEETH_ID,
      sourceName: "Necklace of Teeth",
      gainedStat: necklaceResolution.gainedStat,
      players: necklaceResolution.players,
    };
  }

  return { type: "none" };
}

export function isEndTurnItemChoiceEffect(effect) {
  return isNecklaceOfTeethChoiceEffect(effect);
}

export function resolveEndTurnItemPassiveChoiceState(game, choice = {}) {
  const effect = game?.tileEffect;
  if (!isEndTurnItemChoiceEffect(effect)) return null;

  const necklaceChoice = resolveNecklaceOfTeethChoiceState(game, choice.stat);
  if (!necklaceChoice) return null;

  return {
    type: "auto-apply",
    source: NECKLACE_OF_TEETH_ID,
    sourceName: effect.tileName || "Necklace of Teeth",
    gainedStat: necklaceChoice.gainedStat,
    players: necklaceChoice.players,
  };
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

export function getActiveHealRule(viewedCard) {
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

export function canUseHealAbilityNow(game, viewedCard) {
  const inventoryCard = getInventoryCard(game, viewedCard);
  if (!inventoryCard) return false;
  const healRule = getActiveHealRule(viewedCard);
  if (!healRule) return false;

  return getHealTargetIndexes(game, viewedCard, healRule).length > 0;
}

export function getHealTargetOptions(game, viewedCard, healRule) {
  return getHealTargetIndexes(game, viewedCard, healRule).map((index) => ({
    value: index,
    label: game.players[index]?.name || `Player ${index + 1}`,
  }));
}

export function applyFirstAidKitNowState(game, viewedCard, targetPlayerIndex = null) {
  if (!viewedCard) return { game, closeViewedCard: false, diceAnimation: null };

  const healRule = getActiveHealRule(viewedCard);
  if (!healRule) {
    return { game, closeViewedCard: false, diceAnimation: null };
  }
  if (viewedCard.ownerCollection !== "inventory") return { game, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.ownerIndex !== game.currentPlayerIndex) return { game, closeViewedCard: false, diceAnimation: null };

  const owner = game.players[viewedCard.ownerIndex];
  const inventoryCard = getInventoryCard(game, viewedCard);
  if (!inventoryCard) {
    return { game, closeViewedCard: false, diceAnimation: null };
  }

  const healTargetIndexes = getHealTargetIndexes(game, viewedCard, healRule);
  if (healTargetIndexes.length === 0) {
    return { game, closeViewedCard: false, diceAnimation: null };
  }

  const resolvedTargetIndex =
    healTargetIndexes.find((index) => index === Number(targetPlayerIndex)) ??
    healTargetIndexes.find((index) => index === viewedCard.ownerIndex) ??
    healTargetIndexes[0];
  const targetPlayer = game.players[resolvedTargetIndex];
  const healableStats = getHealableStats(targetPlayer, healRule);
  if (healableStats.length === 0) {
    return { game, closeViewedCard: false, diceAnimation: null };
  }

  const nextPlayers = game.players.map((player, playerIndex) => {
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
      ...game,
      players: nextPlayers,
      message: `${owner.name} uses ${inventoryCard.name} to heal ${targetPlayer.name}'s ${
        healableStats.length === 1 ? "critical trait" : "critical traits"
      } to starting values.`,
    },
    closeViewedCard: true,
    diceAnimation: null,
  };
}

export function applyMysticalStopwatchNowState(game, viewedCard) {
  if (!viewedCard) return { game, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.activeAbilityRule?.action !== "extra-turn-after-current") {
    return { game, closeViewedCard: false, diceAnimation: null };
  }
  if (viewedCard.ownerCollection !== "inventory") return { game, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.ownerIndex !== game.currentPlayerIndex) return { game, closeViewedCard: false, diceAnimation: null };
  if (game.gamePhase !== "hauntActive") return { game, closeViewedCard: false, diceAnimation: null };

  const owner = game.players[viewedCard.ownerIndex];
  const inventoryCard = getInventoryCard(game, viewedCard);
  if (!owner || !inventoryCard || inventoryCard.id !== "mystical-stopwatch") {
    return { game, closeViewedCard: false, diceAnimation: null };
  }

  const nextPlayers = game.players.map((player, index) =>
    index === viewedCard.ownerIndex
      ? {
          ...player,
          inventory: player.inventory.filter((_, cardIndex) => cardIndex !== viewedCard.ownerCardIndex),
        }
      : player
  );

  return {
    game: {
      ...game,
      players: nextPlayers,
      extraTurnAfterCurrent: true,
      message: `${owner.name} uses ${inventoryCard.name} and will take another turn after this one.`,
    },
    closeViewedCard: true,
    diceAnimation: null,
  };
}
