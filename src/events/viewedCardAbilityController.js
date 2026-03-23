export function resolveUseViewedCardActiveAbilityNowState({
  game,
  viewedCard,
  viewedCardActiveAbilityState,
  drawnEventPrimaryAction,
  queuedTraitRollOverride,
  oppositeByDirection,
  getDogTradeTargets,
  resolveSpecialOmenNowAbilityState,
  chooseCardActiveAbilityNowState,
}) {
  if (!viewedCard || !viewedCardActiveAbilityState?.canUseNow) {
    return { handled: false };
  }

  const specialOmenNow = resolveSpecialOmenNowAbilityState(game, viewedCard, {
    oppositeByDirection,
    getDogTradeTargets,
  });
  if (specialOmenNow.handled) {
    return {
      handled: true,
      game: specialOmenNow.game || null,
      dogTradeState: specialOmenNow.dogTradeState || null,
      closeViewedCard: !!specialOmenNow.closeViewedCard,
      showUseNowPicker: false,
      diceAnimation: null,
      queueTraitRollOverride: undefined,
    };
  }

  if (!viewedCardActiveAbilityState.requiresValueSelection) {
    const result = chooseCardActiveAbilityNowState(game, viewedCard, {
      drawnEventPrimaryAction,
      queuedTraitRollOverride,
    });
    return {
      handled: true,
      game: result.game,
      dogTradeState: null,
      closeViewedCard: !!result.closeViewedCard,
      showUseNowPicker: false,
      diceAnimation: result.diceAnimation || null,
      queueTraitRollOverride: result.queueTraitRollOverride,
    };
  }

  return {
    handled: true,
    game: null,
    dogTradeState: null,
    closeViewedCard: false,
    showUseNowPicker: true,
    diceAnimation: null,
    queueTraitRollOverride: undefined,
  };
}

export function resolveChooseViewedCardActiveAbilityValueState({
  game,
  total,
  viewedCard,
  drawnEventPrimaryAction,
  queuedTraitRollOverride,
  chooseCardActiveAbilityValueState,
}) {
  if (!viewedCard) {
    return { handled: false };
  }

  const result = chooseCardActiveAbilityValueState(game, total, viewedCard, {
    drawnEventPrimaryAction,
    queuedTraitRollOverride,
  });

  return {
    handled: true,
    game: result.game,
    diceAnimation: result.diceAnimation || null,
    queueTraitRollOverride: result.queueTraitRollOverride,
    closeViewedCard: !!result.closeViewedCard,
  };
}
