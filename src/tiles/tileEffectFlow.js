export function resolveDismissTileEffectState(
  g,
  {
    cameraFloor,
    passTurn,
    isQueuedTileEffectType,
    isSkeletonKeyResultEffect,
    resolveSkeletonKeyResultAfterDismiss,
    getIdolChoiceStateForQueuedEvent,
    resolveDamageEffect,
    createDamageChoice,
    applyTileEffectConsequences,
  }
) {
  const effect = g.tileEffect;
  if (!effect) {
    return {
      game: passTurn(g),
      cameraFloor: null,
      clearDiceAnimation: true,
    };
  }

  if (isQueuedTileEffectType(effect.type)) {
    const nextCameraFloor = effect.pendingSpecialPlacement?.placements[0]?.floor || cameraFloor;

    if (isSkeletonKeyResultEffect(effect)) {
      return {
        game: resolveSkeletonKeyResultAfterDismiss(g, effect),
        cameraFloor: effect.pendingSpecialPlacement ? nextCameraFloor : null,
        clearDiceAnimation: true,
      };
    }

    const currentPlayer = g.players[g.currentPlayerIndex];
    const queuedEventCard = effect.pendingSpecialPlacement ? null : effect.queuedCard || null;
    const idolOfferState = getIdolChoiceStateForQueuedEvent({
      player: currentPlayer,
      tileName: effect.tileName,
      queuedCard: queuedEventCard,
      nextTurnPhase: effect.nextTurnPhase,
      nextMessage: effect.nextMessage,
      offerMessage: `${currentPlayer.name} discovered an Event symbol.`,
    });

    if (idolOfferState) {
      return {
        game: {
          ...g,
          tileEffect: idolOfferState.tileEffect,
          drawnCard: idolOfferState.drawnCard,
          pendingSpecialPlacement: effect.pendingSpecialPlacement || null,
          turnPhase: idolOfferState.turnPhase,
          message: idolOfferState.message,
        },
        cameraFloor: effect.pendingSpecialPlacement ? nextCameraFloor : null,
        clearDiceAnimation: true,
      };
    }

    return {
      game: {
        ...g,
        tileEffect: null,
        drawnCard: effect.pendingSpecialPlacement ? null : effect.queuedCard || null,
        pendingSpecialPlacement: effect.pendingSpecialPlacement || null,
        turnPhase: effect.nextTurnPhase,
        message: effect.nextMessage,
      },
      cameraFloor: effect.pendingSpecialPlacement ? nextCameraFloor : null,
      clearDiceAnimation: true,
    };
  }

  const pi = g.currentPlayerIndex;
  const currentPlayerState = g.players[pi];
  const resolvedEffect = resolveDamageEffect(currentPlayerState, effect);

  if (resolvedEffect.damage > 0 && resolvedEffect.damageType) {
    return {
      game: {
        ...g,
        tileEffect: null,
        damageChoice: createDamageChoice(resolvedEffect, currentPlayerState),
      },
      cameraFloor: null,
      clearDiceAnimation: true,
    };
  }

  const updatedPlayers = applyTileEffectConsequences(g, g.players, resolvedEffect);
  return {
    game: passTurn({ ...g, players: updatedPlayers, tileEffect: null, damageChoice: null }),
    cameraFloor: null,
    clearDiceAnimation: true,
  };
}
