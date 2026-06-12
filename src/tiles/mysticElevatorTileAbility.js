import { getMysticElevatorDestination } from "../events/eventActions";

/* [TILE-EFFECT] [TILE-PLACEMENT] Converts a settled 2-die elevator roll into a tileEffect showing destination choices. Called after diceAnimation settles. */
export function resolveMysticElevatorResultState({ game, animation, total, getPlacementOptions }) {
  const player = game.players[game.currentPlayerIndex];
  const elevatorTile = game.board[player.floor]?.find((tile) => tile.x === player.x && tile.y === player.y);

  if (!elevatorTile || elevatorTile.id !== "mystic-elevator") {
    return {
      ...game,
      tileEffect: {
        type: "mystic-elevator-result",
        tileName: "Mystic Elevator",
        dice: animation.final,
        total,
        message: "The Mystic Elevator shudders, but nothing happens.",
        nextTurnPhase: "move",
        nextMessage:
          player.movesLeft > 0
            ? `${player.name} can keep moving. ${player.movesLeft} move${player.movesLeft !== 1 ? "s" : ""} left.`
            : `${player.name} has no moves left.`,
      },
    };
  }

  const destination = getMysticElevatorDestination(total);
  const boardWithoutElevator = {
    ...game.board,
    [player.floor]: (game.board[player.floor] || []).filter((tile) => tile !== elevatorTile),
  };
  const placements = getPlacementOptions(boardWithoutElevator, {
    ...elevatorTile,
    floors: destination.floors,
  }).filter(
    (placement) =>
      !(placement.floor === player.floor && placement.x === elevatorTile.x && placement.y === elevatorTile.y)
  );

  if (placements.length === 0) {
    return {
      ...game,
      tileEffect: {
        type: "mystic-elevator-result",
        tileName: "Mystic Elevator",
        dice: animation.final,
        total,
        message: `Rolled ${total}. The elevator can go to ${destination.label}, but there is no open doorway there.`,
        nextTurnPhase: "move",
        nextMessage:
          player.movesLeft > 0
            ? `${player.name} stays on the Mystic Elevator. ${player.movesLeft} move${player.movesLeft !== 1 ? "s" : ""} left.`
            : `${player.name} stays on the Mystic Elevator. No moves left.`,
      },
    };
  }

  return {
    ...game,
    tileEffect: {
      type: "mystic-elevator-result",
      tileName: "Mystic Elevator",
      dice: animation.final,
      total,
      message: `Rolled ${total}. Choose an open doorway on ${destination.label}.`,
      nextTurnPhase: "special-place",
      nextMessage: "Choose where to move the Mystic Elevator.",
      pendingSpecialPlacement: {
        mode: "move-existing",
        tile: elevatorTile,
        placements,
        selectedPlacementId: null,
        rotationIndex: 0,
        nextTurnPhase: "move",
        nextMessage:
          player.movesLeft > 0
            ? `${player.name} rides the Mystic Elevator. ${player.movesLeft} move${player.movesLeft !== 1 ? "s" : ""} left.`
            : `${player.name} rides the Mystic Elevator. No moves left.`,
      },
    },
  };
}

// Starts the elevator dice animation; marks the elevator as used. Called by handleRollMysticElevator.
/* [TILE-EFFECT] [DICE-ROLL] Rolls 2 dice for the Mystic Elevator and queues the diceAnimation. Returns { game, diceAnimation } or null if not usable. */
export function getRollMysticElevatorState(game, rollDice) {
  const player = game.players[game.currentPlayerIndex];
  const currentTile = game.board[player.floor]?.find((tile) => tile.x === player.x && tile.y === player.y);
  if (game.mysticElevatorUsed || currentTile?.id !== "mystic-elevator") {
    return null;
  }

  return {
    game: {
      ...game,
      mysticElevatorReady: false,
      mysticElevatorUsed: true,
      tileEffect: null,
      message: "Rolling for the Mystic Elevator...",
    },
    diceAnimation: {
      purpose: "mystic-elevator",
      final: rollDice(2),
      display: Array.from({ length: 2 }, () => Math.floor(Math.random() * 3)),
      settled: false,
      tileName: "Mystic Elevator",
    },
  };
}
