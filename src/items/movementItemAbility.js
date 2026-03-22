function getInventoryCard(game, viewedCard) {
  if (!viewedCard || viewedCard.ownerCollection !== "inventory") return null;
  const owner = game.players[viewedCard.ownerIndex];
  return owner?.inventory?.[viewedCard.ownerCardIndex] || null;
}

export function applyMapNowState(game, viewedCard) {
  if (!viewedCard) return { game, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.activeAbilityRule?.action !== "teleport-any-tile") {
    return { game, closeViewedCard: false, diceAnimation: null };
  }
  if (viewedCard.ownerCollection !== "inventory") return { game, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.ownerIndex !== game.currentPlayerIndex) return { game, closeViewedCard: false, diceAnimation: null };

  const owner = game.players[viewedCard.ownerIndex];
  const inventoryCard = getInventoryCard(game, viewedCard);
  if (!owner || !inventoryCard || inventoryCard.id !== "map") {
    return { game, closeViewedCard: false, diceAnimation: null };
  }

  const options = Object.entries(game.board)
    .flatMap(([floor, tiles]) =>
      (tiles || []).map((tile) => ({
        id: `${floor}:${tile.x}:${tile.y}`,
        label: tile.name || tile.id || `${floor} (${tile.x}, ${tile.y})`,
        x: tile.x,
        y: tile.y,
        floor,
      }))
    )
    .filter((option) => !(option.floor === owner.floor && option.x === owner.x && option.y === owner.y));

  if (options.length === 0) {
    return { game, closeViewedCard: false, diceAnimation: null };
  }

  const nextPlayers = game.players.map((player, index) =>
    index === viewedCard.ownerIndex
      ? {
          ...player,
          inventory: player.inventory.filter((_, cardIndex) => cardIndex !== viewedCard.ownerCardIndex),
        }
      : player
  );

  return {
    game: {
      ...game,
      players: nextPlayers,
      eventState: {
        card: {
          id: "item-map-teleport",
          name: inventoryCard.name,
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
          sourceName: inventoryCard.name,
          effect: {
            type: "move",
            destination: "any-tile",
          },
          options,
          selectedOptionId: null,
          prompt: "Choose any discovered tile.",
        },
      },
      message: `${owner.name} uses ${inventoryCard.name}. Choose a destination tile.`,
    },
    closeViewedCard: true,
    diceAnimation: null,
  };
}

export function hasSkeletonKeyWallMoveAvailable(game, viewedCard) {
  const inventoryCard = getInventoryCard(game, viewedCard);
  if (!inventoryCard || inventoryCard.id !== "skeleton-key") return false;

  const owner = game.players[viewedCard.ownerIndex];
  const board = game.board?.[owner?.floor] || [];
  const currentTile = board.find((tile) => tile.x === owner.x && tile.y === owner.y);
  if (!owner || !currentTile) return false;

  const dirs = [
    { name: "N", dx: 0, dy: -1 },
    { name: "S", dx: 0, dy: 1 },
    { name: "E", dx: 1, dy: 0 },
    { name: "W", dx: -1, dy: 0 },
  ];
  const opposite = { N: "S", S: "N", E: "W", W: "E" };

  return dirs.some(({ name, dx, dy }) => {
    const neighbor = board.find((tile) => tile.x === owner.x + dx && tile.y === owner.y + dy);
    if (!neighbor) return false;

    const normalPassage = currentTile.doors?.includes(name) && neighbor.doors?.includes(opposite[name]);
    return !normalPassage;
  });
}

export function canUseNormalMovementNow(game, viewedCard) {
  const owner = game.players?.[viewedCard?.ownerIndex];
  if (!owner || !owner.isAlive) return false;

  return (
    game.turnPhase === "move" &&
    !game.pendingExplore &&
    !game.pendingSpecialPlacement &&
    !game.tileEffect &&
    !game.damageChoice &&
    !game.drawnCard &&
    !game.eventState &&
    owner.movesLeft > 0
  );
}

export function applySkeletonKeyNowState(game, viewedCard) {
  if (!viewedCard) return { game, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.activeAbilityRule?.action !== "move-through-walls") {
    return { game, closeViewedCard: false, diceAnimation: null };
  }
  if (viewedCard.ownerCollection !== "inventory") return { game, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.ownerIndex !== game.currentPlayerIndex) return { game, closeViewedCard: false, diceAnimation: null };
  if (!canUseNormalMovementNow(game, viewedCard)) {
    return { game, closeViewedCard: false, diceAnimation: null };
  }
  if (!hasSkeletonKeyWallMoveAvailable(game, viewedCard)) {
    return { game, closeViewedCard: false, diceAnimation: null };
  }

  const owner = game.players[viewedCard.ownerIndex];
  const inventoryCard = getInventoryCard(game, viewedCard);
  if (!owner || !inventoryCard || inventoryCard.id !== "skeleton-key") {
    return { game, closeViewedCard: false, diceAnimation: null };
  }

  const nextPlayers = game.players.map((player, playerIndex) => {
    if (playerIndex !== viewedCard.ownerIndex) return player;

    return {
      ...player,
      inventory: player.inventory.map((card, cardIndex) =>
        cardIndex === viewedCard.ownerCardIndex
          ? {
              ...card,
              lastActiveAbilityTurnUsed: game.turnNumber,
            }
          : card
      ),
    };
  });

  return {
    game: {
      ...game,
      players: nextPlayers,
      skeletonKeyArmed: true,
      message: `${owner.name} uses ${inventoryCard.name}. Your next wall move costs movement normally.`,
    },
    closeViewedCard: true,
    diceAnimation: null,
  };
}
