export function isMaskPushAvailableThisTurn(game, viewedCard, getMovementNeighbors) {
  if (!viewedCard || viewedCard.ownerCollection !== "omens") return false;
  const owner = game.players?.[viewedCard.ownerIndex];
  const omenCard = owner?.omens?.[viewedCard.ownerCardIndex];
  if (!owner || !omenCard || omenCard.id !== "mask") return false;
  if (omenCard.lastActiveAbilityTurnUsed === game.turnNumber) return false;

  const hasOtherExplorerOnTile = (game.players || []).some(
    (player, index) =>
      index !== viewedCard.ownerIndex &&
      player.isAlive &&
      player.floor === owner.floor &&
      player.x === owner.x &&
      player.y === owner.y
  );
  if (!hasOtherExplorerOnTile) return false;

  const adjacent = getMovementNeighbors(
    game.board,
    {
      floor: owner.floor,
      x: owner.x,
      y: owner.y,
    },
    { ignoreObstacles: true }
  );
  return adjacent.length > 0;
}

export function applyMaskNowState(game, viewedCard, deps) {
  const { isMaskAvailable, getDogMoveOptions, getTileByPosition } = deps;

  if (!viewedCard) return { game, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.activeAbilityRule?.action !== "mask-push-adjacent-players") {
    return { game, closeViewedCard: false, diceAnimation: null };
  }
  if (viewedCard.ownerCollection !== "omens") return { game, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.ownerIndex !== game.currentPlayerIndex) return { game, closeViewedCard: false, diceAnimation: null };
  if (!isMaskAvailable(game, viewedCard)) return { game, closeViewedCard: false, diceAnimation: null };

  const owner = game.players[viewedCard.ownerIndex];
  const omenCard = owner?.omens?.[viewedCard.ownerCardIndex];
  if (!owner || !omenCard || omenCard.id !== "mask") {
    return { game, closeViewedCard: false, diceAnimation: null };
  }

  const options = getDogMoveOptions(
    game,
    {
      floor: owner.floor,
      x: owner.x,
      y: owner.y,
    },
    1
  ).map((option) => {
    const tile = getTileByPosition(game.board, option.floor, option.x, option.y);
    return {
      id: `${option.floor}:${option.x}:${option.y}`,
      label: tile?.name || `${option.floor} (${option.x}, ${option.y})`,
      x: option.x,
      y: option.y,
      floor: option.floor,
    };
  });

  if (options.length === 0) {
    return { game, closeViewedCard: false, diceAnimation: null };
  }

  const targetPlayerIndexes = (game.players || [])
    .map((player, index) => ({ player, index }))
    .filter(
      ({ player, index }) =>
        index !== viewedCard.ownerIndex &&
        player.isAlive &&
        player.floor === owner.floor &&
        player.x === owner.x &&
        player.y === owner.y
    )
    .map(({ index }) => index);

  if (targetPlayerIndexes.length === 0) {
    return { game, closeViewedCard: false, diceAnimation: null };
  }

  const firstTargetIndex = targetPlayerIndexes[0];
  const firstTargetName = game.players[firstTargetIndex]?.name || "explorer";

  const nextPlayers = game.players.map((player, index) =>
    index === viewedCard.ownerIndex
      ? {
          ...player,
          omens: player.omens.map((card, cardIndex) =>
            cardIndex === viewedCard.ownerCardIndex
              ? {
                  ...card,
                  lastActiveAbilityTurnUsed: game.turnNumber,
                }
              : card
          ),
        }
      : player
  );

  return {
    game: {
      ...game,
      players: nextPlayers,
      eventState: {
        card: {
          id: "omen-mask-push",
          name: omenCard.name,
        },
        stepIndex: 0,
        context: {
          choices: {},
          selectedStats: {},
        },
        pendingEffects: [],
        summary: null,
        lastRoll: null,
        awaiting: {
          type: "tile-choice",
          source: "item-active-ability",
          sourceName: omenCard.name,
          effect: {
            type: "mask-push-players",
            fromFloor: owner.floor,
            fromX: owner.x,
            fromY: owner.y,
            targetPlayerIndexes,
            activeTargetOffset: 0,
          },
          options,
          selectedOptionId: null,
          prompt: `Choose a doorway-connected adjacent tile for ${firstTargetName}.`,
        },
      },
      message: `Now moving ${firstTargetName}`,
    },
    closeViewedCard: true,
    diceAnimation: null,
  };
}

