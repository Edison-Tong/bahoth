import {
  getHauntMovementOptionsState,
  getHauntCombatActorProxyState,
  getHauntBoardRenderState,
} from "../haunts/hauntDomain";
import { movesLabel } from "../shared/format";

/* [MOVEMENT] [COMBAT] Returns the extra move cost imposed by enemies on the current tile. Heroes pay +1 per traitor/monster on tile; the traitor pays +1 per hero on tile. */
function getEnemyObstacleCost(game, playerIndex) {
  if (game.gamePhase !== "hauntActive" || !game.hauntState) return 0;

  const traitorIndex = game.hauntState.traitorPlayerIndex;
  const player = game.players[playerIndex];
  if (!player) return 0;

  const { floor, x, y } = player;

  if (playerIndex === traitorIndex) {
    // Traitor: obstructed by alive heroes on same tile
    const heroIndexes = game.hauntState.teams?.heroes?.playerIndexes || [];
    return heroIndexes.filter((hi) => {
      const h = game.players[hi];
      return h?.isAlive && h.floor === floor && h.x === x && h.y === y;
    }).length;
  } else {
    // Hero: when the traitor is hidden (e.g. disguised as illusions), their parked player
    // position is not a real obstacle — only the actual tokens on the board count.
    // The combat proxy resolves to the illusion (if any) on this hero's tile, so a present
    // illusion adds +1 cost, while a dispelled one (removed from the board) adds nothing.
    const hiddenIndexes = getHauntBoardRenderState(game).hiddenPlayerIndexes || [];
    if (hiddenIndexes.includes(traitorIndex)) {
      const proxy = getHauntCombatActorProxyState(game, traitorIndex);
      if (proxy && proxy.floor === floor && proxy.x === x && proxy.y === y) return 1;
      return 0;
    }

    // Hero: obstructed by the traitor (alive) or an active proxy (spirit) on same tile
    const traitor = game.players[traitorIndex];
    if (traitor?.isAlive && traitor.floor === floor && traitor.x === x && traitor.y === y) return 1;
    const proxy = getHauntCombatActorProxyState(game, traitorIndex);
    if (proxy && proxy.floor === floor && proxy.x === x && proxy.y === y) return 1;
    return 0;
  }
}

/* [MOVEMENT] Returns the list of legal moves for the current player this step (type: move/backtrack/explore/wall-move). */
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

  const hauntMoveOptions = getHauntMovementOptionsState({
    game,
    currentPlayer,
    DIR,
    getTileAt,
    backtrackPos,
  });
  if (hauntMoveOptions) return hauntMoveOptions;

  const moves = [];
  const tileLeaveCost = getLeaveMoveCost(tile);
  const enemyCost = getEnemyObstacleCost(game, game.currentPlayerIndex);
  const moveCost = tileLeaveCost + enemyCost;
  const isFirstMove = !game.hasMovedThisTurn;
  const canAffordMove = currentPlayer.movesLeft >= moveCost || (isFirstMove && currentPlayer.movesLeft > 0);
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
        } else if (canAffordMove) {
          moves.push({ dir, x: nx, y: ny, type: "move", cost: moveCost });
        }
      }
    } else if (canAffordMove) {
      moves.push({ dir, x: nx, y: ny, type: "explore", cost: moveCost });
    }
  }

  if (canUseSkeletonKeyMovement && canAffordMove) {
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

/* [MOVEMENT] Applies a single movement step: deducts move cost, updates player position, sets message. */
export function movePlayerState(
  g,
  { nx, ny, cost, useSkeletonKey, skeletonKeyRoll, getLeaveMoveCost, canUseArmedSkeletonKeyMovement }
) {
  const player = g.players[g.currentPlayerIndex];
  const currentTile = g.board[player.floor]?.find((t) => t.x === player.x && t.y === player.y);
  const resolvedCost = cost ?? getLeaveMoveCost(currentTile) + getEnemyObstacleCost(g, g.currentPlayerIndex);
  const isFirstMove = !g.hasMovedThisTurn;
  if (player.movesLeft <= 0) return g;
  if (!isFirstMove && player.movesLeft < resolvedCost) return g;

  if (useSkeletonKey && !canUseArmedSkeletonKeyMovement(g, player)) return g;

  const movesLeft = Math.max(0, player.movesLeft - resolvedCost);
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
        ? `${g.players[g.currentPlayerIndex].name} - ${movesLabel(movesLeft)} left`
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
    hasMovedThisTurn: true,
    message: skeletonKeyMessage ? `${baseMessage}. ${skeletonKeyMessage}` : baseMessage,
  };
}

/* [MOVEMENT] Undoes the last step in movePath, refunds the cost, and returns the player to the previous position. */
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
    message: `${g.players[g.currentPlayerIndex].name} - ${movesLabel(movesLeft)} left`,
  };
}

/* [MOVEMENT] [TILE-PLACEMENT] Starts an exploration attempt: moves the player onto an unknown position and calculates valid tile rotations, entering pendingExplore state. */
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
  const validRotations = rotationsWithDoor(tile.doors, neededDoor);

  const movesLeft = player.movesLeft - resolvedCost;
  const newPath = [...g.movePath, { x: nx, y: ny, floor, cost: resolvedCost }];
  const updatedPlayers = g.players.map((p, i) => (i === g.currentPlayerIndex ? { ...p, x: nx, y: ny, movesLeft } : p));

  return {
    ...g,
    players: updatedPlayers,
    movePath: newPath,
    hasMovedThisTurn: true,
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

/* [MOVEMENT] [TILE-PLACEMENT] Transitions to the tile rotation phase (for pendingExplore) or resets the movePath (for normal moves). */
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
    message: `${p.name} moved - ${movesLabel(p.movesLeft)} left`,
  };
}

