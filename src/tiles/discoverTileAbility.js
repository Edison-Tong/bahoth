function formatMovesLeft(player) {
  return `${player.movesLeft} move${player.movesLeft !== 1 ? "s" : ""} left.`;
}

export function drawWeaponItem(itemDeck) {
  const weaponIndex = itemDeck.findIndex((card) => card.isWeapon);
  if (weaponIndex === -1) {
    return {
      weaponCard: null,
      remainingDeck: [...itemDeck],
    };
  }

  const remainingDeck = [...itemDeck];
  const [weaponCard] = remainingDeck.splice(weaponIndex, 1);
  return {
    weaponCard,
    remainingDeck,
  };
}

export function applyPlacedTileDiscoverEffects({
  placedTile,
  player,
  currentPlayerIndex,
  board,
  tileStack,
  itemDeck,
  players,
  drawnCard,
  turnPhase,
  message,
  tileEffect,
  mysticElevatorUsed,
  getPlacementOptions,
  createDrawnItemCard,
  applyStatChange,
  statLabels,
}) {
  let nextBoard = board;
  let nextStack = tileStack;
  let nextItemDeck = itemDeck;
  let nextPlayers = players;
  let nextDrawnCard = drawnCard;
  let nextTurnPhase = turnPhase;
  let nextMessage = message;
  let nextTileEffect = tileEffect;
  let enableMysticElevator = false;

  if (placedTile.discoverEffect === "junk-room") {
    nextBoard = {
      ...nextBoard,
      [placedTile.floor]: nextBoard[placedTile.floor].map((tile) =>
        tile.x === placedTile.x && tile.y === placedTile.y ? { ...tile, obstacle: true } : tile
      ),
    };

    const junkMessage = `${player.name} places an obstacle token in the Junk Room.`;
    nextTileEffect = {
      type: "junk-room",
      tileName: placedTile.name,
      message: junkMessage,
      queuedCard: nextDrawnCard,
      nextTurnPhase: nextDrawnCard ? "card" : "move",
      nextMessage: nextDrawnCard
        ? `${junkMessage} ${nextDrawnCard.type.toUpperCase()} card appears...`
        : `${junkMessage} ${formatMovesLeft(player)}`,
    };

    nextDrawnCard = null;
    nextTurnPhase = "card";
    nextMessage = junkMessage;
  }

  if (placedTile.discoverEffect === "panic-room") {
    const secretAlreadyPlaced = Object.values(nextBoard).some((tiles) =>
      tiles.some((tile) => tile.id === "secret-staircase")
    );
    const secretIndex = nextStack.findIndex((tile) => tile.id === "secret-staircase");

    let panicMessage = "";
    if (!secretAlreadyPlaced && secretIndex !== -1) {
      const secretTile = nextStack[secretIndex];
      const placements = getPlacementOptions(nextBoard, secretTile);

      if (placements.length > 0) {
        nextStack = [...nextStack];
        nextStack.splice(secretIndex, 1);
        panicMessage = `${player.name} reveals the Secret Staircase. Choose any open doorway to place it.`;

        nextTileEffect = {
          type: "panic-room",
          tileName: placedTile.name,
          message: `${panicMessage} The tile stack is shuffled.`,
          queuedCard: nextDrawnCard,
          nextTurnPhase: "special-place",
          nextMessage: "Place the Secret Staircase on any open doorway.",
          pendingSpecialPlacement: {
            tile: secretTile,
            placements,
            queuedCard: nextDrawnCard,
            nextTurnPhase: nextDrawnCard ? "card" : "move",
            nextMessage: nextDrawnCard
              ? `${player.name} placed the Secret Staircase. An omen card appears...`
              : `${player.name} placed the Secret Staircase. ${formatMovesLeft(player)}`,
          },
        };
      } else {
        panicMessage = `${player.name} found the Secret Staircase, but there was nowhere to place it.`;

        nextTileEffect = {
          type: "panic-room",
          tileName: placedTile.name,
          message: `${panicMessage} The tile stack is shuffled.`,
          queuedCard: nextDrawnCard,
          nextTurnPhase: nextDrawnCard ? "card" : "move",
          nextMessage: nextDrawnCard
            ? `${panicMessage} An omen card appears...`
            : `${panicMessage} ${formatMovesLeft(player)}`,
        };
      }
    } else {
      panicMessage = "The Secret Staircase is already in play.";

      nextTileEffect = {
        type: "panic-room",
        tileName: placedTile.name,
        message: `${panicMessage} The tile stack is shuffled.`,
        queuedCard: nextDrawnCard,
        nextTurnPhase: nextDrawnCard ? "card" : "move",
        nextMessage: nextDrawnCard
          ? `${panicMessage} An omen card appears...`
          : `${panicMessage} ${formatMovesLeft(player)}`,
      };
    }

    nextStack = [...nextStack].sort(() => Math.random() - 0.5);
    nextDrawnCard = null;
    nextTurnPhase = nextTileEffect?.nextTurnPhase || "card";
    nextMessage = panicMessage;
  }

  if (placedTile.discoverEffect === "armory") {
    const { weaponCard, remainingDeck } = drawWeaponItem(nextItemDeck);
    nextItemDeck = remainingDeck;

    const armoryMessage = weaponCard
      ? `${player.name} searched the Armory and found ${weaponCard.name}.`
      : `${player.name} searched the Armory but found no weapon.`;

    nextTileEffect = {
      type: "armory",
      tileName: placedTile.name,
      message: armoryMessage,
      queuedCard: weaponCard ? createDrawnItemCard(weaponCard) : null,
      nextTurnPhase: weaponCard ? "card" : "move",
      nextMessage: weaponCard
        ? `${armoryMessage} A weapon item is taken.`
        : `${armoryMessage} ${formatMovesLeft(player)}`,
    };

    nextDrawnCard = null;
    nextTurnPhase = weaponCard ? "card" : "move";
    nextMessage = armoryMessage;
  }

  enableMysticElevator = placedTile.enterEffect === "mystic-elevator" && !mysticElevatorUsed;
  if (enableMysticElevator) {
    nextTileEffect = null;
    nextTurnPhase = "move";
    nextMessage = `${player.name} placed Mystic Elevator! Use Elevator to roll 2 dice.`;
  }

  if (placedTile.discoverGain) {
    const { stat, amount } = placedTile.discoverGain;
    const currentIndex = player.statIndex[stat];
    const maxIndex = player.character[stat].length - 1;
    const appliedAmount = Math.min(amount, maxIndex - currentIndex);

    nextPlayers = applyStatChange(nextPlayers, currentPlayerIndex, stat, appliedAmount);

    const nextValue = nextPlayers[currentPlayerIndex].character[stat][nextPlayers[currentPlayerIndex].statIndex[stat]];
    const statLabel = statLabels[stat] || stat;
    const gainMessage =
      appliedAmount > 0
        ? `${player.name} gains ${appliedAmount} ${statLabel} from ${placedTile.name}. ${statLabel} is now ${nextValue}.`
        : `${player.name} cannot gain more ${statLabel} from ${placedTile.name}.`;

    nextTileEffect = {
      type: "discover-gain",
      tileName: placedTile.name,
      gainStat: stat,
      gainAmount: appliedAmount,
      message: gainMessage,
      queuedCard: nextDrawnCard,
      nextTurnPhase: nextDrawnCard ? "card" : "move",
      nextMessage: nextDrawnCard
        ? `${gainMessage} ${nextDrawnCard.type.toUpperCase()} card appears...`
        : `${gainMessage} ${formatMovesLeft(player)}`,
    };

    nextDrawnCard = null;
    nextTurnPhase = "card";
    nextMessage = gainMessage;
  }

  return {
    board: nextBoard,
    tileStack: nextStack,
    itemDeck: nextItemDeck,
    players: nextPlayers,
    drawnCard: nextDrawnCard,
    turnPhase: nextTurnPhase,
    message: nextMessage,
    tileEffect: nextTileEffect,
    enableMysticElevator,
  };
}