export function previewMaskTileChoiceState(game, option, getTileAtPosition) {
  const awaiting = game.eventState?.awaiting;
  if (awaiting?.type !== "tile-choice") return null;
  if (awaiting.effect?.type !== "mask-push-players" || awaiting.source !== "item-active-ability") return null;

  const tile = getTileAtPosition(game.board, option.x, option.y, option.floor);
  if (!tile) return null;

  const targetPlayerIndexes = Array.isArray(awaiting.effect.targetPlayerIndexes)
    ? awaiting.effect.targetPlayerIndexes
    : [];
  const activeTargetOffset = Number(awaiting.effect.activeTargetOffset) || 0;
  const targetPlayerIndex = targetPlayerIndexes[activeTargetOffset];
  if (!Number.isInteger(targetPlayerIndex)) return null;

  const targetName = game.players[targetPlayerIndex]?.name || "Explorer";

  return {
    game: {
      ...game,
      players: game.players.map((player, index) =>
        index === targetPlayerIndex
          ? {
              ...player,
              x: tile.x,
              y: tile.y,
              floor: option.floor,
            }
          : player
      ),
      eventState: {
        ...game.eventState,
        awaiting: {
          ...awaiting,
          selectedOptionId: option.id,
        },
      },
      message: `Now moving ${targetName}`,
    },
    cameraFloor: option.floor,
  };
}

export function confirmMaskTileChoiceState(game, selectedOption, tile) {
  const awaiting = game.eventState?.awaiting;
  if (awaiting?.type !== "tile-choice") return null;
  if (awaiting.effect?.type !== "mask-push-players" || awaiting.source !== "item-active-ability") return null;

  const targetPlayerIndexes = Array.isArray(awaiting.effect.targetPlayerIndexes)
    ? awaiting.effect.targetPlayerIndexes
    : [];
  const activeTargetOffset = Number(awaiting.effect.activeTargetOffset) || 0;
  const targetPlayerIndex = targetPlayerIndexes[activeTargetOffset];

  if (!Number.isInteger(targetPlayerIndex)) {
    return {
      game: {
        ...game,
        eventState: null,
        message: `${game.players[game.currentPlayerIndex].name} finishes using ${awaiting.sourceName || "Mask"}.`,
      },
      cameraFloor: null,
    };
  }

  const nextPlayers = game.players.map((player, index) =>
    index === targetPlayerIndex
      ? {
          ...player,
          x: tile.x,
          y: tile.y,
          floor: selectedOption.floor,
        }
      : player
  );

  const nextOffset = activeTargetOffset + 1;
  const hasMoreTargets = nextOffset < targetPlayerIndexes.length;
  const targetName = game.players[targetPlayerIndex]?.name || "Explorer";

  if (!hasMoreTargets) {
    return {
      game: {
        ...game,
        players: nextPlayers,
        eventState: null,
        message: `${game.players[game.currentPlayerIndex].name} pushes ${targetName} to ${selectedOption.label} with ${awaiting.sourceName || "Mask"}.`,
      },
      cameraFloor: selectedOption.floor,
    };
  }

  const nextTargetIndex = targetPlayerIndexes[nextOffset];
  const nextTargetName = game.players[nextTargetIndex]?.name || "explorer";

  return {
    game: {
      ...game,
      players: nextPlayers,
      eventState: {
        ...game.eventState,
        awaiting: {
          ...awaiting,
          effect: {
            ...awaiting.effect,
            activeTargetOffset: nextOffset,
          },
          selectedOptionId: null,
          prompt: `Choose a doorway-connected adjacent tile for ${nextTargetName}.`,
        },
      },
      message: `Now moving ${nextTargetName}`,
    },
    cameraFloor: selectedOption.floor,
  };
}
