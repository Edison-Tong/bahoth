export function getBookUsageState({
  game,
  viewedCard,
  drawnEventPrimaryAction,
  queuedTraitRollOverride,
  getTraitRollRequiredUsageState,
}) {
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
    base.canApplyNow &&
    ((awaiting?.type === "roll-ready" && awaiting.rollKind === "trait-roll" && !!awaiting.rollStat) ||
      awaiting?.type === "step-stat-choice");
  const canQueueForDrawnEvent = base.canQueueForDrawnEvent && !!drawnEventPrimaryAction?.isTraitRoll;

  return {
    canApplyNow,
    canQueueForDrawnEvent,
    canUseBookNow: canApplyNow || canQueueForDrawnEvent,
  };
}

export function applyBookNowState(game, viewedCard, deps) {
  const {
    drawnEventPrimaryAction,
    queuedTraitRollOverride = null,
    getBookUsageStateForContext,
    getEventRollButtonLabel,
    statLabels,
  } = deps;

  if (!viewedCard) return { game, closeViewedCard: false, diceAnimation: null, queueTraitRollOverride: undefined };
  if (viewedCard.activeAbilityRule?.action !== "substitute-knowledge-for-trait") {
    return { game, closeViewedCard: false, diceAnimation: null, queueTraitRollOverride: undefined };
  }
  if (viewedCard.ownerCollection !== "omens") {
    return { game, closeViewedCard: false, diceAnimation: null, queueTraitRollOverride: undefined };
  }
  if (viewedCard.ownerIndex !== game.currentPlayerIndex) {
    return { game, closeViewedCard: false, diceAnimation: null, queueTraitRollOverride: undefined };
  }

  const usageState = getBookUsageStateForContext({
    game,
    viewedCard,
    drawnEventPrimaryAction,
    queuedTraitRollOverride,
  });
  if (!usageState.canApplyNow && !usageState.canQueueForDrawnEvent) {
    return { game, closeViewedCard: false, diceAnimation: null, queueTraitRollOverride: undefined };
  }

  const owner = game.players[viewedCard.ownerIndex];
  const omenCard = owner?.omens?.[viewedCard.ownerCardIndex] || null;
  if (!owner || !omenCard) {
    return { game, closeViewedCard: false, diceAnimation: null, queueTraitRollOverride: undefined };
  }

  const nextPlayers = game.players.map((player, playerIndex) => {
    if (playerIndex !== viewedCard.ownerIndex) return player;

    return {
      ...player,
      omens: player.omens.map((card, cardIndex) =>
        cardIndex === viewedCard.ownerCardIndex
          ? {
              ...card,
              lastActiveAbilityTurnUsed: game.turnNumber,
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
    nextOwner?.character?.knowledge?.[nextOwner?.statIndex?.knowledge] ?? game.eventState?.awaiting?.baseDiceCount;

  if (usageState.canQueueForDrawnEvent && !usageState.canApplyNow) {
    return {
      game: {
        ...game,
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

  const awaiting = game.eventState?.awaiting;

  if (awaiting?.type === "step-stat-choice") {
    const nextOwner = nextPlayers[viewedCard.ownerIndex];
    const ownerKnowledgeDice = nextOwner?.character?.knowledge?.[nextOwner?.statIndex?.knowledge];
    return {
      game: {
        ...game,
        players: nextPlayers,
        eventState: {
          ...game.eventState,
          pendingRollSubstitute: {
            to: "knowledge",
            from: "any",
            sourceName: omenCard.name,
            knowledgeDiceCount: ownerKnowledgeDice,
          },
        },
        message: `${owner.name} uses ${omenCard.name}, loses 1 Sanity, and will roll Knowledge for the next trait they choose.`,
      },
      closeViewedCard: true,
      diceAnimation: null,
      queueTraitRollOverride: undefined,
    };
  }

  if (!awaiting || awaiting.type !== "roll-ready" || awaiting.rollKind !== "trait-roll" || !awaiting.rollStat) {
    return { game, closeViewedCard: false, diceAnimation: null, queueTraitRollOverride: undefined };
  }

  return {
    game: {
      ...game,
      players: nextPlayers,
      eventState: {
        ...game.eventState,
        awaiting: {
          ...awaiting,
          rollStat: "knowledge",
          baseDiceCount: ownerKnowledgeDice,
          prompt: `${getEventRollButtonLabel(ownerKnowledgeDice)} for ${statLabels.knowledge}.`,
        },
      },
      message: `${owner.name} uses ${omenCard.name}, loses 1 Sanity, and will roll Knowledge instead of ${
        statLabels[awaiting.rollStat] || awaiting.rollStat
      }.`,
    },
    closeViewedCard: true,
    diceAnimation: null,
    queueTraitRollOverride: undefined,
  };
}
