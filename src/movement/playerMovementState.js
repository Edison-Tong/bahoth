export function getValidMovesState({
  game,
  currentPlayer,
  DIR,
  OPPOSITE,
  getTileAt,
  getLeaveMoveCost,
  canUseArmedSkeletonKeyMovement,
  isItemAbilityTileChoiceAwaiting,
}) {
  if (game.turnPhase !== "move") return [];
  if (isItemAbilityTileChoiceAwaiting(game.eventState)) {
    return [];
  }

  if (game.pendingExplore) {
    const path = game.movePath;
    if (path.length >= 2) {
      const prev = path[path.length - 2];
      const dx = prev.x - currentPlayer.x;
      const dy = prev.y - currentPlayer.y;
      const dir = Object.entries(DIR).find(([, v]) => v.dx === dx && v.dy === dy)?.[0];
      if (dir) {
        return [{ dir, x: prev.x, y: prev.y, type: "backtrack" }];
      }
    }
    return [];
  }

  const tile = getTileAt(currentPlayer.x, currentPlayer.y, currentPlayer.floor);
  if (!tile) return [];

  const path = game.movePath;
  const backtrackPos = path.length >= 2 ? path[path.length - 2] : null;

  const moves = [];
  const moveCost = getLeaveMoveCost(tile);
  const canUseSkeletonKeyMovement = canUseArmedSkeletonKeyMovement(game, currentPlayer);

  for (const dir of tile.doors) {
    const { dx, dy } = DIR[dir];
    const nx = currentPlayer.x + dx;
    const ny = currentPlayer.y + dy;
    const neighbor = getTileAt(nx, ny, currentPlayer.floor);

    if (neighbor) {
      if (neighbor.doors.includes(OPPOSITE[dir])) {
        const isBacktrack =
          backtrackPos && backtrackPos.x === nx && backtrackPos.y === ny && backtrackPos.floor === currentPlayer.floor;
        if (isBacktrack) {
          moves.push({ dir, x: nx, y: ny, type: "backtrack" });
        } else if (currentPlayer.movesLeft >= moveCost) {
          moves.push({ dir, x: nx, y: ny, type: "move", cost: moveCost });
        }
      }
    } else if (currentPlayer.movesLeft >= moveCost) {
      moves.push({ dir, x: nx, y: ny, type: "explore", cost: moveCost });
    }
  }

  if (canUseSkeletonKeyMovement && currentPlayer.movesLeft >= moveCost) {
    for (const dir of ["N", "S", "E", "W"]) {
      const { dx, dy } = DIR[dir];
      const nx = currentPlayer.x + dx;
      const ny = currentPlayer.y + dy;
      const neighbor = getTileAt(nx, ny, currentPlayer.floor);
      if (!neighbor) continue;

      const isAlreadyReachable = tile.doors.includes(dir) && neighbor.doors.includes(OPPOSITE[dir]);
      if (isAlreadyReachable) continue;

      const isBacktrack =
        backtrackPos && backtrackPos.x === nx && backtrackPos.y === ny && backtrackPos.floor === currentPlayer.floor;
      if (isBacktrack) continue;

      moves.push({ dir, x: nx, y: ny, type: "wall-move", cost: moveCost });
    }
  }

  return moves;
}

export function movePlayerState(
  g,
  { nx, ny, cost, useSkeletonKey, skeletonKeyRoll, getLeaveMoveCost, canUseArmedSkeletonKeyMovement }
) {
  const player = g.players[g.currentPlayerIndex];
  const currentTile = g.board[player.floor]?.find((t) => t.x === player.x && t.y === player.y);
  const resolvedCost = cost ?? getLeaveMoveCost(currentTile);
  if (player.movesLeft < resolvedCost) return g;

  if (useSkeletonKey && !canUseArmedSkeletonKeyMovement(g, player)) return g;

  const movesLeft = player.movesLeft - resolvedCost;
  const newPath = [...g.movePath, { x: nx, y: ny, floor: player.floor, cost: resolvedCost }];
  const destinationTile = g.board[player.floor]?.find((tile) => tile.x === nx && tile.y === ny);

  const updatedPlayers = g.players.map((p, i) => {
    if (i !== g.currentPlayerIndex) return p;

    return {
      ...p,
      x: nx,
      y: ny,
      movesLeft,
    };
  });

  const baseMessage =
    destinationTile?.enterEffect === "mystic-elevator" && !g.mysticElevatorUsed
      ? `${g.players[g.currentPlayerIndex].name} entered the Mystic Elevator. Use Elevator to roll 2 dice.`
      : movesLeft > 0
        ? `${g.players[g.currentPlayerIndex].name} - ${movesLeft} move${movesLeft !== 1 ? "s" : ""} left`
        : `${g.players[g.currentPlayerIndex].name} - no moves left`;

  const skeletonKeyMessage =
    useSkeletonKey && skeletonKeyRoll !== null
      ? `Skeleton Key roll: ${skeletonKeyRoll}. Resolve the result after you continue.`
      : "";

  return {
    ...g,
    players: updatedPlayers,
    movePath: newPath,
    mysticElevatorReady:
      destinationTile?.enterEffect === "mystic-elevator" && !g.mysticElevatorUsed ? true : g.mysticElevatorReady,
    skeletonKeyArmed: useSkeletonKey ? false : g.skeletonKeyArmed,
    message: skeletonKeyMessage ? `${baseMessage}. ${skeletonKeyMessage}` : baseMessage,
  };
}

