// Registry picks the correct handler for now or value activation.

export function chooseItemAbilityNowState(g, viewedCard, deps = {}, handlers = {}) {
  const action = viewedCard?.activeAbilityRule?.action;

  const nowHandlers = {
    "reroll-all-trait-dice": () => handlers.applyCreepyDollNowState?.(g, viewedCard, deps),
    "reroll-blank-trait-dice": () => handlers.applyLuckyCoinNowState?.(g, viewedCard, null, deps),
    "reroll-one-die": () => handlers.applyRabbitsFootNowState?.(g, viewedCard, deps),
    "move-through-walls": () => handlers.applySkeletonKeyNowState?.(g, viewedCard, deps),
    "substitute-sanity-for-knowledge": () => handlers.applyMagicCameraNowState?.(g, viewedCard, deps),
    "substitute-knowledge-for-trait": () => handlers.applyBookNowState?.(g, viewedCard, deps),
    "teleport-any-tile": () => handlers.applyMapNowState?.(g, viewedCard),
    "mask-push-adjacent-players": () => handlers.applyMaskNowState?.(g, viewedCard),
    "extra-turn-after-current": () => handlers.applyMysticalStopwatchNowState?.(g, viewedCard),
    "heal-critical-traits": () => handlers.applyFirstAidKitNowState?.(g, viewedCard, null),
    "heal-stats": () => handlers.applyFirstAidKitNowState?.(g, viewedCard, null),
    "heal-knowledge-sanity": () => handlers.applyFirstAidKitNowState?.(g, viewedCard, null),
    "heal-might-speed": () => handlers.applyFirstAidKitNowState?.(g, viewedCard, null),
  };

  const result = nowHandlers[action]?.();
  if (result) return result;

  return {
    game: g,
    closeViewedCard: false,
    diceAnimation: null,
    queueTraitRollOverride: undefined,
  };
}

export function chooseItemAbilityValueState(g, total, viewedCard, deps = {}, handlers = {}) {
  const action = viewedCard?.activeAbilityRule?.action;

  if (action === "set-trait-roll-total") {
    const result = handlers.chooseAngelsFeatherValueState?.(g, total, viewedCard, deps);
    if (result) {
      return {
        ...result,
        diceAnimation: null,
      };
    }
  }

  if (action === "reroll-blank-trait-dice") {
    const result = handlers.applyLuckyCoinNowState?.(g, viewedCard, total, deps);
    if (result) {
      return {
        game: result.game,
        queueTraitRollOverride: undefined,
        closeViewedCard: result.closeViewedCard,
        diceAnimation: result.diceAnimation || null,
      };
    }
  }

  if (
    action === "heal-critical-traits" ||
    action === "heal-stats" ||
    action === "heal-knowledge-sanity" ||
    action === "heal-might-speed"
  ) {
    const result = handlers.applyFirstAidKitNowState?.(g, viewedCard, total);
    if (result) {
      return {
        game: result.game,
        queueTraitRollOverride: undefined,
        closeViewedCard: result.closeViewedCard,
        diceAnimation: null,
      };
    }
  }

  return {
    game: g,
    queueTraitRollOverride: undefined,
    closeViewedCard: false,
    diceAnimation: null,
  };
}
