export function getItemAbilitySelectionState({
  game,
  viewedCard,
  rule,
  drawnEventPrimaryAction,
  queuedTraitRollOverride,
  deps,
}) {
  const {
    getActiveHealRule,
    getHealTargetOptions,
    getLuckyCoinSequenceRerollOptions,
    isCreepyDollAvailableThisTurn,
    isLuckyCoinAvailableThisTurn,
    isRabbitsFootAvailableThisTurn,
    canUseHealAbilityNow,
    isMaskPushAvailableThisTurn,
    isDogTradeAvailableThisTurn,
    canUseNormalMovementNow,
    hasSkeletonKeyWallMoveAvailable,
    getMagicCameraUsageState,
    getBookUsageState,
  } = deps;

  const healRule = getActiveHealRule(viewedCard);
  const luckyCoinSequenceOptions =
    rule.action === "reroll-blank-trait-dice" ? getLuckyCoinSequenceRerollOptions(game) : [];
  const healTargetOptions =
    rule.action === "heal-critical-traits" ||
    rule.action === "heal-stats" ||
    rule.action === "heal-knowledge-sanity" ||
    rule.action === "heal-might-speed"
      ? getHealTargetOptions(game, viewedCard, healRule || {})
      : [];

  const valueOptions =
    rule.action === "set-trait-roll-total"
      ? rule.valueSelection === "number-0-8"
        ? Array.from({ length: 9 }, (_, value) => value)
        : rule.valueOptions || []
      : rule.action === "heal-critical-traits" ||
          rule.action === "heal-stats" ||
          rule.action === "heal-knowledge-sanity" ||
          rule.action === "heal-might-speed"
        ? healTargetOptions
        : rule.action === "reroll-blank-trait-dice" && luckyCoinSequenceOptions.length > 0
          ? luckyCoinSequenceOptions
          : rule.valueOptions || [];

  const requiresValueSelection =
    rule.action === "set-trait-roll-total" ||
    ((rule.action === "heal-critical-traits" ||
      rule.action === "heal-stats" ||
      rule.action === "heal-knowledge-sanity" ||
      rule.action === "heal-might-speed") &&
      healTargetOptions.length > 1) ||
    (rule.action === "reroll-blank-trait-dice" && luckyCoinSequenceOptions.length > 0);

  const actionSatisfied =
    rule.action === "heal-critical-traits" ||
    rule.action === "heal-stats" ||
    rule.action === "heal-knowledge-sanity" ||
    rule.action === "heal-might-speed"
      ? canUseHealAbilityNow(game, viewedCard)
      : rule.action === "reroll-all-trait-dice"
        ? isCreepyDollAvailableThisTurn(game, viewedCard)
        : rule.action === "reroll-blank-trait-dice"
          ? isLuckyCoinAvailableThisTurn(game, viewedCard)
          : rule.action === "reroll-one-die"
            ? isRabbitsFootAvailableThisTurn(game, viewedCard)
            : rule.action === "holy-symbol-bury-discovered-tile"
              ? game.turnPhase === "rotate" && !!game.pendingExplore && !game.pendingExplore.holySymbolReplacement
              : rule.action === "mask-push-adjacent-players"
                ? isMaskPushAvailableThisTurn(game, viewedCard)
                : rule.action === "dog-remote-trade"
                  ? isDogTradeAvailableThisTurn(game, viewedCard)
                  : rule.action === "move-through-walls"
                    ? canUseNormalMovementNow(game, viewedCard) && hasSkeletonKeyWallMoveAvailable(game, viewedCard)
                    : rule.action === "substitute-sanity-for-knowledge"
                      ? getMagicCameraUsageState({ game, drawnEventPrimaryAction, queuedTraitRollOverride })
                          .canUseMagicCameraNow
                      : rule.action === "substitute-knowledge-for-trait"
                        ? getBookUsageState({ game, viewedCard, drawnEventPrimaryAction, queuedTraitRollOverride })
                            .canUseBookNow
                        : true;

  return {
    actionSatisfied,
    valueOptions,
    requiresValueSelection,
  };
}