export function backtrackPlayerState(g) {
  const path = g.movePath;
  if (path.length < 2) return g;

  const prev = path[path.length - 2];
  const lastStep = path[path.length - 1];
  const newPath = path.slice(0, -1);
  const movesLeft = g.players[g.currentPlayerIndex].movesLeft + (lastStep.cost ?? 1);
  const updatedPlayers = g.players.map((p, i) =>
    i === g.currentPlayerIndex ? { ...p, x: prev.x, y: prev.y, floor: prev.floor || p.floor, movesLeft } : p
  );

  return {
    ...g,
    players: updatedPlayers,
    movePath: newPath,
    pendingExplore: null,
    message: `${g.players[g.currentPlayerIndex].name} - ${movesLeft} move${movesLeft !== 1 ? "s" : ""} left`,
  };
}

export function exploreState(g, { dir, nx, ny, cost, OPPOSITE, getLeaveMoveCost }) {
  const player = g.players[g.currentPlayerIndex];
  const floor = player.floor;
  const currentTile = g.board[floor]?.find((t) => t.x === player.x && t.y === player.y);
  const resolvedCost = cost ?? getLeaveMoveCost(currentTile);
  if (player.movesLeft < resolvedCost) return g;

  const tileIndex = g.tileStack.findIndex((t) => t.floors.includes(floor));
  if (tileIndex === -1) {
    return { ...g, message: "No tiles left for this floor!" };
  }

  const tile = g.tileStack[tileIndex];
  const neededDoor = OPPOSITE[dir];
  const allDirs = ["N", "E", "S", "W"];
  const validRotations = [];

  for (let rot = 0; rot < 4; rot++) {
    const rotated = tile.doors.map((d) => {
      const idx = allDirs.indexOf(d);
      return allDirs[(idx + rot) % 4];
    });
    if (rotated.includes(neededDoor)) {
      validRotations.push(rotated);
    }
  }

  const movesLeft = player.movesLeft - resolvedCost;
  const newPath = [...g.movePath, { x: nx, y: ny, floor, cost: resolvedCost }];
  const updatedPlayers = g.players.map((p, i) => (i === g.currentPlayerIndex ? { ...p, x: nx, y: ny, movesLeft } : p));

  return {
    ...g,
    players: updatedPlayers,
    movePath: newPath,
    pendingExplore: {
      tile,
      tileIndex,
      x: nx,
      y: ny,
      floor,
      dir,
      validRotations,
      rotationIndex: 0,
    },
    message: `${g.players[g.currentPlayerIndex].name} entered an unknown room... Move Here to reveal it, or back out.`,
  };
}

export function confirmMoveState(g) {
  const p = g.players[g.currentPlayerIndex];

  if (g.pendingExplore) {
    return {
      ...g,
      turnPhase: "rotate",
      message: `${p.name} discovered ${g.pendingExplore.tile.name}! Rotate the tile, then place it.`,
    };
  }

  return {
    ...g,
    movePath: [{ x: p.x, y: p.y, floor: p.floor, cost: 0 }],
    message: `${p.name} moved - ${p.movesLeft} move${p.movesLeft !== 1 ? "s" : ""} left`,
  };
}

export function changeFloorState(g, { getConnectedMoveTarget, getLeaveMoveCost }) {
  const p = g.players[g.currentPlayerIndex];
  const currentTile = g.board[p.floor]?.find((t) => t.x === p.x && t.y === p.y);
  const path = g.movePath;
  const connectedMove = getConnectedMoveTarget(g.board, currentTile, path);
  if (!connectedMove) return { game: g, cameraFloor: null };

  const { targetTile, targetFloor, isBacktrack } = connectedMove;

  if (isBacktrack) {
    const lastStep = path[path.length - 1];
    const movesLeft = p.movesLeft + (lastStep.cost ?? 1);
    const updatedPlayers = g.players.map((pl, i) =>
      i === g.currentPlayerIndex ? { ...pl, x: targetTile.x, y: targetTile.y, floor: targetFloor, movesLeft } : pl
    );
    return {
      game: {
        ...g,
        players: updatedPlayers,
        movePath: path.slice(0, -1),
        pendingExplore: null,
        message: `${p.name} - ${movesLeft} move${movesLeft !== 1 ? "s" : ""} left`,
      },
      cameraFloor: targetFloor,
    };
  }

  const moveCost = getLeaveMoveCost(currentTile);
  if (p.movesLeft < moveCost) return { game: g, cameraFloor: null };

  const movesLeft = p.movesLeft - moveCost;
  const updatedPlayers = g.players.map((pl, i) =>
    i === g.currentPlayerIndex ? { ...pl, x: targetTile.x, y: targetTile.y, floor: targetFloor, movesLeft } : pl
  );

  return {
    game: {
      ...g,
      players: updatedPlayers,
      movePath: [...g.movePath, { x: targetTile.x, y: targetTile.y, floor: targetFloor, cost: moveCost }],
      message:
        movesLeft > 0
          ? `${p.name} moved to ${targetTile.name} - ${movesLeft} move${movesLeft !== 1 ? "s" : ""} left`
          : `${p.name} moved to ${targetTile.name} - no moves left`,
    },
    cameraFloor: targetFloor,
  };
}

