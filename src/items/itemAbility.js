const PLAYER_STAT_ORDER = ["might", "speed", "sanity", "knowledge"];
const CRITICAL_STAT_INDEX = 1;

function getInventoryCard(game, viewedCard) {
  if (!viewedCard || viewedCard.ownerCollection !== "inventory") return null;
  const owner = game.players[viewedCard.ownerIndex];
  return owner?.inventory?.[viewedCard.ownerCardIndex] || null;
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

export function applyMapNowState(game, viewedCard) {
  if (!viewedCard) return { game, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.activeAbilityRule?.action !== "teleport-any-tile") {
    return { game, closeViewedCard: false, diceAnimation: null };
  }
  if (viewedCard.ownerCollection !== "inventory") return { game, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.ownerIndex !== game.currentPlayerIndex) return { game, closeViewedCard: false, diceAnimation: null };

  const owner = game.players[viewedCard.ownerIndex];
  const inventoryCard = getInventoryCard(game, viewedCard);
  if (!owner || !inventoryCard || inventoryCard.id !== "map") {
    return { game, closeViewedCard: false, diceAnimation: null };
  }

  const options = Object.entries(game.board)
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

export function applyMysticalStopwatchNowState(game, viewedCard) {
  if (!viewedCard) return { game, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.activeAbilityRule?.action !== "extra-turn-after-current") {
    return { game, closeViewedCard: false, diceAnimation: null };
  }
  if (viewedCard.ownerCollection !== "inventory") return { game, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.ownerIndex !== game.currentPlayerIndex) return { game, closeViewedCard: false, diceAnimation: null };

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