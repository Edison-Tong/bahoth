export function applyStatChangeState(players, playerIndex, stat, amount) {
  if (!amount) return players;

  return players.map((pl, i) => {
    if (i !== playerIndex) return pl;

    const maxIndex = pl.character[stat].length - 1;
    const nextIndex = Math.max(0, Math.min(maxIndex, pl.statIndex[stat] + amount));
    const newStatIndex = { ...pl.statIndex, [stat]: nextIndex };
    const isAlive = Object.values(newStatIndex).every((value) => value > 0);

    return { ...pl, statIndex: newStatIndex, isAlive };
  });
}

export function applyDamageAllocationState(players, playerIndex, allocation, adjustmentMode = "decrease") {
  return players.map((pl, i) => {
    if (i !== playerIndex) return pl;

    const newStatIndex = { ...pl.statIndex };
    for (const [stat, amount] of Object.entries(allocation)) {
      if (!amount) continue;
      const maxIndex = pl.character[stat].length - 1;
      newStatIndex[stat] =
        adjustmentMode === "increase"
          ? Math.min(maxIndex, newStatIndex[stat] + amount)
          : Math.max(0, newStatIndex[stat] - amount);
    }

    const isAlive = Object.values(newStatIndex).every((value) => value > 0);
    return { ...pl, statIndex: newStatIndex, isAlive };
  });
}

export function passTurnCoreState(g) {
  const shouldTakeExtraTurn = !!g.extraTurnAfterCurrent && !!g.players[g.currentPlayerIndex]?.isAlive;
  let next = shouldTakeExtraTurn ? g.currentPlayerIndex : (g.currentPlayerIndex + 1) % g.players.length;

  if (!shouldTakeExtraTurn) {
    let attempts = 0;
    while (!g.players[next].isAlive && attempts < g.players.length) {
      next = (next + 1) % g.players.length;
      attempts++;
    }
  }

  const nextPlayer = g.players[next];
  const speed = nextPlayer.character.speed[nextPlayer.statIndex.speed];
  const updatedPlayers = g.players.map((pl, i) => (i === next ? { ...pl, movesLeft: speed } : pl));

  return {
    game: {
      ...g,
      players: updatedPlayers,
      currentPlayerIndex: next,
      turnPhase: "move",
      movePath: [{ x: nextPlayer.x, y: nextPlayer.y, floor: nextPlayer.floor, cost: 0 }],
      pendingExplore: null,
      pendingSpecialPlacement: null,
      mysticElevatorReady: false,
      mysticElevatorUsed: false,
      tileEffect: null,
      damageChoice: null,
      rabbitFootPendingReroll: null,
      skeletonKeyArmed: false,
      eventState: null,
      extraTurnAfterCurrent: false,
      turnNumber: shouldTakeExtraTurn ? g.turnNumber : g.turnNumber + (next === 0 ? 1 : 0),
      message: shouldTakeExtraTurn
        ? `${nextPlayer.name}'s extra turn - ${speed} moves`
        : `${nextPlayer.name}'s turn - ${speed} moves`,
    },
    nextPlayerFloor: nextPlayer.floor,
  };
}

export function passTurnWithEndTurnItemsState(g, { resolveEndTurnItemPassiveState, passTurnCore, statLabels }) {
  const currentPlayer = g.players[g.currentPlayerIndex];
  const endTurnItemResolution = resolveEndTurnItemPassiveState(g);

  if (endTurnItemResolution.type === "choice") {
    return {
      ...g,
      tileEffect: endTurnItemResolution.tileEffect,
    };
  }

  if (endTurnItemResolution.type === "auto-apply") {
    const nextState = passTurnCore({
      ...g,
      players: endTurnItemResolution.players,
    });

    return {
      ...nextState,
      message: `${currentPlayer.name} gains 1 ${statLabels[endTurnItemResolution.gainedStat]} with ${
        endTurnItemResolution.sourceName || "Necklace of Teeth"
      }. ${nextState.message}`,
    };
  }

  return passTurnCore(g);
}