export function placePendingSpecialTileState(g, placement, { getIdolChoiceStateForQueuedEvent }) {
  const pendingPlacement = g.pendingSpecialPlacement;
  if (!pendingPlacement) return { game: g, cameraFloor: null };

  const currentPlayer = g.players[g.currentPlayerIndex];
  const chosenDoors = placement.validRotations[0];
  const placedTile = {
    ...pendingPlacement.tile,
    x: placement.x,
    y: placement.y,
    floor: placement.floor,
    doors: chosenDoors,
  };

  if (pendingPlacement.mode === "move-existing") {
    const currentPlayerIndex = g.currentPlayerIndex;
    const oldFloor = pendingPlacement.tile.floor;
    const isOldTile = (tile) =>
      tile.id === pendingPlacement.tile.id &&
      tile.floor === oldFloor &&
      tile.x === pendingPlacement.tile.x &&
      tile.y === pendingPlacement.tile.y;
    const oldFloorWithoutTile = (g.board[oldFloor] || []).filter((tile) => !isOldTile(tile));
    const updatedBoard =
      oldFloor === placement.floor
        ? {
            ...g.board,
            [oldFloor]: [...oldFloorWithoutTile, placedTile],
          }
        : {
            ...g.board,
            [oldFloor]: oldFloorWithoutTile,
            [placement.floor]: [...(g.board[placement.floor] || []), placedTile],
          };
    const updatedPlayers = g.players.map((player, index) =>
      index === currentPlayerIndex ? { ...player, x: placement.x, y: placement.y, floor: placement.floor } : player
    );

    const idolOfferState = getIdolChoiceStateForQueuedEvent({
      player: currentPlayer,
      tileName: placedTile.name,
      queuedCard: pendingPlacement.queuedCard,
      nextTurnPhase: pendingPlacement.nextTurnPhase,
      nextMessage: pendingPlacement.nextMessage,
      offerMessage: `${currentPlayer.name} discovered an Event symbol.`,
    });
    if (idolOfferState) {
      return {
        game: {
          ...g,
          board: updatedBoard,
          players: updatedPlayers,
          movePath: [{ x: placement.x, y: placement.y, floor: placement.floor, cost: 0 }],
          pendingSpecialPlacement: null,
          drawnCard: idolOfferState.drawnCard,
          tileEffect: idolOfferState.tileEffect,
          turnPhase: idolOfferState.turnPhase,
          message: idolOfferState.message,
        },
        cameraFloor: placement.floor,
      };
    }

    return {
      game: {
        ...g,
        board: updatedBoard,
        players: updatedPlayers,
        movePath: [{ x: placement.x, y: placement.y, floor: placement.floor, cost: 0 }],
        pendingSpecialPlacement: null,
        drawnCard: pendingPlacement.queuedCard || null,
        turnPhase: pendingPlacement.nextTurnPhase,
        message: pendingPlacement.nextMessage,
      },
      cameraFloor: placement.floor,
    };
  }

  const idolOfferState = getIdolChoiceStateForQueuedEvent({
    player: currentPlayer,
    tileName: placedTile.name,
    queuedCard: pendingPlacement.queuedCard,
    nextTurnPhase: pendingPlacement.nextTurnPhase,
    nextMessage: pendingPlacement.nextMessage,
    offerMessage: `${currentPlayer.name} discovered an Event symbol.`,
  });
  if (idolOfferState) {
    return {
      game: {
        ...g,
        board: {
          ...g.board,
          [placement.floor]: [...(g.board[placement.floor] || []), placedTile],
        },
        pendingSpecialPlacement: null,
        drawnCard: idolOfferState.drawnCard,
        tileEffect: idolOfferState.tileEffect,
        turnPhase: idolOfferState.turnPhase,
        message: idolOfferState.message,
      },
      cameraFloor: null,
    };
  }

  return {
    game: {
      ...g,
      board: {
        ...g.board,
        [placement.floor]: [...(g.board[placement.floor] || []), placedTile],
      },
      pendingSpecialPlacement: null,
      drawnCard: pendingPlacement.queuedCard || null,
      turnPhase: pendingPlacement.nextTurnPhase,
      message: pendingPlacement.nextMessage,
    },
    cameraFloor: null,
  };
}
