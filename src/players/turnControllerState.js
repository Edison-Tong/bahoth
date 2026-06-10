import { passTurnCoreState, passTurnWithEndTurnItemsState } from "./playerState";

// Advances to the next player without checking end-of-turn item passives.
// Called after end-of-turn sequences that have already handled passives.
export function resolvePassTurnCoreActionState(g) {
  const result = passTurnCoreState(g);
  return {
    game: result.game,
    cameraFloor: result.nextPlayerFloor,
  };
}

// Advances to the next player after checking Necklace of Teeth (and other end-of-turn item passives).
// Called by resolveEndTurnActionState after all tile effects are resolved.
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

// Main End Turn handler: checks tile effects (furnace, collapsed, etc.) first; if none, passes the turn.
// Returns { game, cameraFloor, diceAnimation }. Called by GameBoard handleEndTurn.
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
