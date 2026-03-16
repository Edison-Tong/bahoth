import { useState, useRef, useEffect } from "react";
import { STARTING_TILES, createTileStack } from "./tiles";
import "./GameBoard.css";

// Direction offsets
const DIR = {
  N: { dx: 0, dy: -1 },
  S: { dx: 0, dy: 1 },
  E: { dx: 1, dy: 0 },
  W: { dx: -1, dy: 0 },
};

const OPPOSITE = { N: "S", S: "N", E: "W", W: "E" };

const TILE_SIZE = 100;
const GAP = 4;

// Initialize game state from players
function initGameState(players) {
  const tileStack = createTileStack();

  // Ground floor starts with 3 tiles in a vertical line:
  // Entrance Hall (0,0) — Foyer (0,-1) — Grand Staircase (0,-2)
  const entrance = { ...STARTING_TILES[0], x: 0, y: 0, floor: "ground" };
  const foyer = { ...STARTING_TILES[1], x: 0, y: -1, floor: "ground" };
  const grandStaircase = { ...STARTING_TILES[2], x: 0, y: -2, floor: "ground" };
  const upperLanding = { ...STARTING_TILES[3], x: 0, y: 0, floor: "upper" };
  const basementLanding = { ...STARTING_TILES[4], x: 0, y: 0, floor: "basement" };

  return {
    players: players.map((p, i) => ({
      ...p,
      index: i,
      x: 0,
      y: 0,
      floor: "ground",
      movesLeft: 0,
      // Stat indices track current position in each stat array
      statIndex: { ...p.character.startIndex },
      inventory: [],
      omens: [],
      isAlive: true,
    })),
    board: {
      ground: [entrance, foyer, grandStaircase],
      upper: [upperLanding],
      basement: [basementLanding],
    },
    tileStack,
    currentPlayerIndex: 0,
    turnPhase: "move", // 'move' | 'explore' | 'card' | 'endTurn'
    omenCount: 0,
    hauntTriggered: false,
    turnNumber: 1,
    message: null,
  };
}

