import { createDogTradeStartState } from "./dogAbility";
import { applyHolySymbolDuringPendingExplore } from "./holySymbolAbility";

export function resolveSpecialOmenNowAbilityState(game, viewedCard, { oppositeByDirection, getDogTradeTargets }) {
  const action = viewedCard?.activeAbilityRule?.action;

  if (action === "holy-symbol-bury-discovered-tile") {
    return {
      handled: true,
      game: applyHolySymbolDuringPendingExplore(game, oppositeByDirection),
      closeViewedCard: true,
    };
  }

  if (action === "dog-remote-trade") {
    const dogStart = createDogTradeStartState(game, viewedCard, getDogTradeTargets);
    if (!dogStart.ok) {
      return {
        handled: true,
        game: {
          ...game,
          message: dogStart.message || "Dog cannot be used right now.",
        },
        closeViewedCard: false,
      };
    }

    return {
      handled: true,
      dogTradeState: dogStart.dogTradeState,
      closeViewedCard: true,
    };
  }

  return { handled: false };
}
