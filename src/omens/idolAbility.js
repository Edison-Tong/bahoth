export function hasIdol(player) {
  return (player?.omens || []).some((card) => card.id === "idol");
}

function normalizeIdolNextTurnPhase(nextTurnPhase) {
  return nextTurnPhase === "card" ? "move" : nextTurnPhase;
}

export function shouldOfferIdolChoice({ player, queuedCard, blockedByTileEffect = false }) {
  return hasIdol(player) && !blockedByTileEffect && queuedCard?.type === "event";
}

export function buildIdolChoiceTileEffect({ tileName, queuedCard, nextTurnPhase, nextMessage }) {
  return {
    type: "idol-event-choice",
    tileName,
    queuedCard,
    nextTurnPhase: normalizeIdolNextTurnPhase(nextTurnPhase),
    nextMessage,
    message: "Use Idol to skip drawing this Event card?",
  };
}

export function getIdolChoiceStateForQueuedEvent({
  player,
  tileName,
  queuedCard,
  nextTurnPhase,
  nextMessage,
  blockedByTileEffect = false,
  offerMessage,
}) {
  if (
    !shouldOfferIdolChoice({
      player,
      queuedCard,
      blockedByTileEffect,
    })
  ) {
    return null;
  }

  return {
    tileEffect: buildIdolChoiceTileEffect({
      tileName,
      queuedCard,
      nextTurnPhase,
      nextMessage,
    }),
    drawnCard: null,
    turnPhase: "card",
    message: offerMessage || `${player?.name || "Explorer"} discovered an Event symbol.`,
  };
}

export function applyDrawIdolEventCardState(game) {
  const effect = game.tileEffect;
  if (!effect || effect.type !== "idol-event-choice") return game;

  const eventCard = effect.queuedCard;
  if (!eventCard || eventCard.type !== "event") {
    return {
      ...game,
      tileEffect: null,
      turnPhase: effect.nextTurnPhase || "move",
      message: effect.nextMessage || game.message,
    };
  }

  return {
    ...game,
    tileEffect: null,
    drawnCard: eventCard,
    turnPhase: "card",
    message: `${game.players[game.currentPlayerIndex].name} draws an Event card.`,
  };
}

export function applySkipIdolEventCardState(game) {
  const effect = game.tileEffect;
  if (!effect || effect.type !== "idol-event-choice") return game;

  return {
    ...game,
    tileEffect: null,
    drawnCard: null,
    turnPhase: effect.nextTurnPhase || "move",
    message: effect.nextMessage || `${game.players[game.currentPlayerIndex].name} skips drawing the Event card.`,
  };
}
