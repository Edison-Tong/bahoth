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

// Roll n dice (each die: 0, 1, or 2 with equal probability)
function rollDice(n) {
  const results = [];
  for (let i = 0; i < n; i++) {
    results.push(Math.floor(Math.random() * 3));
  }
  return results;
}

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
    players: players.map((p, i) => {
      const speed = p.character.speed[p.character.startIndex.speed];
      return {
        ...p,
        index: i,
        x: 0,
        y: 0,
        floor: "ground",
        movesLeft: i === 0 ? speed : 0,
        statIndex: { ...p.character.startIndex },
        inventory: [],
        omens: [],
        isAlive: true,
      };
    }),
    board: {
      ground: [entrance, foyer, grandStaircase],
      upper: [upperLanding],
      basement: [basementLanding],
    },
    tileStack,
    currentPlayerIndex: 0,
    turnPhase: "move",
    movePath: [{ x: 0, y: 0, floor: "ground" }],
    pendingExplore: null,
    omenCount: 0,
    hauntTriggered: false,
    drawnCard: null,
    hauntRoll: null,
    turnNumber: 1,
    message: `${players[0].name}'s turn — ${players[0].character.speed[players[0].character.startIndex.speed]} moves`,
  };
}

export default function GameBoard({ players, onQuit }) {
  const [game, setGame] = useState(() => initGameState(players));
  const [cameraFloor, setCameraFloor] = useState("ground");
  const [diceAnimation, setDiceAnimation] = useState(null);
  const diceAnimRef = useRef(null);
  const boardRef = useRef(null);

  // Dice rolling animation
  useEffect(() => {
    if (!diceAnimation || diceAnimation.settled) return;
    diceAnimRef.current = diceAnimation;

    const interval = setInterval(() => {
      setDiceAnimation((prev) => {
        if (!prev || prev.settled) return prev;
        return {
          ...prev,
          display: Array.from({ length: prev.final.length }, () => Math.floor(Math.random() * 3)),
        };
      });
    }, 80);

    const timeout = setTimeout(() => {
      setDiceAnimation((prev) => {
        if (!prev) return prev;
        return { ...prev, display: prev.final, settled: true };
      });
      const da = diceAnimRef.current;
      if (!da) return;
      const total = da.final.reduce((a, b) => a + b, 0);
      const hauntTriggered = total >= 5;
      setGame((g) => ({
        ...g,
        hauntRoll: {
          dice: da.final,
          total,
          omenCount: da.omenCount,
          hauntTriggered,
        },
        hauntTriggered: g.hauntTriggered || hauntTriggered,
        message: hauntTriggered
          ? `THE HAUNT BEGINS! Rolled ${total} with ${da.omenCount} dice!`
          : `Safe... Rolled ${total} with ${da.omenCount} dice.`,
      }));
    }, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diceAnimation?.settled]);

  const currentPlayer = game.players[game.currentPlayerIndex];
  const floorTiles = game.board[cameraFloor] || [];

  // Keyboard controls
  useEffect(() => {
    function handleKeyDown(e) {
      // Rotate phase: R/E to rotate, Enter to place
      if (game.turnPhase === "rotate") {
        if (e.key === "r" || e.key === "R" || e.key === "ArrowRight") {
          e.preventDefault();
          handleRotateTile(1);
        } else if (e.key === "e" || e.key === "E" || e.key === "ArrowLeft") {
          e.preventDefault();
          handleRotateTile(-1);
        } else if (e.key === "Enter") {
          e.preventDefault();
          handlePlaceTile();
        }
        return;
      }

      if (game.turnPhase !== "move") return;
      if (cameraFloor !== currentPlayer.floor) return;

      const keyToDir = {
        ArrowUp: "N",
        ArrowDown: "S",
        ArrowRight: "E",
        ArrowLeft: "W",
      };
      const dir = keyToDir[e.key];
      if (!dir) return;

      e.preventDefault();

      // If on a pending explore placeholder, only allow backtracking
      if (game.pendingExplore) {
        const path = game.movePath;
        if (path.length >= 2) {
          const prev = path[path.length - 2];
          const { dx, dy } = DIR[dir];
          const nx = currentPlayer.x + dx;
          const ny = currentPlayer.y + dy;
          if (prev.x === nx && prev.y === ny && prev.floor === currentPlayer.floor) {
            handleBacktrack();
          }
        }
        return;
      }

      const tile = getTileAt(currentPlayer.x, currentPlayer.y, currentPlayer.floor);
      if (!tile || !tile.doors.includes(dir)) return;

      const { dx, dy } = DIR[dir];
      const nx = currentPlayer.x + dx;
      const ny = currentPlayer.y + dy;

      // Check if backtracking
      const path = game.movePath;
      if (path.length >= 2) {
        const prev = path[path.length - 2];
        if (prev.x === nx && prev.y === ny && prev.floor === currentPlayer.floor) {
          handleBacktrack();
          return;
        }
      }

      if (currentPlayer.movesLeft <= 0) return;

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
    if (game.turnPhase !== "move") return [];

    // If on a pending explore placeholder, only allow backtrack
    if (game.pendingExplore) {
      const path = game.movePath;
      if (path.length >= 2) {
        const prev = path[path.length - 2];
        // Find which direction leads back
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

    // Find backtrack target
    const path = game.movePath;
    let backtrackPos = null;
    if (path.length >= 2) {
      backtrackPos = path[path.length - 2];
    }

    const moves = [];
    for (const dir of tile.doors) {
      const { dx, dy } = DIR[dir];
      const nx = currentPlayer.x + dx;
      const ny = currentPlayer.y + dy;
      const neighbor = getTileAt(nx, ny, currentPlayer.floor);

      if (neighbor) {
        if (neighbor.doors.includes(OPPOSITE[dir])) {
          // Check if this is a backtrack
          const isBacktrack =
            backtrackPos &&
            backtrackPos.x === nx &&
            backtrackPos.y === ny &&
            backtrackPos.floor === currentPlayer.floor;
          if (isBacktrack) {
            moves.push({ dir, x: nx, y: ny, type: "backtrack" });
          } else if (currentPlayer.movesLeft > 0) {
            moves.push({ dir, x: nx, y: ny, type: "move" });
          }
        }
      } else if (currentPlayer.movesLeft > 0) {
        moves.push({ dir, x: nx, y: ny, type: "explore" });
      }
    }
    return moves;
  }

  // Move player to an existing tile (costs 1 move, extends path)
  function handleMove(nx, ny) {
    setGame((g) => {
      const movesLeft = g.players[g.currentPlayerIndex].movesLeft - 1;
      const newPath = [...g.movePath, { x: nx, y: ny, floor: g.players[g.currentPlayerIndex].floor }];
      const updatedPlayers = g.players.map((p, i) =>
        i === g.currentPlayerIndex ? { ...p, x: nx, y: ny, movesLeft } : p
      );
      return {
        ...g,
        players: updatedPlayers,
        movePath: newPath,
        message:
          movesLeft > 0
            ? `${g.players[g.currentPlayerIndex].name} — ${movesLeft} move${movesLeft !== 1 ? "s" : ""} left`
            : `${g.players[g.currentPlayerIndex].name} — no moves left`,
      };
    });
  }

  // Backtrack to previous tile in path (refunds 1 move)
  function handleBacktrack() {
    setGame((g) => {
      const path = g.movePath;
      if (path.length < 2) return g;
      const prev = path[path.length - 2];
      const newPath = path.slice(0, -1);
      const movesLeft = g.players[g.currentPlayerIndex].movesLeft + 1;
      const updatedPlayers = g.players.map((p, i) =>
        i === g.currentPlayerIndex ? { ...p, x: prev.x, y: prev.y, floor: prev.floor || p.floor, movesLeft } : p
      );
      return {
        ...g,
        players: updatedPlayers,
        movePath: newPath,
        pendingExplore: null,
        message: `${g.players[g.currentPlayerIndex].name} — ${movesLeft} move${movesLeft !== 1 ? "s" : ""} left`,
      };
    });
    // Auto-switch camera if backtracking across floors
    setGame((g) => {
      const p = g.players[g.currentPlayerIndex];
      setCameraFloor(p.floor);
      return g;
    });
  }

  // Explore — move player onto placeholder, don't reveal tile yet
  function handleExplore(dir, nx, ny) {
    setGame((g) => {
      const floor = g.players[g.currentPlayerIndex].floor;

      // Find a tile that fits this floor
      const tileIndex = g.tileStack.findIndex((t) => t.floors.includes(floor));
      if (tileIndex === -1) {
        return { ...g, message: "No tiles left for this floor!" };
      }

      const tile = g.tileStack[tileIndex];

      // Compute all valid rotations (must include the door connecting back)
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

      const movesLeft = g.players[g.currentPlayerIndex].movesLeft - 1;
      const newPath = [...g.movePath, { x: nx, y: ny, floor }];
      const updatedPlayers = g.players.map((p, i) =>
        i === g.currentPlayerIndex ? { ...p, x: nx, y: ny, movesLeft } : p
      );

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
    });
  }

  // Handle clicking a move/explore/backtrack target
  function handleAction(move) {
    if (move.type === "backtrack") {
      handleBacktrack();
    } else if (move.type === "move") {
      handleMove(move.x, move.y);
    } else {
      handleExplore(move.dir, move.x, move.y);
    }
  }

  // Confirm move — commit current position, reset path
  // If on a pending explore, enter rotate phase to choose orientation
  function handleConfirmMove() {
    setGame((g) => {
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
        movePath: [{ x: p.x, y: p.y, floor: p.floor }],
        message: `${p.name} moved — ${p.movesLeft} move${p.movesLeft !== 1 ? "s" : ""} left`,
      };
    });
  }

  // Rotate the pending tile to the next valid orientation
  function handleRotateTile(direction) {
    setGame((g) => {
      if (!g.pendingExplore) return g;
      const pe = g.pendingExplore;
      const count = pe.validRotations.length;
      const newIndex = direction === 1 ? (pe.rotationIndex + 1) % count : (pe.rotationIndex - 1 + count) % count;
      return {
        ...g,
        pendingExplore: { ...pe, rotationIndex: newIndex },
      };
    });
  }

  // Place the tile with the chosen rotation
  function handlePlaceTile() {
    setGame((g) => {
      const p = g.players[g.currentPlayerIndex];
      const pe = g.pendingExplore;
      if (!pe) return g;

      const chosenDoors = pe.validRotations[pe.rotationIndex];
      const placedTile = {
        ...pe.tile,
        x: pe.x,
        y: pe.y,
        floor: pe.floor,
        doors: chosenDoors,
      };

      const newBoard = { ...g.board };
      newBoard[pe.floor] = [...newBoard[pe.floor], placedTile];

      const newStack = [...g.tileStack];
      newStack.splice(pe.tileIndex, 1);

      let message = `${p.name} placed ${pe.tile.name}!`;
      let turnPhase = "move";
      let drawnCard = null;
      let newOmenCount = g.omenCount;

      if (pe.tile.cardType) {
        const cardType = pe.tile.cardType;
        drawnCard = {
          type: cardType,
          name: cardType === "omen" ? "Bite" : cardType === "event" ? "Angry Being" : "Amulet of the Ages",
          description:
            cardType === "omen"
              ? "Something bit you. You can't see any marks, but you feel different..."
              : cardType === "event"
                ? "A force of rage rushes through the room. Every living thing trembles."
                : "You find a strange amulet glowing with an eerie light.",
          flavor: "(Placeholder card — real cards coming soon)",
        };
        if (cardType === "omen") {
          newOmenCount++;
        }
        message += ` A${cardType === "omen" || cardType === "event" ? "n" : ""} ${cardType} card appears...`;
        turnPhase = "card";
      } else {
        message += ` ${p.movesLeft} move${p.movesLeft !== 1 ? "s" : ""} left.`;
      }

      return {
        ...g,
        board: newBoard,
        tileStack: newStack,
        movePath: [{ x: p.x, y: p.y, floor: p.floor }],
        pendingExplore: null,
        omenCount: newOmenCount,
        drawnCard,
        turnPhase,
        message,
      };
    });
  }

  // Dismiss drawn card and continue
  function handleDismissCard() {
    setGame((g) => {
      const card = g.drawnCard;

      // Omen cards trigger a haunt roll animation
      if (card?.type === "omen") {
        const numDice = g.omenCount;
        const finalDice = rollDice(numDice);
        setDiceAnimation({
          final: finalDice,
          display: Array.from({ length: numDice }, () => Math.floor(Math.random() * 3)),
          omenCount: g.omenCount,
          settled: false,
        });
        return {
          ...g,
          drawnCard: null,
          message: "Rolling for haunt...",
        };
      }

      let message = "";
      if (card?.type === "event") {
        message = "Event resolved.";
      } else if (card?.type === "item") {
        message = "Item collected!";
      }
      return {
        ...g,
        drawnCard: null,
        turnPhase: "endTurn",
        message,
      };
    });
  }

  function handleDismissHauntRoll() {
    setDiceAnimation(null);
    setGame((g) => ({
      ...g,
      hauntRoll: null,
      turnPhase: "endTurn",
    }));
  }

  // Change floor via staircase
  function handleChangeFloor() {
    setGame((g) => {
      const p = g.players[g.currentPlayerIndex];

      // Find current tile
      const currentTile = g.board[p.floor]?.find((t) => t.x === p.x && t.y === p.y);
      if (!currentTile || !currentTile.connectsTo) return g;

      // Find the target tile on the board
      let targetTile = null;
      let targetFloor = null;
      for (const floor of ["ground", "upper", "basement"]) {
        const found = g.board[floor]?.find((t) => t.id === currentTile.connectsTo);
        if (found) {
          targetTile = found;
          targetFloor = floor;
          break;
        }
      }
      if (!targetTile) return g;

      // Check if this is a backtrack (target matches previous path position)
      const path = g.movePath;
      const prev = path.length >= 2 ? path[path.length - 2] : null;
      const isBacktrack = prev && prev.x === targetTile.x && prev.y === targetTile.y && prev.floor === targetFloor;

      if (isBacktrack) {
        const movesLeft = p.movesLeft + 1;
        const updatedPlayers = g.players.map((pl, i) =>
          i === g.currentPlayerIndex ? { ...pl, x: targetTile.x, y: targetTile.y, floor: targetFloor, movesLeft } : pl
        );
        return {
          ...g,
          players: updatedPlayers,
          movePath: path.slice(0, -1),
          pendingExplore: null,
          message: `${p.name} — ${movesLeft} move${movesLeft !== 1 ? "s" : ""} left`,
        };
      }

      if (p.movesLeft <= 0) return g;
      const movesLeft = p.movesLeft - 1;
      const updatedPlayers = g.players.map((pl, i) =>
        i === g.currentPlayerIndex ? { ...pl, x: targetTile.x, y: targetTile.y, floor: targetFloor, movesLeft } : pl
      );

      return {
        ...g,
        players: updatedPlayers,
        movePath: [...g.movePath, { x: targetTile.x, y: targetTile.y, floor: targetFloor }],
        message:
          movesLeft > 0
            ? `${p.name} moved to ${targetTile.name} — ${movesLeft} move${movesLeft !== 1 ? "s" : ""} left`
            : `${p.name} moved to ${targetTile.name} — no moves left`,
      };
    });
    // Auto-switch camera to the player's new floor
    setCameraFloor((prev) => {
      const p = game.players[game.currentPlayerIndex];
      const currentTile = game.board[p.floor]?.find((t) => t.x === p.x && t.y === p.y);
      if (!currentTile?.connectsTo) return prev;
      for (const floor of ["ground", "upper", "basement"]) {
        if (game.board[floor]?.find((t) => t.id === currentTile.connectsTo)) return floor;
      }
      return prev;
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

      const nextPlayer = g.players[next];
      const speed = nextPlayer.character.speed[nextPlayer.statIndex.speed];
      const updatedPlayers = g.players.map((pl, i) => (i === next ? { ...pl, movesLeft: speed } : pl));

      setCameraFloor(nextPlayer.floor);

      return {
        ...g,
        players: updatedPlayers,
        currentPlayerIndex: next,
        turnPhase: "move",
        movePath: [{ x: nextPlayer.x, y: nextPlayer.y, floor: nextPlayer.floor }],
        pendingExplore: null,
        turnNumber: g.turnNumber + (next === 0 ? 1 : 0),
        message: `${nextPlayer.name}'s turn — ${speed} moves`,
      };
    });
  }

  const validMoves = cameraFloor === currentPlayer.floor ? getValidMoves() : [];

  // Check if current player is on a staircase tile
  const currentTileObj = game.board[currentPlayer.floor]?.find(
    (t) => t.x === currentPlayer.x && t.y === currentPlayer.y
  );
  let stairTarget = null;
  let stairIsBacktrack = false;
  if (currentTileObj?.connectsTo && game.turnPhase === "move" && !game.pendingExplore) {
    for (const floor of ["ground", "upper", "basement"]) {
      const found = game.board[floor]?.find((t) => t.id === currentTileObj.connectsTo);
      if (found) {
        const path = game.movePath;
        const prev = path.length >= 2 ? path[path.length - 2] : null;
        stairIsBacktrack = prev && prev.x === found.x && prev.y === found.y && prev.floor === floor;
        if (currentPlayer.movesLeft > 0 || stairIsBacktrack) {
          stairTarget = found;
        }
        break;
      }
    }
  }

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
        <div className="game-header-right"></div>
      </div>

      {/* Message bar */}
      {game.message && <div className="game-message">{game.message}</div>}

      {/* Board */}
      <div className="board-container" ref={boardRef}>
        <div className="board-scroll">
          <div className="board-grid" style={{ width: gridWidth, height: gridHeight }}>
            {/* Movement path line */}
            {game.movePath.filter((p) => p.floor === cameraFloor).length >= 2 && (
              <svg className="path-svg" style={{ width: gridWidth, height: gridHeight }}>
                <polyline
                  points={game.movePath
                    .filter((p) => p.floor === cameraFloor)
                    .map((p) => {
                      const cx = (p.x - minX) * (TILE_SIZE + GAP) + TILE_SIZE / 2;
                      const cy = (p.y - minY) * (TILE_SIZE + GAP) + TILE_SIZE / 2;
                      return `${cx},${cy}`;
                    })
                    .join(" ")}
                  className="path-line"
                  style={{ stroke: currentPlayer.color }}
                />
              </svg>
            )}

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

            {/* Pending explore placeholder / rotate preview */}
            {game.pendingExplore &&
              game.pendingExplore.floor === cameraFloor &&
              (() => {
                const pe = game.pendingExplore;
                const left = (pe.x - minX) * (TILE_SIZE + GAP);
                const top = (pe.y - minY) * (TILE_SIZE + GAP);
                const tilePlayersHere = playersOnFloor.filter((p) => p.x === pe.x && p.y === pe.y);
                const isRotating = game.turnPhase === "rotate";
                const previewDoors = isRotating ? pe.validRotations[pe.rotationIndex] : [];

                return (
                  <div
                    key="pending-explore"
                    className={`board-tile ${isRotating ? "board-tile-rotate" : "board-tile-pending"}`}
                    style={{ left, top, width: TILE_SIZE, height: TILE_SIZE }}
                  >
                    {isRotating ? (
                      <>
                        <div className="tile-name">{pe.tile.name}</div>
                        {pe.tile.cardType && (
                          <div className={`tile-type tile-type-${pe.tile.cardType}`}>{pe.tile.cardType}</div>
                        )}
                        <div className="tile-doors">
                          {previewDoors.map((d) => (
                            <div key={d} className={`door door-${d}`} />
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="tile-name" style={{ color: "var(--accent)" }}>
                        ?
                      </div>
                    )}
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
              })()}

            {/* Explore/move targets */}
            {!game.pendingExplore &&
              validMoves.map((m) => {
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

            {/* Clickable overlay on existing tiles for movement/backtrack */}
            {validMoves
              .filter((m) => m.type === "move" || m.type === "backtrack")
              .map((m) => {
                const left = (m.x - minX) * (TILE_SIZE + GAP);
                const top = (m.y - minY) * (TILE_SIZE + GAP);
                return (
                  <button
                    key={`move-${m.x}-${m.y}`}
                    className={m.type === "backtrack" ? "backtrack-overlay" : "move-overlay"}
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
        {game.turnPhase === "move" && game.movePath.length > 1 && (
          <button className="btn btn-confirm" onClick={handleConfirmMove}>
            Move Here
          </button>
        )}
        {stairTarget && (
          <button className="btn btn-stairs" onClick={handleChangeFloor}>
            Move to {stairTarget.name}
          </button>
        )}
        {game.turnPhase === "rotate" && (
          <>
            <button className="btn btn-rotate" onClick={() => handleRotateTile(-1)}>
              ↺ Rotate Left
            </button>
            <button className="btn btn-confirm" onClick={handlePlaceTile}>
              Place Tile
            </button>
            <button className="btn btn-rotate" onClick={() => handleRotateTile(1)}>
              Rotate Right ↻
            </button>
          </>
        )}
        {(game.turnPhase === "endTurn" || game.turnPhase === "move") && !game.pendingExplore && (
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

      {/* Card overlay */}
      {game.drawnCard && (
        <div className="card-overlay">
          <div className={`card-modal card-${game.drawnCard.type}`}>
            <div className="card-type-label">{game.drawnCard.type.toUpperCase()}</div>
            <h2 className="card-name">{game.drawnCard.name}</h2>
            <p className="card-description">{game.drawnCard.description}</p>
            <p className="card-flavor">{game.drawnCard.flavor}</p>
            <button className="btn btn-primary" onClick={handleDismissCard}>
              {game.drawnCard.type === "omen" ? "Roll for Haunt" : "Continue"}
            </button>
          </div>
        </div>
      )}

      {/* Haunt roll overlay — animating */}
      {diceAnimation && !diceAnimation.settled && (
        <div className="card-overlay">
          <div className="card-modal card-haunt-rolling">
            <div className="card-type-label">HAUNT ROLL</div>
            <div className="dice-container">
              {diceAnimation.display.map((d, i) => (
                <div key={i} className="die die-rolling">
                  {d}
                </div>
              ))}
            </div>
            <h2 className="card-name">Rolling...</h2>
          </div>
        </div>
      )}

      {/* Haunt roll overlay — settled */}
      {game.hauntRoll && diceAnimation?.settled && (
        <div className="card-overlay">
          <div className={`card-modal ${game.hauntRoll.hauntTriggered ? "card-haunt-triggered" : "card-haunt-safe"}`}>
            <div className="card-type-label">HAUNT ROLL</div>
            <div className="dice-container">
              {game.hauntRoll.dice.map((d, i) => (
                <div key={i} className="die">
                  {d}
                </div>
              ))}
            </div>
            <div className="dice-total">Total: {game.hauntRoll.total}</div>
            <div className="dice-target">Need less than 5 to be safe</div>
            <h2 className="card-name">{game.hauntRoll.hauntTriggered ? "THE HAUNT BEGINS!" : "Safe... for now."}</h2>
            <p className="card-description">
              {game.hauntRoll.hauntTriggered
                ? `Rolled ${game.hauntRoll.total} with ${game.hauntRoll.omenCount} dice — 5 or higher! The haunt is upon you!`
                : `Rolled ${game.hauntRoll.total} with ${game.hauntRoll.omenCount} dice — less than 5. The house spares you... for now.`}
            </p>
            <button className="btn btn-primary" onClick={handleDismissHauntRoll}>
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
