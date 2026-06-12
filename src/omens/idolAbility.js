/* [OMEN] [LOOKUP] Returns true if the player currently holds the Idol omen. */
export function hasIdol(player) {
  return (player?.omens || []).some((card) => card.id === "idol");
}

/* [OMEN] Normalises the Idol's nextTurnPhase: maps "card" → "move" so the player keeps their move phase after drawing. */
function normalizeIdolNextTurnPhase(nextTurnPhase) {
  return nextTurnPhase === "card" ? "move" : nextTurnPhase;
}

/* [OMEN] [VALIDATION] Returns true if the Idol choice should be offered (player has Idol, there's a queued event card, no blocking tileEffect). */
export function shouldOfferIdolChoice({ player, queuedCard, blockedByTileEffect = false }) {
  return hasIdol(player) && !blockedByTileEffect && queuedCard?.type === "event";
}

/* [OMEN] [TILE-EFFECT] Builds the idol-event-choice tileEffect object for the draw/skip prompt. */
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

/* [OMEN] [TILE-EFFECT] Returns a tileEffect state offering the player the Idol choice (draw or skip the Event card). Returns null if the player doesn't have the Idol or there's no queued event card. */
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

/* [OMEN] [EVENT] Applies the player's choice to draw the queued Event card (clears the idol-event-choice tileEffect). */
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

/* [OMEN] [TILE-EFFECT] Applies the player's choice to skip the queued Event card (advances turnPhase without drawing). */
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
