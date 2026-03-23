import { passTurnCoreState, passTurnWithEndTurnItemsState } from "./playerState";

export function resolvePassTurnCoreActionState(g) {
  const result = passTurnCoreState(g);
  return {
    game: result.game,
    cameraFloor: result.nextPlayerFloor,
  };
}

export function resolvePassTurnActionState(g, { resolveEndTurnItemPassiveState, statLabels }) {
  let nextPlayerFloor = null;
  const game = passTurnWithEndTurnItemsState(g, {
    resolveEndTurnItemPassiveState,
    passTurnCore: (state) => {
      const coreResult = passTurnCoreState(state);
      nextPlayerFloor = coreResult.nextPlayerFloor;
      return coreResult.game;
    },
    statLabels,
  });

  return {
    game,
    cameraFloor: nextPlayerFloor,
  };
}

export function resolveEndTurnActionState(
  g,
  {
    isItemAbilityTileChoiceAwaiting,
    getEndTurnTileAbilityState,
    rollDice,
    resolveTraitRoll,
    getDamageReduction,
    createDiceModifier,
    resolveEndTurnItemPassiveState,
    statLabels,
  }
) {
  if (isItemAbilityTileChoiceAwaiting(g.eventState)) {
    return { game: g, cameraFloor: null, diceAnimation: null };
  }

  const currentPlayer = g.players[g.currentPlayerIndex];
  const currentTile = g.board[currentPlayer.floor]?.find(
    (tile) => tile.x === currentPlayer.x && tile.y === currentPlayer.y
  );

  const endTurnTileState = getEndTurnTileAbilityState({
    game: g,
    player: currentPlayer,
    tile: currentTile,
    currentPlayerIndex: g.currentPlayerIndex,
    rollDice,
    resolveTraitRoll,
    getDamageReduction,
    createDiceModifier,
  });

  if (endTurnTileState) {
    return {
      game: endTurnTileState.game,
      cameraFloor: null,
      diceAnimation: endTurnTileState.diceAnimation || null,
    };
  }

  const passTurnResult = resolvePassTurnActionState(g, {
    resolveEndTurnItemPassiveState,
    statLabels,
  });

  return {
    game: passTurnResult.game,
    cameraFloor: passTurnResult.cameraFloor,
    diceAnimation: null,
  };
}