/* [MOVEMENT] Moves the current player through a stair/connected link to another floor. Handles both forward (cost deducted) and backtrack (cost refunded) cases. */
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
        message: `${p.name} - ${movesLabel(movesLeft)} left`,
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
          ? `${p.name} moved to ${targetTile.name} - ${movesLabel(movesLeft)} left`
          : `${p.name} moved to ${targetTile.name} - no moves left`,
    },
    cameraFloor: targetFloor,
  };
}

/* [TILE-PLACEMENT] [MOVEMENT] Places a tile from pendingSpecialPlacement (Panic Room staircase, dog move, etc.) onto the board. Handles move-existing and new placements; offers Idol choice when the tile triggers an event symbol. */
export function placePendingSpecialTileState(g, placement, { getIdolChoiceStateForQueuedEvent }) {
  const pendingPlacement = g.pendingSpecialPlacement;
  if (!pendingPlacement) return { game: g, cameraFloor: null };

  const resolvePlacementId = (candidate) => `${candidate.floor}:${candidate.x}:${candidate.y}`;
  const selectedPlacement =
    placement ||
    (pendingPlacement.placements || []).find(
      (candidate) => resolvePlacementId(candidate) === pendingPlacement.selectedPlacementId
    );
  if (!selectedPlacement) {
    return {
      game: {
        ...g,
        message: "Choose a placement target first.",
      },
      cameraFloor: null,
    };
  }

  const currentPlayer = g.players[g.currentPlayerIndex];
  const validRotations = selectedPlacement.validRotations || [];
  const rotationIndex = Math.max(0, Math.min(validRotations.length - 1, pendingPlacement.rotationIndex || 0));
  const chosenDoors = validRotations[rotationIndex] || validRotations[0] || pendingPlacement.tile.doors;
  const placedTile = {
    ...pendingPlacement.tile,
    x: selectedPlacement.x,
    y: selectedPlacement.y,
    floor: selectedPlacement.floor,
    doors: chosenDoors,
  };

  if (pendingPlacement.mode === "move-existing") {
    const oldFloor = pendingPlacement.tile.floor;
    const oldX = pendingPlacement.tile.x;
    const oldY = pendingPlacement.tile.y;
    const isOldTile = (tile) =>
      tile.id === pendingPlacement.tile.id &&
      tile.floor === oldFloor &&
      tile.x === pendingPlacement.tile.x &&
      tile.y === pendingPlacement.tile.y;
    const oldFloorWithoutTile = (g.board[oldFloor] || []).filter((tile) => !isOldTile(tile));
    const updatedBoard =
      oldFloor === selectedPlacement.floor
        ? {
            ...g.board,
            [oldFloor]: [...oldFloorWithoutTile, placedTile],
          }
        : {
            ...g.board,
            [oldFloor]: oldFloorWithoutTile,
            [selectedPlacement.floor]: [...(g.board[selectedPlacement.floor] || []), placedTile],
          };
    const updatedPlayers = g.players.map((player) =>
      player.floor === oldFloor && player.x === oldX && player.y === oldY
        ? { ...player, x: selectedPlacement.x, y: selectedPlacement.y, floor: selectedPlacement.floor }
        : player
    );

    const jacksSpiritInScenario = g.hauntState?.scenarioState?.jacksSpirit;
    const updatedHauntState =
      jacksSpiritInScenario?.active &&
      jacksSpiritInScenario.floor === oldFloor &&
      jacksSpiritInScenario.x === oldX &&
      jacksSpiritInScenario.y === oldY
        ? {
            ...g.hauntState,
            scenarioState: {
              ...g.hauntState.scenarioState,
              jacksSpirit: {
                ...jacksSpiritInScenario,
                floor: selectedPlacement.floor,
                x: selectedPlacement.x,
                y: selectedPlacement.y,
              },
            },
          }
        : g.hauntState;

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
          hauntState: updatedHauntState,
          movePath: [{ x: selectedPlacement.x, y: selectedPlacement.y, floor: selectedPlacement.floor, cost: 0 }],
          pendingSpecialPlacement: null,
          drawnCard: idolOfferState.drawnCard,
          tileEffect: idolOfferState.tileEffect,
          turnPhase: idolOfferState.turnPhase,
          message: idolOfferState.message,
        },
        cameraFloor: selectedPlacement.floor,
      };
    }

    return {
      game: {
        ...g,
        board: updatedBoard,
        players: updatedPlayers,
        hauntState: updatedHauntState,
        movePath: [{ x: selectedPlacement.x, y: selectedPlacement.y, floor: selectedPlacement.floor, cost: 0 }],
        pendingSpecialPlacement: null,
        drawnCard: pendingPlacement.queuedCard || null,
        turnPhase: pendingPlacement.nextTurnPhase,
        message: pendingPlacement.nextMessage,
      },
      cameraFloor: selectedPlacement.floor,
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
          [selectedPlacement.floor]: [...(g.board[selectedPlacement.floor] || []), placedTile],
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
        [selectedPlacement.floor]: [...(g.board[selectedPlacement.floor] || []), placedTile],
      },
      pendingSpecialPlacement: null,
      drawnCard: pendingPlacement.queuedCard || null,
      turnPhase: pendingPlacement.nextTurnPhase,
      message: pendingPlacement.nextMessage,
    },
    cameraFloor: null,
  };
}
