export function hasSkeletonKeyWallMoveAvailable(game, viewedCard, deps) {
  const { getInventoryCard } = deps;
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

export function canUseNormalMovementNow(game, viewedCard) {
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

export function getMagicCameraUsageState(params, deps) {
  const { game, drawnEventPrimaryAction, queuedTraitRollOverride } = params;
  const { getTraitRollRequiredUsageState } = deps;

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

export function applyMagicCameraNowState(game, viewedCard, args = {}, deps) {
  const { drawnEventPrimaryAction, queuedTraitRollOverride = null } = args;
  const { getMagicCameraUsageState, getInventoryCard, getEventRollButtonLabel, statLabels } = deps;

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
  if (!owner || !inventoryCard || !awaiting || awaiting.type !== "roll-ready") {
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

export function applySkeletonKeyNowState(game, viewedCard, deps) {
  const { canUseNormalMovementNow, hasSkeletonKeyWallMoveAvailable, getInventoryCard } = deps;

  if (!viewedCard) return { game, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.activeAbilityRule?.action !== "move-through-walls") {
    return { game, closeViewedCard: false, diceAnimation: null };
  }
  if (viewedCard.ownerCollection !== "inventory") return { game, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.ownerIndex !== game.currentPlayerIndex) return { game, closeViewedCard: false, diceAnimation: null };
  if (!canUseNormalMovementNow(game, viewedCard)) {
    return { game, closeViewedCard: false, diceAnimation: null };
  }
  if (!hasSkeletonKeyWallMoveAvailable(game, viewedCard)) {
    return { game, closeViewedCard: false, diceAnimation: null };
  }

  const owner = game.players[viewedCard.ownerIndex];
  const inventoryCard = getInventoryCard(game, viewedCard);
  if (!owner || !inventoryCard || inventoryCard.id !== "skeleton-key") {
    return { game, closeViewedCard: false, diceAnimation: null };
  }

  const nextPlayers = game.players.map((player, playerIndex) => {
    if (playerIndex !== viewedCard.ownerIndex) return player;

    return {
      ...player,
      inventory: player.inventory.map((card, cardIndex) =>
        cardIndex === viewedCard.ownerCardIndex
          ? {
              ...card,
              lastActiveAbilityTurnUsed: game.turnNumber,
            }
          : card
      ),
    };
  });

  return {
    game: {
      ...game,
      players: nextPlayers,
      skeletonKeyArmed: true,
      message: `${owner.name} uses ${inventoryCard.name}. Your next wall move costs movement normally.`,
    },
    closeViewedCard: true,
    diceAnimation: null,
  };
}
