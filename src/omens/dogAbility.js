export function isDogTradeAvailableThisTurn(game, viewedCard, getDogTradeTargets) {
  if (!viewedCard || viewedCard.ownerCollection !== "omens") return false;
  const owner = game.players?.[viewedCard.ownerIndex];
  const omenCard = owner?.omens?.[viewedCard.ownerCardIndex];
  if (!owner || !omenCard || omenCard.id !== "dog") return false;
  if (omenCard.lastActiveAbilityTurnUsed === game.turnNumber) return false;

  const targets = getDogTradeTargets(game, viewedCard.ownerIndex, 4);
  if (targets.length === 0) return false;

  const ownerHasItems = (owner.inventory || []).length > 0;
  const anyTargetHasItems = targets.some(({ playerIndex }) => (game.players[playerIndex]?.inventory || []).length > 0);
  return ownerHasItems || anyTargetHasItems;
}

export function createDogTradeStartState(game, viewedCard, getDogTradeTargets) {
  if (!viewedCard || viewedCard.activeAbilityRule?.action !== "dog-remote-trade") {
    return { ok: false, reason: "not-dog-action" };
  }

  const targets = getDogTradeTargets(game, viewedCard.ownerIndex, 4);
  if (targets.length === 0) {
    return {
      ok: false,
      reason: "no-targets",
      message: "Dog cannot find an explorer within 4 move points to trade with.",
    };
  }

  return {
    ok: true,
    dogTradeState: {
      phase: "move",
      ownerIndex: viewedCard.ownerIndex,
      dogOmenIndex: viewedCard.ownerCardIndex,
      floor: game.players[viewedCard.ownerIndex].floor,
      x: game.players[viewedCard.ownerIndex].x,
      y: game.players[viewedCard.ownerIndex].y,
      movesLeft: 4,
      targetPlayerIndex: null,
      ownerGiveIndexes: [],
      targetGiveIndexes: [],
    },
  };
}