export default function GameBoard({ players, onQuit }) {
  const [game, setGame] = useState(() => initGameState(players));
  const [cameraFloor, setCameraFloor] = useState("ground");
  const boardRef = useRef(null);

  const currentPlayer = game.players[game.currentPlayerIndex];
  const floorTiles = game.board[cameraFloor] || [];

  // When turn starts, give the player moves equal to their speed
  useEffect(() => {
    if (game.turnPhase === "move" && currentPlayer.movesLeft === 0) {
      setGame((g) => {
        const p = g.players[g.currentPlayerIndex];
        const speed = p.character.speed[p.statIndex.speed];
        const updated = { ...g };
        updated.players = g.players.map((pl, i) => (i === g.currentPlayerIndex ? { ...pl, movesLeft: speed } : pl));
        updated.message = `${p.name}'s turn — ${speed} moves`;
        return updated;
      });
    }
  }, [game.currentPlayerIndex, game.turnPhase, currentPlayer.movesLeft]);

  // Arrow key movement
  useEffect(() => {
    function handleKeyDown(e) {
      if (game.turnPhase !== "move" || currentPlayer.movesLeft <= 0) return;

      const keyToDir = {
        ArrowUp: "N",
        ArrowDown: "S",
        ArrowRight: "E",
        ArrowLeft: "W",
      };
      const dir = keyToDir[e.key];
      if (!dir) return;

      e.preventDefault();

      const tile = getTileAt(currentPlayer.x, currentPlayer.y, currentPlayer.floor);
      if (!tile || !tile.doors.includes(dir)) return;

      const { dx, dy } = DIR[dir];
      const nx = currentPlayer.x + dx;
      const ny = currentPlayer.y + dy;
      const neighbor = getTileAt(nx, ny, currentPlayer.floor);

      if (neighbor && neighbor.doors.includes(OPPOSITE[dir])) {
        handleMove(nx, ny);
      } else if (!neighbor) {
        handleExplore(dir, nx, ny);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Get tile at position
  function getTileAt(x, y, floor) {
    return game.board[floor]?.find((t) => t.x === x && t.y === y);
  }

  // Get valid move directions from current tile
  function getValidMoves() {
    if (game.turnPhase !== "move" || currentPlayer.movesLeft <= 0) return [];

    const tile = getTileAt(currentPlayer.x, currentPlayer.y, currentPlayer.floor);
    if (!tile) return [];

    const moves = [];
    for (const dir of tile.doors) {
      const { dx, dy } = DIR[dir];
      const nx = currentPlayer.x + dx;
      const ny = currentPlayer.y + dy;
      const neighbor = getTileAt(nx, ny, currentPlayer.floor);

      if (neighbor) {
        // Can only move to neighbor if it also has a door facing back
        if (neighbor.doors.includes(OPPOSITE[dir])) {
          moves.push({ dir, x: nx, y: ny, type: "move" });
        }
      } else {
        // No tile there — can explore
        moves.push({ dir, x: nx, y: ny, type: "explore" });
      }
    }
    return moves;
  }

  // Move player to an existing tile
  function handleMove(nx, ny) {
    setGame((g) => {
      const updated = { ...g };
      const movesLeft = currentPlayer.movesLeft - 1;
      updated.players = g.players.map((p, i) => (i === g.currentPlayerIndex ? { ...p, x: nx, y: ny, movesLeft } : p));
      updated.message =
        movesLeft > 0
          ? `${currentPlayer.name} — ${movesLeft} move${movesLeft !== 1 ? "s" : ""} left`
          : `${currentPlayer.name} — no moves left`;
      return updated;
    });
  }

  // Explore — draw a tile and place it
  function handleExplore(dir, nx, ny) {
    setGame((g) => {
      const floor = currentPlayer.floor;

      // Find a tile that fits this floor
      const tileIndex = g.tileStack.findIndex((t) => t.floors.includes(floor));
      if (tileIndex === -1) {
        return { ...g, message: "No tiles left for this floor!" };
      }

      const tile = g.tileStack[tileIndex];
      const newStack = [...g.tileStack];
      newStack.splice(tileIndex, 1);

      // Rotate tile so it has a door connecting back to where we came from
      const neededDoor = OPPOSITE[dir];
      const rotatedDoors = rotateDoors(tile.doors, neededDoor);

      const placedTile = {
        ...tile,
        x: nx,
        y: ny,
        floor,
        doors: rotatedDoors,
      };

      const newBoard = { ...g.board };
      newBoard[floor] = [...newBoard[floor], placedTile];

      // Move player onto the new tile with 0 moves left (exploring ends movement)
      const updatedPlayers = g.players.map((p, i) =>
        i === g.currentPlayerIndex ? { ...p, x: nx, y: ny, movesLeft: 0 } : p
      );

      let message = `${currentPlayer.name} discovered ${tile.name}!`;
      let turnPhase = g.turnPhase;

      if (tile.cardType) {
        message += ` Draw an ${tile.cardType} card.`;
        turnPhase = "card";
      } else {
        turnPhase = "endTurn";
      }

      return {
        ...g,
        board: newBoard,
        tileStack: newStack,
        players: updatedPlayers,
        turnPhase,
        message,
      };
    });
  }

  // Rotate doors so the tile connects properly
  function rotateDoors(doors, neededDoor) {
    if (doors.includes(neededDoor)) return doors;

    // Try rotations: 90, 180, 270
    const allDirs = ["N", "E", "S", "W"];
    for (let rot = 1; rot <= 3; rot++) {
      const rotated = doors.map((d) => {
        const idx = allDirs.indexOf(d);
        return allDirs[(idx + rot) % 4];
      });
      if (rotated.includes(neededDoor)) return rotated;
    }
    // Fallback: just add the needed door
    return [...doors, neededDoor];
  }

  // Handle clicking a move/explore target
  function handleAction(move) {
    if (move.type === "move") {
      handleMove(move.x, move.y);
    } else {
      handleExplore(move.dir, move.x, move.y);
    }
  }

  // Draw card (placeholder — just acknowledge it for now)
  function handleDrawCard() {
    setGame((g) => {
      const tile = getTileAt(currentPlayer.x, currentPlayer.y, currentPlayer.floor);
      let newOmenCount = g.omenCount;
      let message = "";

      if (tile?.cardType === "omen") {
        newOmenCount++;
        message = `Omen drawn! (${newOmenCount}/13) — Roll for haunt...`;
        // Simple haunt check: roll 6 dice, if total < omen count, haunt starts
        // For now just track oment count
      } else if (tile?.cardType === "event") {
        message = "Event resolved.";
      } else if (tile?.cardType === "item") {
        message = "Item collected!";
      }

      return {
        ...g,
        omenCount: newOmenCount,
        turnPhase: "endTurn",
        message,
      };
    });
  }

  // End turn
  function handleEndTurn() {
    setGame((g) => {
      let next = (g.currentPlayerIndex + 1) % g.players.length;
      // Skip dead players
      let attempts = 0;
      while (!g.players[next].isAlive && attempts < g.players.length) {
        next = (next + 1) % g.players.length;
        attempts++;
      }

      return {
        ...g,
        currentPlayerIndex: next,
        turnPhase: "move",
        turnNumber: g.turnNumber + (next === 0 ? 1 : 0),
        message: null,
      };
    });
  }

  const validMoves = getValidMoves();

  // Calculate board bounds for centering
  const allXs = floorTiles.map((t) => t.x);
  const allYs = floorTiles.map((t) => t.y);
  // Include move targets in bounds
  validMoves.forEach((m) => {
    if (m.type === "explore") {
      allXs.push(m.x);
      allYs.push(m.y);
    }
  });
  const minX = Math.min(...allXs, 0) - 1;
  const maxX = Math.max(...allXs, 0) + 1;
  const minY = Math.min(...allYs, 0) - 1;
  const maxY = Math.max(...allYs, 0) + 1;

  const gridWidth = (maxX - minX + 1) * (TILE_SIZE + GAP);
  const gridHeight = (maxY - minY + 1) * (TILE_SIZE + GAP);

  // Players on current floor
  const playersOnFloor = game.players.filter((p) => p.floor === cameraFloor && p.isAlive);

  return (
    <div className="game-screen">
      {/* Header bar */}
      <div className="game-header">
        <div className="game-header-left">
          <span className="turn-badge">Turn {game.turnNumber}</span>
          <span className="floor-tabs">
            {["upper", "ground", "basement"].map((f) => (
              <button
                key={f}
                className={`floor-tab ${cameraFloor === f ? "floor-tab-active" : ""}`}
                onClick={() => setCameraFloor(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f === currentPlayer.floor && " ●"}
              </button>
            ))}
          </span>
        </div>
        <div className="game-header-right">
          <span className="omen-badge">Omens: {game.omenCount}/13</span>
          <span className="tile-count">{game.tileStack.length} tiles left</span>
        </div>
      </div>

      {/* Message bar */}
      {game.message && <div className="game-message">{game.message}</div>}

      {/* Board */}
      <div className="board-container" ref={boardRef}>
        <div className="board-scroll">
          <div className="board-grid" style={{ width: gridWidth, height: gridHeight }}>
            {/* Placed tiles */}
            {floorTiles.map((tile) => {
              const left = (tile.x - minX) * (TILE_SIZE + GAP);
              const top = (tile.y - minY) * (TILE_SIZE + GAP);
              const tilePlayersHere = playersOnFloor.filter((p) => p.x === tile.x && p.y === tile.y);
              const isCurrentTile =
                currentPlayer.x === tile.x && currentPlayer.y === tile.y && currentPlayer.floor === cameraFloor;

              return (
                <div
                  key={tile.id + tile.x + tile.y}
                  className={`board-tile ${isCurrentTile ? "board-tile-current" : ""} ${
                    tile.cardType ? "board-tile-" + tile.cardType : ""
                  }`}
                  style={{ left, top, width: TILE_SIZE, height: TILE_SIZE }}
                  title={tile.description}
                >
                  <div className="tile-name">{tile.name}</div>
                  {tile.cardType && <div className={`tile-type tile-type-${tile.cardType}`}>{tile.cardType}</div>}
                  {/* Door indicators */}
                  <div className="tile-doors">
                    {tile.doors.map((d) => (
                      <div key={d} className={`door door-${d}`} />
                    ))}
                  </div>
                  {/* Player tokens */}
                  {tilePlayersHere.length > 0 && (
                    <div className="tile-players">
                      {tilePlayersHere.map((p) => (
                        <div key={p.index} className="player-token" style={{ background: p.color }} title={p.name}>
                          {p.name.charAt(0)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Explore/move targets */}
            {validMoves.map((m) => {
              // Don't show target if there's already a tile there (move targets are on existing tiles)
              if (m.type === "move") return null;
              const left = (m.x - minX) * (TILE_SIZE + GAP);
              const top = (m.y - minY) * (TILE_SIZE + GAP);
              return (
                <button
                  key={`target-${m.x}-${m.y}`}
                  className="explore-target"
                  style={{ left, top, width: TILE_SIZE, height: TILE_SIZE }}
                  onClick={() => handleAction(m)}
                >
                  <span className="explore-icon">?</span>
                </button>
              );
            })}

            {/* Clickable overlay on existing tiles for movement */}
            {validMoves
              .filter((m) => m.type === "move")
              .map((m) => {
                const left = (m.x - minX) * (TILE_SIZE + GAP);
                const top = (m.y - minY) * (TILE_SIZE + GAP);
                return (
                  <button
                    key={`move-${m.x}-${m.y}`}
                    className="move-overlay"
                    style={{ left, top, width: TILE_SIZE, height: TILE_SIZE }}
                    onClick={() => handleAction(m)}
                  />
                );
              })}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="game-actions">
        {game.turnPhase === "card" && (
          <button className="btn btn-primary" onClick={handleDrawCard}>
            Draw Card
          </button>
        )}
        {(game.turnPhase === "endTurn" || (game.turnPhase === "move" && currentPlayer.movesLeft === 0)) && (
          <button className="btn btn-primary" onClick={handleEndTurn}>
            End Turn — Pass to {game.players[(game.currentPlayerIndex + 1) % game.players.length].name}
          </button>
        )}
      </div>

      {/* Player sidebar */}
      <div className="player-sidebar">
        {game.players.map((p, i) => {
          const isCurrent = i === game.currentPlayerIndex;
          return (
            <div
              key={i}
              className={`sidebar-player ${isCurrent ? "sidebar-current" : ""} ${!p.isAlive ? "sidebar-dead" : ""}`}
              style={{ borderColor: isCurrent ? p.color : "transparent" }}
            >
              <div className="sidebar-name" style={{ color: p.color }}>
                {p.name} {isCurrent && "◄"}
              </div>
              <div className="sidebar-char">{p.character.name}</div>
              <div className="sidebar-stats">
                <span>💪{p.character.might[p.statIndex.might]}</span>
                <span>🏃{p.character.speed[p.statIndex.speed]}</span>
                <span>🧠{p.character.sanity[p.statIndex.sanity]}</span>
                <span>📖{p.character.knowledge[p.statIndex.knowledge]}</span>
              </div>
            </div>
          );
        })}
        <button className="btn btn-danger sidebar-quit" onClick={onQuit}>
          Quit Game
        </button>
      </div>
    </div>
  );
}
