import { useState, useRef, useEffect } from "react";
import { STARTING_TILES, createTileStack } from "./tiles";
import { createEventDeck, createItemDeck, createOmenDeck } from "./cards";
import { describeEventEffects, getEventRollButtonLabel } from "./events/eventUtils";
import {
  applyTileEffectConsequences,
  createDiceModifier,
  createDamageChoice,
  formatSourceNames,
  getEventUiState,
  getDamageReduction,
  getMysticElevatorDestination,
  getPostDamageEffectsForChoice,
  getTileAtPosition,
  isQueuedTileEffectType,
  resolveDamageEffect,
  resolveEventAnimationSettlement,
  resolveRollReadyAwaiting,
  resolveTraitRoll,
  updateDamageChoiceType,
  rollDice,
  chooseRabbitFootDieState,
  applyRabbitFootRerollState,
  chooseCardActiveAbilityValueState,
  chooseCardActiveAbilityNowState,
  getCardActiveAbilityState,
  resolveEventDamageChoiceState,
  getDogTradeTargets,
  getDogMoveOptions,
  isItemAbilityTileChoiceAwaiting,
} from "./events/eventActions";
import { getMatchingOutcome } from "./events/eventEngine";
import { useDrawnCardHandlers, useEventActionHandlers, useEventRuntimeEffects } from "./events/useEventHooks";
import EventResolutionModal, {
  CardAbilityContent,
  DrawnCardModal,
  EventTileChoiceTargets,
} from "./components/EventResolutionModal";
import {
  applyDrawIdolEventCardState,
  getIdolChoiceStateForQueuedEvent,
  applySkipIdolEventCardState,
} from "./omens/idolAbility";
import { resolveSpecialOmenNowAbilityState } from "./omens/activeOmenNowAbility";
import {
  applyDogTradeMoveState,
  createDogTradeBackToMoveState,
  createDogTradeSelectionState,
  getDogTradeUiState,
  isItemTradeLockedThisTurn,
  resolveConfirmDogTradeState,
  toggleDogTradeOwnerGiveState,
  toggleDogTradeTargetGiveState,
} from "./omens/dogAbility";
import {
  isEndTurnItemChoiceEffect,
  resolveEndTurnItemPassiveChoiceState,
  resolveEndTurnItemPassiveState,
} from "./items/turnStateItemAbility";
import {
  canUseArmedSkeletonKeyMovement,
  createSkeletonKeyResultTileEffect,
  isSkeletonKeyResultEffect,
  resolveSkeletonKeyResultAfterDismiss,
} from "./items/movementItemAbility";
import "./GameBoard.css";

// Direction offsets
const DIR = {
  N: { dx: 0, dy: -1 },
  S: { dx: 0, dy: 1 },
  E: { dx: 1, dy: 0 },
  W: { dx: -1, dy: 0 },
};

const OPPOSITE = { N: "S", S: "N", E: "W", W: "E" };

const DAMAGE_STATS = {
  physical: ["might", "speed"],
  mental: ["sanity", "knowledge"],
  general: ["might", "speed", "sanity", "knowledge"],
};

const STAT_LABELS = {
  might: "Might",
  speed: "Speed",
  sanity: "Sanity",
  knowledge: "Knowledge",
};

const STAT_ICONS = {
  might: "💪",
  speed: "🏃",
  sanity: "🧠",
  knowledge: "📖",
};

const PLAYER_STAT_ORDER = ["might", "speed", "sanity", "knowledge"];
const CRITICAL_STAT_INDEX = 1;

const TILE_SIZE = 100;
const GAP = 4;

function describePostDamageEffects(effects) {
  if (!effects || effects.length === 0) return "";

  return effects
    .map((effect) => `gain ${effect.amount} ${STAT_LABELS[effect.stat]} from ${effect.sourceName}`)
    .join(" and ");
}

function formatStatTrackValue(value) {
  return value === 0 ? "☠" : value;
}

function DiceRow({ dice, modifier = null, rolling = false }) {
  return (
    <div className="dice-row">
      <div className="dice-container">
        {dice.map((d, i) => (
          <div key={i} className={rolling ? "die die-rolling" : "die"}>
            {d}
          </div>
        ))}
      </div>
      {modifier && (
        <div className={`dice-modifier dice-modifier-${modifier.tone}`}>
          <div className="dice-modifier-value">{modifier.value}</div>
          <div className="dice-modifier-label">{modifier.label}</div>
        </div>
      )}
    </div>
  );
}

// Initialize game state from players
function initGameState(players) {
  const tileStack = createTileStack();
  const itemDeck = createItemDeck();
  const omenDeck = createOmenDeck();
  const eventDeck = createEventDeck();

  // Ground floor starts with 3 tiles in a vertical line:
  // Entrance Hall (0,0) — Hallway (0,-1) — Grand Staircase (0,-2)
  const entrance = { ...STARTING_TILES[0], x: 0, y: 0, floor: "ground" };
  const hallway = { ...STARTING_TILES[1], x: 0, y: -1, floor: "ground" };
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
      ground: [entrance, hallway, grandStaircase],
      upper: [upperLanding],
      basement: [basementLanding],
    },
    tileStack,
    itemDeck,
    omenDeck,
    eventDeck,
    currentPlayerIndex: 0,
    turnPhase: "move",
    movePath: [{ x: 0, y: 0, floor: "ground", cost: 0 }],
    pendingExplore: null,
    pendingSpecialPlacement: null,
    mysticElevatorReady: false,
    mysticElevatorUsed: false,
    omenCount: 0,
    hauntTriggered: false,
    drawnCard: null,
    hauntRoll: null,
    tileEffect: null,
    damageChoice: null,
    rabbitFootPendingReroll: null,
    skeletonKeyArmed: false,
    extraTurnAfterCurrent: false,
    eventState: null,
    turnNumber: 1,
    message: `${players[0].name}'s turn — ${players[0].character.speed[players[0].character.startIndex.speed]} moves`,
  };
}

function createDrawnItemCard(card) {
  return {
    type: "item",
    ...card,
  };
}

function createDrawnOmenCard(card) {
  return {
    type: "omen",
    ...card,
  };
}

function createDrawnEventCard(card) {
  return {
    type: "event",
    ...card,
  };
}

function shouldShowMessageBubble(message) {
  if (!message || !String(message).trim()) return false;

  // Suppress routine movement/status chatter so the bubble only appears for notable moments.
  const routinePatterns = [
    /\bmove(?:d|s)?\b/i,
    /\bmoves left\b/i,
    /\bno moves left\b/i,
    /rotate the tile, then place it/i,
    /turn\s*[-\u2014]/i,
  ];

  return !routinePatterns.some((pattern) => pattern.test(message));
}

function isStickyMessageBubble(message) {
  if (!message || !String(message).trim()) return false;
  return /^Now moving\b/i.test(String(message).trim());
}

export default function GameBoard({ players, onQuit }) {
  const [game, setGame] = useState(() => initGameState(players));
  const [cameraFloor, setCameraFloor] = useState("ground");
  const [diceAnimation, setDiceAnimation] = useState(null);
  const [expandedSidebarPlayers, setExpandedSidebarPlayers] = useState(() => new Set());
  const [viewedCard, setViewedCard] = useState(null);
  const [dogTradeState, setDogTradeState] = useState(null);
  const [queuedTraitRollOverride, setQueuedTraitRollOverride] = useState(null);
  const [messageBubble, setMessageBubble] = useState("");
  const queuedTraitRollOverrideRef = useRef(null);
  const messageBubbleTimeoutRef = useRef(null);
  const boardRef = useRef(null);

  useEffect(() => {
    queuedTraitRollOverrideRef.current = queuedTraitRollOverride;
  }, [queuedTraitRollOverride]);

  useEffect(() => {
    if (messageBubbleTimeoutRef.current) {
      clearTimeout(messageBubbleTimeoutRef.current);
      messageBubbleTimeoutRef.current = null;
    }

    if (!shouldShowMessageBubble(game.message)) {
      setMessageBubble("");
      return;
    }

    setMessageBubble(game.message);
    if (isStickyMessageBubble(game.message)) {
      return;
    }

    messageBubbleTimeoutRef.current = setTimeout(() => {
      setMessageBubble("");
      messageBubbleTimeoutRef.current = null;
    }, 3600);

    return () => {
      if (messageBubbleTimeoutRef.current) {
        clearTimeout(messageBubbleTimeoutRef.current);
        messageBubbleTimeoutRef.current = null;
      }
    };
  }, [game.message]);

  // Dice rolling animation
  useEffect(() => {
    if (!diceAnimation || diceAnimation.settled) return;
    const activeAnimation = diceAnimation;

    const interval = setInterval(() => {
      setDiceAnimation((prev) => {
        if (!prev || prev.settled) return prev;
        if (prev.purpose === "event-partial-reroll" && Array.isArray(prev.rerollIndexes)) {
          const nextDisplay = [...prev.display];
          for (const dieIndex of prev.rerollIndexes) {
            if (dieIndex >= 0 && dieIndex < nextDisplay.length) {
              nextDisplay[dieIndex] = Math.floor(Math.random() * 3);
            }
          }
          return {
            ...prev,
            display: nextDisplay,
          };
        }
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
      const da = activeAnimation;
      if (!da) return;
      const baseTotal = da.final.reduce((a, b) => a + b, 0);
      const total = baseTotal;

      if (da.purpose === "haunt") {
        const hauntTriggered = baseTotal >= 5;
        setGame((g) => ({
          ...g,
          hauntRoll: {
            dice: da.final,
            total: baseTotal,
            omenCount: da.omenCount,
            hauntTriggered,
          },
          hauntTriggered: g.hauntTriggered || hauntTriggered,
          message: hauntTriggered
            ? `THE HAUNT BEGINS! Rolled ${baseTotal} with ${da.omenCount} dice!`
            : `Safe... Rolled ${baseTotal} with ${da.omenCount} dice.`,
        }));
      } else if (
        da.purpose === "event-roll" ||
        da.purpose === "event-partial-reroll" ||
        da.purpose === "event-damage-roll" ||
        da.purpose === "event-damage-sequence" ||
        da.purpose === "event-trait-sequence-roll"
      ) {
        setGame((g) => resolveEventAnimationSettlement(g, da).game);
        setDiceAnimation(null);
      } else if (da.purpose === "collapsed") {
        setGame((g) => {
          const total = da.resolvedTotal ?? baseTotal;
          const collapsed = total < 5;
          const diceModifier = da.modifier || null;

          if (collapsed) {
            return {
              ...g,
              tileEffect: {
                type: "collapsed-pending",
                tileName: da.tileName,
                dice: da.final,
                diceModifier,
                total,
                message: `The floor gives way! Rolled ${total} (needed 5+). Press Roll to roll for damage.`,
              },
            };
          }

          return {
            ...g,
            tileEffect: {
              type: "collapsed",
              tileName: da.tileName,
              dice: da.final,
              diceModifier,
              total,
              collapsed: false,
              damageDice: [],
              damage: 0,
              message: `The floor holds! Rolled ${total} (needed 5+). Safe!`,
            },
          };
        });
      } else if (da.purpose === "collapsed-damage") {
        setGame((g) => {
          const player = g.players[da.playerIndex ?? g.currentPlayerIndex];
          const baseDamage = da.final[0];
          const damageReduction = getDamageReduction(player, "physical");
          const damage = Math.max(0, baseDamage - damageReduction.amount);
          const damageDiceModifier = createDiceModifier({
            amount: damageReduction.amount,
            sourceNames: damageReduction.sourceNames,
            sign: "-",
            labelPrefix: "blocked by",
          });

          return {
            ...g,
            tileEffect: {
              type: "collapsed",
              tileName: da.tileName,
              dice: da.firstDice,
              total: da.firstTotal,
              collapsed: true,
              damageType: "physical",
              damageDice: da.final,
              damageDiceModifier,
              damage,
              damageResolved: true,
              message:
                damage > 0
                  ? `The floor gives way! Rolled ${da.firstTotal} (needed 5+). Fall to Basement Landing and take ${damage} physical damage.`
                  : `The floor gives way! Rolled ${da.firstTotal} (needed 5+). Fall to Basement Landing, but the damage is reduced to 0.`,
            },
          };
        });
      } else if (da.purpose === "furnace") {
        setGame((g) => {
          const player = g.players[da.playerIndex ?? g.currentPlayerIndex];
          const baseDamage = da.final[0];
          const damageReduction = getDamageReduction(player, "physical");
          const damage = Math.max(0, baseDamage - damageReduction.amount);
          const diceModifier = createDiceModifier({
            amount: damageReduction.amount,
            sourceNames: damageReduction.sourceNames,
            sign: "-",
            labelPrefix: "blocked by",
          });

          return {
            ...g,
            tileEffect: {
              type: "furnace",
              tileName: da.tileName,
              dice: da.final,
              diceModifier,
              damageType: "physical",
              damage,
              damageResolved: true,
              message:
                damage > 0
                  ? `The furnace burns! Take ${damage} physical damage.`
                  : baseDamage > 0 && damageReduction.amount > 0
                    ? `The furnace burns, but the damage is reduced to 0.`
                    : "The furnace sputters — no damage!",
            },
          };
        });
      } else if (da.purpose === "mystic-elevator") {
        setGame((g) => {
          const player = g.players[g.currentPlayerIndex];
          const elevatorTile = g.board[player.floor]?.find((tile) => tile.x === player.x && tile.y === player.y);
          if (!elevatorTile || elevatorTile.id !== "mystic-elevator") {
            return {
              ...g,
              tileEffect: {
                type: "mystic-elevator-result",
                tileName: "Mystic Elevator",
                dice: da.final,
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
            ...g.board,
            [player.floor]: (g.board[player.floor] || []).filter((tile) => tile !== elevatorTile),
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
              ...g,
              tileEffect: {
                type: "mystic-elevator-result",
                tileName: "Mystic Elevator",
                dice: da.final,
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
            ...g,
            tileEffect: {
              type: "mystic-elevator-result",
              tileName: "Mystic Elevator",
              dice: da.final,
              total,
              message: `Rolled ${total}. Choose an open doorway on ${destination.label}.`,
              nextTurnPhase: "special-place",
              nextMessage: "Choose where to move the Mystic Elevator.",
              pendingSpecialPlacement: {
                mode: "move-existing",
                tile: elevatorTile,
                placements,
                nextTurnPhase: "move",
                nextMessage:
                  player.movesLeft > 0
                    ? `${player.name} rides the Mystic Elevator. ${player.movesLeft} move${player.movesLeft !== 1 ? "s" : ""} left.`
                    : `${player.name} rides the Mystic Elevator. No moves left.`,
              },
            },
          };
        });
      } else if (da.purpose === "skeleton-key") {
        setGame((g) => {
          return {
            ...g,
            tileEffect: createSkeletonKeyResultTileEffect(da.final, g.message),
          };
        });
        setDiceAnimation(null);
      }
    }, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diceAnimation?.purpose, diceAnimation?.settled]);

  const currentPlayer = game.players[game.currentPlayerIndex];
  const floorTiles = game.board[cameraFloor] || [];

  // Keyboard controls
  useEffect(() => {
    function handleKeyDown(e) {
      if (dogTradeState) return;
      if (isItemAbilityTileChoiceAwaiting(game.eventState)) {
        return;
      }

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

      const moveCost = getLeaveMoveCost(tile);
      if (currentPlayer.movesLeft < moveCost) return;

      const neighbor = getTileAt(nx, ny, currentPlayer.floor);

      if (neighbor && neighbor.doors.includes(OPPOSITE[dir])) {
        handleMove(nx, ny, moveCost);
      } else if (!neighbor) {
        handleExplore(dir, nx, ny, moveCost);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Get tile at position
  function getTileAt(x, y, floor) {
    return game.board[floor]?.find((t) => t.x === x && t.y === y);
  }

  function getLeaveMoveCost(tile) {
    return tile?.obstacle ? 2 : 1;
  }

  function getPlacementOptions(board, tile) {
    const allDirs = ["N", "E", "S", "W"];
    const placements = [];

    for (const floor of tile.floors || []) {
      for (const baseTile of board[floor] || []) {
        for (const dir of baseTile.doors) {
          const { dx, dy } = DIR[dir];
          const x = baseTile.x + dx;
          const y = baseTile.y + dy;
          const occupied = board[floor]?.some((placedTile) => placedTile.x === x && placedTile.y === y);
          if (occupied) continue;

          const neededDoor = OPPOSITE[dir];
          const validRotations = [];
          for (let rot = 0; rot < 4; rot++) {
            const rotatedDoors = tile.doors.map((door) => {
              const doorIndex = allDirs.indexOf(door);
              return allDirs[(doorIndex + rot) % 4];
            });
            if (rotatedDoors.includes(neededDoor)) {
              validRotations.push(rotatedDoors);
            }
          }

          if (validRotations.length === 0) continue;

          placements.push({
            floor,
            x,
            y,
            validRotations,
          });
        }
      }
    }

    return placements;
  }

  function getConnectedMoveTarget(board, currentTile, path) {
    if (!currentTile) return null;

    const prev = path.length >= 2 ? path[path.length - 2] : null;

    if (currentTile.connectsTo) {
      for (const floor of ["ground", "upper", "basement"]) {
        const found = board[floor]?.find((tile) => tile.id === currentTile.connectsTo);
        if (found) {
          return {
            targetTile: found,
            targetFloor: floor,
            isBacktrack: Boolean(prev && prev.x === found.x && prev.y === found.y && prev.floor === floor),
          };
        }
      }
    }

    if (prev) {
      const previousTile = board[prev.floor]?.find((tile) => tile.x === prev.x && tile.y === prev.y);
      if (previousTile?.connectsTo === currentTile.id) {
        return {
          targetTile: previousTile,
          targetFloor: prev.floor,
          isBacktrack: true,
        };
      }
    }

    return null;
  }

  // Get valid move directions from current tile
  function getValidMoves() {
    if (game.turnPhase !== "move") return [];
    if (isItemAbilityTileChoiceAwaiting(game.eventState)) {
      return [];
    }

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
    const moveCost = getLeaveMoveCost(tile);
    const canUseSkeletonKeyMovement = canUseArmedSkeletonKeyMovement(game, currentPlayer);
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
          } else if (currentPlayer.movesLeft >= moveCost) {
            moves.push({ dir, x: nx, y: ny, type: "move", cost: moveCost });
          }
        }
      } else if (currentPlayer.movesLeft >= moveCost) {
        moves.push({ dir, x: nx, y: ny, type: "explore", cost: moveCost });
      }
    }

    if (canUseSkeletonKeyMovement && currentPlayer.movesLeft >= moveCost) {
      const dirs = ["N", "S", "E", "W"];
      for (const dir of dirs) {
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

  // Move player to an existing tile and extend the current path.
  function handleMove(nx, ny, cost, options = {}) {
    const { useSkeletonKey = false } = options;
    const skeletonKeyRoll = useSkeletonKey ? rollDice(1)[0] : null;
    setGame((g) => {
      const player = g.players[g.currentPlayerIndex];
      const currentTile = g.board[player.floor]?.find((t) => t.x === player.x && t.y === player.y);
      const resolvedCost = cost ?? getLeaveMoveCost(currentTile);
      if (player.movesLeft < resolvedCost) return g;

      if (useSkeletonKey && !canUseArmedSkeletonKeyMovement(g, player)) return g;

      const movesLeft = player.movesLeft - resolvedCost;
      const newPath = [...g.movePath, { x: nx, y: ny, floor: player.floor, cost: resolvedCost }];
      const destinationTile = g.board[player.floor]?.find((tile) => tile.x === nx && tile.y === ny);

      let keyRoll = null;
      if (useSkeletonKey) {
        keyRoll = skeletonKeyRoll;
      }

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
            ? `${g.players[g.currentPlayerIndex].name} — ${movesLeft} move${movesLeft !== 1 ? "s" : ""} left`
            : `${g.players[g.currentPlayerIndex].name} — no moves left`;

      const skeletonKeyMessage =
        useSkeletonKey && keyRoll !== null
          ? `Skeleton Key roll: ${keyRoll}. Resolve the result after you continue.`
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
    });

    if (useSkeletonKey && skeletonKeyRoll !== null) {
      setDiceAnimation({
        purpose: "skeleton-key",
        final: [skeletonKeyRoll],
        display: [Math.floor(Math.random() * 3)],
        settled: false,
        tileName: "Skeleton Key",
      });
    }
  }

  // Backtrack to previous tile in path and refund the cost of the undone step.
  function handleBacktrack() {
    setGame((g) => {
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

  // Explore — move player onto placeholder, don't reveal tile yet.
  function handleExplore(dir, nx, ny, cost) {
    setGame((g) => {
      const player = g.players[g.currentPlayerIndex];
      const floor = player.floor;
      const currentTile = g.board[floor]?.find((t) => t.x === player.x && t.y === player.y);
      const resolvedCost = cost ?? getLeaveMoveCost(currentTile);
      if (player.movesLeft < resolvedCost) return g;

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

      const movesLeft = player.movesLeft - resolvedCost;
      const newPath = [...g.movePath, { x: nx, y: ny, floor, cost: resolvedCost }];
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
    } else if (move.type === "wall-move") {
      handleMove(move.x, move.y, move.cost, { useSkeletonKey: true });
    } else if (move.type === "move") {
      handleMove(move.x, move.y, move.cost);
    } else {
      handleExplore(move.dir, move.x, move.y, move.cost);
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
        movePath: [{ x: p.x, y: p.y, floor: p.floor, cost: 0 }],
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
      const resolvePlacedTileOutcome = ({ board, tileStack, itemDeck, omenDeck, eventDeck, players, omenCount }) => {
        let nextBoard = board;
        let nextStack = tileStack;
        let nextItemDeck = itemDeck;
        let nextOmenDeck = omenDeck;
        let nextEventDeck = eventDeck;
        let message = `${p.name} placed ${placedTile.name}!`;
        let turnPhase = "move";
        let drawnCard = null;
        let nextOmenCount = omenCount;
        let nextPlayers = players;
        let tileEffect = null;

        if (pe.tile.cardType) {
          const cardType = pe.tile.cardType;
          if (cardType === "item") {
            const deck = [...nextItemDeck];
            const nextItem = deck.shift();
            nextItemDeck = deck;
            drawnCard = nextItem ? createDrawnItemCard(nextItem) : null;
          } else if (cardType === "omen") {
            const deck = [...nextOmenDeck];
            const nextOmen = deck.shift();
            nextOmenDeck = deck;
            drawnCard = nextOmen ? createDrawnOmenCard(nextOmen) : null;
          } else {
            const deck = [...nextEventDeck];
            const nextEvent = deck.shift();
            nextEventDeck = deck;
            drawnCard = nextEvent ? createDrawnEventCard(nextEvent) : null;
          }
          if (cardType === "omen") {
            nextOmenCount += 1;
          }
          if (drawnCard) {
            message += ` A${cardType === "omen" || cardType === "event" ? "n" : "n"} ${cardType} card appears...`;
          }
          turnPhase = "card";
        } else {
          message += ` ${p.movesLeft} move${p.movesLeft !== 1 ? "s" : ""} left.`;
        }

        if (placedTile.discoverEffect === "junk-room") {
          nextBoard = {
            ...nextBoard,
            [pe.floor]: nextBoard[pe.floor].map((tile) =>
              tile.x === placedTile.x && tile.y === placedTile.y ? { ...tile, obstacle: true } : tile
            ),
          };

          const junkMessage = `${p.name} places an obstacle token in the Junk Room.`;
          tileEffect = {
            type: "junk-room",
            tileName: placedTile.name,
            message: junkMessage,
            queuedCard: drawnCard,
            nextTurnPhase: drawnCard ? "card" : "move",
            nextMessage: drawnCard
              ? `${junkMessage} ${drawnCard.type.toUpperCase()} card appears...`
              : `${junkMessage} ${p.movesLeft} move${p.movesLeft !== 1 ? "s" : ""} left.`,
          };

          drawnCard = null;
          turnPhase = "card";
          message = junkMessage;
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
              panicMessage = `${p.name} reveals the Secret Staircase. Choose any open doorway to place it.`;

              tileEffect = {
                type: "panic-room",
                tileName: placedTile.name,
                message: `${panicMessage} The tile stack is shuffled.`,
                queuedCard: drawnCard,
                nextTurnPhase: "special-place",
                nextMessage: "Place the Secret Staircase on any open doorway.",
                pendingSpecialPlacement: {
                  tile: secretTile,
                  placements,
                  queuedCard: drawnCard,
                  nextTurnPhase: drawnCard ? "card" : "move",
                  nextMessage: drawnCard
                    ? `${p.name} placed the Secret Staircase. An omen card appears...`
                    : `${p.name} placed the Secret Staircase. ${p.movesLeft} move${p.movesLeft !== 1 ? "s" : ""} left.`,
                },
              };
            } else {
              panicMessage = `${p.name} found the Secret Staircase, but there was nowhere to place it.`;

              tileEffect = {
                type: "panic-room",
                tileName: placedTile.name,
                message: `${panicMessage} The tile stack is shuffled.`,
                queuedCard: drawnCard,
                nextTurnPhase: drawnCard ? "card" : "move",
                nextMessage: drawnCard
                  ? `${panicMessage} An omen card appears...`
                  : `${panicMessage} ${p.movesLeft} move${p.movesLeft !== 1 ? "s" : ""} left.`,
              };
            }
          } else {
            panicMessage = "The Secret Staircase is already in play.";

            tileEffect = {
              type: "panic-room",
              tileName: placedTile.name,
              message: `${panicMessage} The tile stack is shuffled.`,
              queuedCard: drawnCard,
              nextTurnPhase: drawnCard ? "card" : "move",
              nextMessage: drawnCard
                ? `${panicMessage} An omen card appears...`
                : `${panicMessage} ${p.movesLeft} move${p.movesLeft !== 1 ? "s" : ""} left.`,
            };
          }

          nextStack = [...nextStack].sort(() => Math.random() - 0.5);
          drawnCard = null;
          turnPhase = tileEffect?.nextTurnPhase || "card";
          message = panicMessage;
        }

        if (placedTile.discoverEffect === "armory") {
          const { weaponCard, remainingDeck } = drawWeaponItem(nextItemDeck);
          nextItemDeck = remainingDeck;

          const armoryMessage = weaponCard
            ? `${p.name} searched the Armory and found ${weaponCard.name}.`
            : `${p.name} searched the Armory but found no weapon.`;

          tileEffect = {
            type: "armory",
            tileName: placedTile.name,
            message: armoryMessage,
            queuedCard: weaponCard ? createDrawnItemCard(weaponCard) : null,
            nextTurnPhase: weaponCard ? "card" : "move",
            nextMessage: weaponCard
              ? `${armoryMessage} A weapon item is taken.`
              : `${armoryMessage} ${p.movesLeft} move${p.movesLeft !== 1 ? "s" : ""} left.`,
          };

          drawnCard = null;
          turnPhase = weaponCard ? "card" : "move";
          message = armoryMessage;
        }

        const enableMysticElevator = placedTile.enterEffect === "mystic-elevator" && !g.mysticElevatorUsed;
        if (enableMysticElevator) {
          tileEffect = null;
          turnPhase = "move";
          message = `${p.name} placed Mystic Elevator! Use Elevator to roll 2 dice.`;
        }

        if (placedTile.discoverGain) {
          const { stat, amount } = placedTile.discoverGain;
          const currentIndex = p.statIndex[stat];
          const maxIndex = p.character[stat].length - 1;
          const appliedAmount = Math.min(amount, maxIndex - currentIndex);

          nextPlayers = applyStatChange(nextPlayers, g.currentPlayerIndex, stat, appliedAmount);

          const nextValue =
            nextPlayers[g.currentPlayerIndex].character[stat][nextPlayers[g.currentPlayerIndex].statIndex[stat]];
          const gainMessage =
            appliedAmount > 0
              ? `${p.name} gains ${appliedAmount} ${STAT_LABELS[stat]} from ${placedTile.name}. ${STAT_LABELS[stat]} is now ${nextValue}.`
              : `${p.name} cannot gain more ${STAT_LABELS[stat]} from ${placedTile.name}.`;

          tileEffect = {
            type: "discover-gain",
            tileName: placedTile.name,
            gainStat: stat,
            gainAmount: appliedAmount,
            message: gainMessage,
            queuedCard: drawnCard,
            nextTurnPhase: drawnCard ? "card" : "move",
            nextMessage: drawnCard
              ? `${gainMessage} ${drawnCard.type.toUpperCase()} card appears...`
              : `${gainMessage} ${p.movesLeft} move${p.movesLeft !== 1 ? "s" : ""} left.`,
          };

          drawnCard = null;
          turnPhase = "card";
          message = gainMessage;
        }

        const idolOfferState = getIdolChoiceStateForQueuedEvent({
          player: nextPlayers[g.currentPlayerIndex],
          tileName: placedTile.name,
          queuedCard: drawnCard,
          nextTurnPhase: "move",
          nextMessage: `${p.name} ${p.movesLeft} move${p.movesLeft !== 1 ? "s" : ""} left.`,
          blockedByTileEffect: !!tileEffect,
          offerMessage: `${p.name} discovered an Event symbol.`,
        });
        if (idolOfferState) {
          tileEffect = idolOfferState.tileEffect;
          drawnCard = idolOfferState.drawnCard;
          turnPhase = idolOfferState.turnPhase;
          message = idolOfferState.message;
        }

        return {
          board: nextBoard,
          tileStack: nextStack,
          itemDeck: nextItemDeck,
          omenDeck: nextOmenDeck,
          eventDeck: nextEventDeck,
          players: nextPlayers,
          movePath: [{ x: p.x, y: p.y, floor: p.floor, cost: 0 }],
          pendingExplore: null,
          pendingSpecialPlacement: null,
          mysticElevatorReady: enableMysticElevator ? true : g.mysticElevatorReady,
          mysticElevatorUsed: g.mysticElevatorUsed,
          omenCount: nextOmenCount,
          drawnCard,
          tileEffect,
          turnPhase,
          message,
        };
      };

      const outcome = resolvePlacedTileOutcome({
        board: newBoard,
        tileStack: newStack,
        itemDeck: [...g.itemDeck],
        omenDeck: [...g.omenDeck],
        eventDeck: [...g.eventDeck],
        players: g.players,
        omenCount: g.omenCount,
      });

      return {
        ...g,
        ...outcome,
      };
    });
  }

  // Change floor via staircase
  function handleChangeFloor() {
    setGame((g) => {
      const p = g.players[g.currentPlayerIndex];

      // Find current tile
      const currentTile = g.board[p.floor]?.find((t) => t.x === p.x && t.y === p.y);
      const path = g.movePath;
      const connectedMove = getConnectedMoveTarget(g.board, currentTile, path);
      if (!connectedMove) return g;

      const { targetTile, targetFloor, isBacktrack } = connectedMove;

      if (isBacktrack) {
        const lastStep = path[path.length - 1];
        const movesLeft = p.movesLeft + (lastStep.cost ?? 1);
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

      const moveCost = getLeaveMoveCost(currentTile);
      if (p.movesLeft < moveCost) return g;
      const movesLeft = p.movesLeft - moveCost;
      const updatedPlayers = g.players.map((pl, i) =>
        i === g.currentPlayerIndex ? { ...pl, x: targetTile.x, y: targetTile.y, floor: targetFloor, movesLeft } : pl
      );

      return {
        ...g,
        players: updatedPlayers,
        movePath: [...g.movePath, { x: targetTile.x, y: targetTile.y, floor: targetFloor, cost: moveCost }],
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
      const connectedMove = getConnectedMoveTarget(game.board, currentTile, game.movePath);
      return connectedMove?.targetFloor || prev;
    });
  }

  function handleUseSecretPassage(target) {
    setGame((g) => {
      const player = g.players[g.currentPlayerIndex];
      if (g.turnPhase !== "move") return g;

      const currentTile = g.board[player.floor]?.find((tile) => tile.x === player.x && tile.y === player.y);
      const isOnSecretPassage = (currentTile?.tokens || []).some((token) => token.type === "secret-passage");
      if (!isOnSecretPassage) return g;

      const destinationTile = getTileAtPosition(g.board, target.x, target.y, target.floor);
      const destinationHasPassage = (destinationTile?.tokens || []).some((token) => token.type === "secret-passage");
      if (!destinationTile || !destinationHasPassage) return g;

      const path = g.movePath || [];
      const previousStep = path.length >= 2 ? path[path.length - 2] : null;
      const isBacktrack =
        previousStep &&
        previousStep.x === target.x &&
        previousStep.y === target.y &&
        previousStep.floor === target.floor;

      if (isBacktrack) {
        const lastStep = path[path.length - 1];
        const refundedMoves = player.movesLeft + (lastStep?.cost ?? 1);
        const updatedPlayers = g.players.map((current, index) =>
          index === g.currentPlayerIndex
            ? { ...current, x: target.x, y: target.y, floor: target.floor, movesLeft: refundedMoves }
            : current
        );

        return {
          ...g,
          players: updatedPlayers,
          movePath: path.slice(0, -1),
          message: `${player.name} backtracks through the Secret Passage to ${destinationTile.name} — ${refundedMoves} move${refundedMoves !== 1 ? "s" : ""} left`,
        };
      }

      if (player.movesLeft < 1) return g;

      const movesLeft = player.movesLeft - 1;
      const updatedPlayers = g.players.map((current, index) =>
        index === g.currentPlayerIndex
          ? { ...current, x: target.x, y: target.y, floor: target.floor, movesLeft }
          : current
      );

      return {
        ...g,
        players: updatedPlayers,
        movePath: [...g.movePath, { x: target.x, y: target.y, floor: target.floor, cost: 1 }],
        message:
          movesLeft > 0
            ? `${player.name} uses a Secret Passage to ${destinationTile.name} — ${movesLeft} move${movesLeft !== 1 ? "s" : ""} left`
            : `${player.name} uses a Secret Passage to ${destinationTile.name} — no moves left`,
      };
    });
    setCameraFloor(target.floor);
  }

  // End turn
  function handleEndTurn() {
    setGame((g) => {
      if (isItemAbilityTileChoiceAwaiting(g.eventState)) {
        return g;
      }

      const p = g.players[g.currentPlayerIndex];
      const tile = g.board[p.floor]?.find((t) => t.x === p.x && t.y === p.y);

      // Check for end-of-turn tile effects
      if (tile?.endOfTurn && !g.tileEffect) {
        if (tile.endOfTurn === "furnace") {
          const finalDice = rollDice(1);
          const damageReduction = getDamageReduction(p, "physical");
          setDiceAnimation({
            purpose: "furnace",
            final: finalDice,
            display: Array.from({ length: 1 }, () => Math.floor(Math.random() * 3)),
            tileName: tile.name,
            playerIndex: g.currentPlayerIndex,
            modifier: createDiceModifier({
              amount: damageReduction.amount,
              sourceNames: damageReduction.sourceNames,
              sign: "-",
              labelPrefix: "blocked by",
            }),
            settled: false,
          });
          return { ...g, message: `${tile.name} — rolling for damage...` };
        }
        if (tile.endOfTurn === "collapsed") {
          const speedVal = p.character.speed[p.statIndex.speed];
          const roll = resolveTraitRoll(p, {
            stat: "speed",
            baseDiceCount: speedVal,
            context: "end-of-turn",
            board: g.board,
          });
          setDiceAnimation({
            purpose: "collapsed",
            final: roll.dice,
            display: Array.from({ length: roll.dice.length }, () => Math.floor(Math.random() * 3)),
            tileName: tile.name,
            playerIndex: g.currentPlayerIndex,
            modifier: roll.modifier,
            resolvedTotal: roll.total,
            settled: false,
          });
          return { ...g, message: `${tile.name} — rolling for stability...` };
        }
        if (tile.endOfTurn === "laundry-chute") {
          return {
            ...g,
            tileEffect: {
              type: "laundry-chute",
              tileName: tile.name,
              message: "You slide down the laundry chute to the Basement Landing!",
            },
          };
        }
      }

      return passTurn(g);
    });
  }

  function applyStatChange(players, playerIndex, stat, amount) {
    if (!amount) return players;

    return players.map((pl, i) => {
      if (i !== playerIndex) return pl;

      const maxIndex = pl.character[stat].length - 1;
      const nextIndex = Math.max(0, Math.min(maxIndex, pl.statIndex[stat] + amount));
      const newStatIndex = { ...pl.statIndex, [stat]: nextIndex };
      const isAlive = Object.values(newStatIndex).every((value) => value > 0);

      return { ...pl, statIndex: newStatIndex, isAlive };
    });
  }

  function drawWeaponItem(itemDeck) {
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

  function applyDamageAllocation(players, playerIndex, allocation, adjustmentMode = "decrease") {
    return players.map((pl, i) => {
      if (i !== playerIndex) return pl;
      const newStatIndex = { ...pl.statIndex };
      for (const [stat, amount] of Object.entries(allocation)) {
        if (!amount) continue;
        const maxIndex = pl.character[stat].length - 1;
        newStatIndex[stat] =
          adjustmentMode === "increase"
            ? Math.min(maxIndex, newStatIndex[stat] + amount)
            : Math.max(0, newStatIndex[stat] - amount);
      }

      const isAlive = Object.values(newStatIndex).every((value) => value > 0);
      return { ...pl, statIndex: newStatIndex, isAlive };
    });
  }

  const eventEngineDeps = {
    DIR,
    getTileAtPosition,
    applyStatChange,
    PLAYER_STAT_ORDER,
    createDrawnItemCard,
    rollDice,
    resolveDamageEffect,
    createDamageChoice,
    getEventRollButtonLabel,
    STAT_LABELS,
  };
  const eventFlowDeps = {
    STAT_LABELS,
    rollDice,
    resolveTraitRoll,
  };

  useEventRuntimeEffects({
    game,
    diceAnimation,
    setGame,
    setDiceAnimation,
    eventFlowDeps,
    applyStatChange,
  });

  const {
    runAdvanceEventResolution,
    handleContinueEvent,
    handleAdjustEventRollTotal,
    handleEventAwaitingChoice,
    handleEventTileChoice,
    handleConfirmEventTileChoice,
  } = useEventActionHandlers({
    setGame,
    setCameraFloor,
    setDiceAnimation,
    eventEngineDeps,
    eventFlowDeps,
    getTileAtPosition,
    getMatchingOutcome,
    describeEventEffects,
    resolveRollReadyAwaiting,
  });

  const { handleDismissCard, handleDismissHauntRoll } = useDrawnCardHandlers({
    game,
    setGame,
    setCameraFloor,
    setDiceAnimation,
    setQueuedTraitRollOverride,
    getQueuedTraitRollOverride: () => queuedTraitRollOverrideRef.current,
    rollDice,
    runAdvanceEventResolution,
    resolveRollReadyAwaiting,
    eventFlowDeps,
  });

  useEffect(() => {
    if (!queuedTraitRollOverride) return;
    if (game.drawnCard?.type !== "event") return;
    handleDismissCard({ autoRollIfReady: true });
  }, [queuedTraitRollOverride, game.drawnCard, handleDismissCard]);

  function handleAdjustDamageAllocation(stat, delta) {
    setGame((g) => {
      const choice = g.damageChoice;
      if (!choice || !choice.allowedStats.includes(stat)) return g;

      const currentPlayerState = g.players[g.currentPlayerIndex];
      const currentAmount = choice.allocation[stat] || 0;
      const selectedTotal = Object.values(choice.allocation).reduce((sum, value) => sum + value, 0);
      const maxForStat =
        choice.adjustmentMode === "increase"
          ? currentPlayerState.character[stat].length - 1 - currentPlayerState.statIndex[stat]
          : currentPlayerState.statIndex[stat];

      if (delta > 0) {
        if (selectedTotal >= choice.amount) return g;
        if (currentAmount >= maxForStat) return g;
      }

      if (delta < 0 && currentAmount <= 0) return g;

      return {
        ...g,
        damageChoice: {
          ...(() => {
            const nextChoice = {
              ...choice,
              allocation: {
                ...choice.allocation,
                [stat]: Math.max(0, currentAmount + delta),
              },
            };

            return {
              ...nextChoice,
              postDamageEffects: getPostDamageEffectsForChoice(currentPlayerState, nextChoice),
            };
          })(),
        },
      };
    });
  }

  function handleToggleDamageConversion() {
    setGame((g) => {
      const choice = g.damageChoice;
      if (!choice?.canConvertToGeneral) return g;

      const nextDamageType = choice.damageType === "general" ? choice.originalDamageType : "general";
      return {
        ...g,
        damageChoice: updateDamageChoiceType(choice, g.players[g.currentPlayerIndex], nextDamageType),
      };
    });
  }

  function applyPostDamagePassiveEffects(players, playerIndex, choice) {
    if (!choice || choice.amount <= 0 || !choice.postDamageEffects?.length) {
      return { players, message: "" };
    }

    let updatedPlayers = players;
    const playerName = players[playerIndex]?.name || "Player";
    const messages = [];

    for (const effect of choice.postDamageEffects) {
      const beforeIndex = updatedPlayers[playerIndex].statIndex[effect.stat];
      updatedPlayers = applyStatChange(updatedPlayers, playerIndex, effect.stat, effect.amount);
      const afterIndex = updatedPlayers[playerIndex].statIndex[effect.stat];
      const appliedAmount = afterIndex - beforeIndex;

      if (appliedAmount > 0) {
        messages.push(`${playerName} gains ${appliedAmount} ${STAT_LABELS[effect.stat]} from ${effect.sourceName}.`);
      }
    }

    return {
      players: updatedPlayers,
      message: messages.join(" "),
    };
  }

  function handleConfirmDamageChoice() {
    let nextCameraFloor = null;
    setGame((g) => {
      const choice = g.damageChoice;
      if (!choice) return g;

      const selectedTotal = Object.values(choice.allocation).reduce((sum, value) => sum + value, 0);
      if (choice.allowPartial) {
        if (selectedTotal > choice.amount) return g;
      } else if (selectedTotal !== choice.amount) {
        return g;
      }

      const damagedPlayers = applyDamageAllocation(
        g.players,
        g.currentPlayerIndex,
        choice.allocation,
        choice.adjustmentMode
      );
      const postDamageResult = applyPostDamagePassiveEffects(damagedPlayers, g.currentPlayerIndex, choice);
      const resolvedPlayers = applyTileEffectConsequences(g, postDamageResult.players, choice.effect);
      const baseState = {
        ...g,
        players: resolvedPlayers,
        tileEffect: null,
        damageChoice: null,
      };

      const eventDamageResult = resolveEventDamageChoiceState(g, choice, baseState, postDamageResult.message, {
        runAdvanceEventResolution,
      });
      if (eventDamageResult) {
        nextCameraFloor = eventDamageResult.cameraFloor;
        return eventDamageResult.game;
      }

      const nextState = passTurn(baseState);

      return postDamageResult.message
        ? {
            ...nextState,
            message: `${postDamageResult.message} ${nextState.message}`,
          }
        : nextState;
    });
    setDiceAnimation(null);
    if (nextCameraFloor) {
      setCameraFloor(nextCameraFloor);
    }
  }

  function getDamagePreview(player, choice) {
    const preview = { ...player.statIndex };
    if (!choice) return preview;

    for (const [stat, amount] of Object.entries(choice.allocation)) {
      if (choice.adjustmentMode === "increase") {
        const maxIndex = player.character[stat].length - 1;
        preview[stat] = Math.min(maxIndex, preview[stat] + amount);
      } else {
        preview[stat] = Math.max(0, preview[stat] - amount);
      }
    }
    return preview;
  }

  function getStatTrackCellClass(index, currentIndex, previewIndex, adjustmentMode = "decrease") {
    if (index === currentIndex && index === previewIndex) {
      return "stat-track-cell stat-track-cell-current";
    }
    if (index === currentIndex) return "stat-track-cell stat-track-cell-current";
    if (index === previewIndex) {
      return `stat-track-cell ${
        adjustmentMode === "increase" ? "stat-track-cell-preview-gain" : "stat-track-cell-preview-loss"
      }`;
    }
    if (index < previewIndex) return "stat-track-cell stat-track-cell-spent";
    return "stat-track-cell";
  }

  function handleDismissTileEffect() {
    setGame((g) => {
      const effect = g.tileEffect;
      if (!effect) return passTurn(g);

      if (isQueuedTileEffectType(effect.type)) {
        if (effect.pendingSpecialPlacement) {
          setCameraFloor(effect.pendingSpecialPlacement.placements[0]?.floor || cameraFloor);
        }

        if (isSkeletonKeyResultEffect(effect)) {
          return resolveSkeletonKeyResultAfterDismiss(g, effect);
        }

        const currentPlayer = g.players[g.currentPlayerIndex];
        const queuedEventCard = effect.pendingSpecialPlacement ? null : effect.queuedCard || null;
        const idolOfferState = getIdolChoiceStateForQueuedEvent({
          player: currentPlayer,
          tileName: effect.tileName,
          queuedCard: queuedEventCard,
          nextTurnPhase: effect.nextTurnPhase,
          nextMessage: effect.nextMessage,
          offerMessage: `${currentPlayer.name} discovered an Event symbol.`,
        });
        if (idolOfferState) {
          return {
            ...g,
            tileEffect: idolOfferState.tileEffect,
            drawnCard: idolOfferState.drawnCard,
            pendingSpecialPlacement: effect.pendingSpecialPlacement || null,
            turnPhase: idolOfferState.turnPhase,
            message: idolOfferState.message,
          };
        }

        return {
          ...g,
          tileEffect: null,
          drawnCard: effect.pendingSpecialPlacement ? null : effect.queuedCard || null,
          pendingSpecialPlacement: effect.pendingSpecialPlacement || null,
          turnPhase: effect.nextTurnPhase,
          message: effect.nextMessage,
        };
      }

      const pi = g.currentPlayerIndex;
      const currentPlayerState = g.players[pi];
      const resolvedEffect = resolveDamageEffect(currentPlayerState, effect);

      if (resolvedEffect.damage > 0 && resolvedEffect.damageType) {
        return {
          ...g,
          tileEffect: null,
          damageChoice: createDamageChoice(resolvedEffect, currentPlayerState),
        };
      }

      const updatedPlayers = applyTileEffectConsequences(g, g.players, resolvedEffect);
      return passTurn({ ...g, players: updatedPlayers, tileEffect: null, damageChoice: null });
    });
    setDiceAnimation(null);
  }

  function handleChooseNecklaceOfTeethStat(stat) {
    setGame((g) => {
      const resolution = resolveEndTurnItemPassiveChoiceState(g, { stat });
      if (!resolution) return g;

      const current = g.players[g.currentPlayerIndex];
      const nextState = passTurnCore({
        ...g,
        players: resolution.players,
        tileEffect: null,
      });

      return {
        ...nextState,
        message: `${current.name} gains 1 ${STAT_LABELS[resolution.gainedStat]} with ${
          resolution.sourceName || "Necklace of Teeth"
        }. ${nextState.message}`,
      };
    });
    setDiceAnimation(null);
  }

  function handleDrawIdolEventCard() {
    setGame((g) => applyDrawIdolEventCardState(g));
  }

  function handleSkipIdolEventCard() {
    setGame((g) => applySkipIdolEventCardState(g));
  }

  function handleSkipNecklaceOfTeethGain() {
    setGame((g) => {
      if (!isEndTurnItemChoiceEffect(g.tileEffect)) return g;

      const current = g.players[g.currentPlayerIndex];
      const nextState = passTurnCore({
        ...g,
        tileEffect: null,
      });

      return {
        ...nextState,
        message: `${current.name} skips Necklace of Teeth. ${nextState.message}`,
      };
    });
    setDiceAnimation(null);
  }

  function handleRollMysticElevator() {
    setGame((g) => {
      const player = g.players[g.currentPlayerIndex];
      const currentTile = g.board[player.floor]?.find((tile) => tile.x === player.x && tile.y === player.y);
      if (!g.mysticElevatorReady || g.mysticElevatorUsed || currentTile?.id !== "mystic-elevator") return g;

      return {
        ...g,
        mysticElevatorReady: false,
        mysticElevatorUsed: true,
        tileEffect: null,
        message: "Rolling for the Mystic Elevator...",
      };
    });
    setDiceAnimation({
      purpose: "mystic-elevator",
      final: rollDice(2),
      display: Array.from({ length: 2 }, () => Math.floor(Math.random() * 3)),
      settled: false,
      tileName: "Mystic Elevator",
    });
  }

  function handleStartCollapsedDamage() {
    const te = game.tileEffect;
    if (!te || te.type !== "collapsed-pending") return;
    const damageFinal = rollDice(1);
    const damageReduction = getDamageReduction(game.players[game.currentPlayerIndex], "physical");
    // clear the pending effect and start the damage animation
    setGame((g) => ({ ...g, tileEffect: null }));
    setDiceAnimation({
      purpose: "collapsed-damage",
      final: damageFinal,
      display: Array.from({ length: 1 }, () => Math.floor(Math.random() * 3)),
      settled: false,
      tileName: te.tileName,
      playerIndex: game.currentPlayerIndex,
      modifier: createDiceModifier({
        amount: damageReduction.amount,
        sourceNames: damageReduction.sourceNames,
        sign: "-",
        labelPrefix: "blocked by",
      }),
      firstDice: te.dice,
      firstTotal: te.total,
    });
  }

  function handlePlacePendingSpecialTile(placement) {
    setGame((g) => {
      const pendingPlacement = g.pendingSpecialPlacement;
      if (!pendingPlacement) return g;
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
        const updatedBoard = {
          ...g.board,
          [oldFloor]: (g.board[oldFloor] || []).filter((tile) => tile !== pendingPlacement.tile),
          [placement.floor]: [...(g.board[placement.floor] || []), placedTile],
        };
        const updatedPlayers = g.players.map((player, index) =>
          index === currentPlayerIndex ? { ...player, x: placement.x, y: placement.y, floor: placement.floor } : player
        );

        setCameraFloor(placement.floor);

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
            ...g,
            board: updatedBoard,
            players: updatedPlayers,
            movePath: [{ x: placement.x, y: placement.y, floor: placement.floor, cost: 0 }],
            pendingSpecialPlacement: null,
            drawnCard: idolOfferState.drawnCard,
            tileEffect: idolOfferState.tileEffect,
            turnPhase: idolOfferState.turnPhase,
            message: idolOfferState.message,
          };
        }

        return {
          ...g,
          board: updatedBoard,
          players: updatedPlayers,
          movePath: [{ x: placement.x, y: placement.y, floor: placement.floor, cost: 0 }],
          pendingSpecialPlacement: null,
          drawnCard: pendingPlacement.queuedCard || null,
          turnPhase: pendingPlacement.nextTurnPhase,
          message: pendingPlacement.nextMessage,
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
        };
      }

      return {
        ...g,
        board: {
          ...g.board,
          [placement.floor]: [...(g.board[placement.floor] || []), placedTile],
        },
        pendingSpecialPlacement: null,
        drawnCard: pendingPlacement.queuedCard || null,
        turnPhase: pendingPlacement.nextTurnPhase,
        message: pendingPlacement.nextMessage,
      };
    });
  }

  function toggleSidebarPlayer(index) {
    setExpandedSidebarPlayers((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function handleViewOwnedCard(card, ownerName, ownerIndex, ownerCollection, ownerCardIndex) {
    setViewedCard({
      ...card,
      ownerName,
      ownerIndex,
      ownerCollection,
      ownerCardIndex,
      showUseNowPicker: false,
    });
  }

  function handleUseViewedCardActiveAbilityNow() {
    if (!viewedCard || !viewedCardActiveAbilityState?.canUseNow) return;

    const specialOmenNow = resolveSpecialOmenNowAbilityState(game, viewedCard, {
      oppositeByDirection: OPPOSITE,
      getDogTradeTargets,
    });
    if (specialOmenNow.handled) {
      if (specialOmenNow.game) {
        setGame(specialOmenNow.game);
      }
      if (specialOmenNow.dogTradeState) {
        setDogTradeState(specialOmenNow.dogTradeState);
      }
      if (specialOmenNow.closeViewedCard) {
        setViewedCard(null);
      }
      return;
    }

    if (!viewedCardActiveAbilityState.requiresValueSelection) {
      const result = chooseCardActiveAbilityNowState(game, viewedCard, {
        drawnEventPrimaryAction,
        queuedTraitRollOverride: queuedTraitRollOverrideRef.current,
      });
      setGame(result.game);
      if (result.diceAnimation) {
        setDiceAnimation(result.diceAnimation);
      }
      if (result.queueTraitRollOverride !== undefined) {
        queuedTraitRollOverrideRef.current = result.queueTraitRollOverride;
        setQueuedTraitRollOverride(result.queueTraitRollOverride);
      }
      if (result.closeViewedCard) {
        setViewedCard(null);
      }
      return;
    }

    setViewedCard((card) => {
      if (!card) return card;
      return {
        ...card,
        showUseNowPicker: true,
      };
    });
  }

  function handleChooseActiveAbilityValue(total) {
    if (!viewedCard) return;

    const result = chooseCardActiveAbilityValueState(game, total, viewedCard, {
      drawnEventPrimaryAction,
      queuedTraitRollOverride: queuedTraitRollOverrideRef.current,
    });

    setGame(result.game);
    if (result.diceAnimation) {
      setDiceAnimation(result.diceAnimation);
    }

    if (result.queueTraitRollOverride !== undefined) {
      queuedTraitRollOverrideRef.current = result.queueTraitRollOverride;
      setQueuedTraitRollOverride(result.queueTraitRollOverride);
    }
    if (result.closeViewedCard) {
      setViewedCard(null);
    }
  }

  function handleCloseViewedCard() {
    setViewedCard(null);
  }

  function handleStartDogTrade(targetPlayerIndex) {
    setDogTradeState((prev) => createDogTradeSelectionState(prev, targetPlayerIndex));
  }

  function handleMoveDogToken(move) {
    if (!move) return;
    setCameraFloor(move.floor);
    setDogTradeState((prev) => applyDogTradeMoveState(prev, move));
  }

  function handleBackToDogMove() {
    setDogTradeState((prev) => createDogTradeBackToMoveState(prev));
  }

  function handleToggleDogOwnerGive(index) {
    setDogTradeState((prev) => toggleDogTradeOwnerGiveState(prev, game, index, game.turnNumber));
  }

  function handleToggleDogTargetGive(index) {
    setDogTradeState((prev) => toggleDogTradeTargetGiveState(prev, game, index, game.turnNumber));
  }

  function handleCancelDogTrade() {
    setDogTradeState(null);
  }

  function handleConfirmDogTrade() {
    const result = resolveConfirmDogTradeState(game, dogTradeState, game.turnNumber);
    setGame(result.nextGame);
    setDogTradeState(result.nextDogTradeState);
  }

  function handleSelectRabbitFootDie(dieIndex) {
    setGame((g) => chooseRabbitFootDieState(g, dieIndex));
  }

  function handleConfirmRabbitFootReroll() {
    const result = applyRabbitFootRerollState(game);
    setGame(result.game);
    if (result.diceAnimation) {
      setDiceAnimation(result.diceAnimation);
    }
  }

  function passTurnCore(g) {
    const shouldTakeExtraTurn = !!g.extraTurnAfterCurrent && !!g.players[g.currentPlayerIndex]?.isAlive;
    let next = shouldTakeExtraTurn ? g.currentPlayerIndex : (g.currentPlayerIndex + 1) % g.players.length;

    if (!shouldTakeExtraTurn) {
      // Skip dead players
      let attempts = 0;
      while (!g.players[next].isAlive && attempts < g.players.length) {
        next = (next + 1) % g.players.length;
        attempts++;
      }
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
      movePath: [{ x: nextPlayer.x, y: nextPlayer.y, floor: nextPlayer.floor, cost: 0 }],
      pendingExplore: null,
      pendingSpecialPlacement: null,
      mysticElevatorReady: false,
      mysticElevatorUsed: false,
      tileEffect: null,
      damageChoice: null,
      rabbitFootPendingReroll: null,
      skeletonKeyArmed: false,
      eventState: null,
      extraTurnAfterCurrent: false,
      turnNumber: shouldTakeExtraTurn ? g.turnNumber : g.turnNumber + (next === 0 ? 1 : 0),
      message: shouldTakeExtraTurn
        ? `${nextPlayer.name} takes an extra turn — ${speed} moves`
        : `${nextPlayer.name}'s turn — ${speed} moves`,
    };
  }

  function passTurn(g) {
    const currentPlayer = g.players[g.currentPlayerIndex];
    const endTurnItemResolution = resolveEndTurnItemPassiveState(g);

    if (endTurnItemResolution.type === "choice") {
      return {
        ...g,
        tileEffect: endTurnItemResolution.tileEffect,
      };
    }

    if (endTurnItemResolution.type === "auto-apply") {
      const nextState = passTurnCore({
        ...g,
        players: endTurnItemResolution.players,
      });

      return {
        ...nextState,
        message: `${currentPlayer.name} gains 1 ${STAT_LABELS[endTurnItemResolution.gainedStat]} with ${
          endTurnItemResolution.sourceName || "Necklace of Teeth"
        }. ${nextState.message}`,
      };
    }

    return passTurnCore(g);
  }

  const validMoves = cameraFloor === currentPlayer.floor ? getValidMoves() : [];
  const { dogMoveOptionsOnFloor, dogStairMoveOption, dogStairDestination, dogTradeTargetsOnTile } = getDogTradeUiState(
    game,
    dogTradeState,
    cameraFloor,
    getDogMoveOptions,
    getTileAtPosition
  );
  const pendingSpecialPlacementTargets = (game.pendingSpecialPlacement?.placements || []).filter(
    (placement) => placement.floor === cameraFloor
  );
  const damageChoice = game.damageChoice;
  const eventState = game.eventState;
  const isItemAbilityTileChoiceActive = isItemAbilityTileChoiceAwaiting(eventState);
  const { drawnEventPrimaryAction, eventTileChoiceOptions, selectedEventTileChoiceId, showEventResolutionModal } =
    getEventUiState(game, eventEngineDeps, queuedTraitRollOverride);
  const viewedCardActiveAbilityState = viewedCard
    ? getCardActiveAbilityState({
        game,
        viewedCard,
        drawnEventPrimaryAction,
        queuedTraitRollOverride,
      })
    : null;
  const isUnconfirmedMovePath = game.turnPhase === "move" && Array.isArray(game.movePath) && game.movePath.length > 1;
  const showMoveConfirmUseNowDisabled =
    !!viewedCard?.activeAbilityRule && viewedCard.ownerIndex === game.currentPlayerIndex && isUnconfirmedMovePath;
  const damageAllocated = damageChoice
    ? Object.values(damageChoice.allocation).reduce((sum, value) => sum + value, 0)
    : 0;
  const damageRemaining = damageChoice ? damageChoice.amount - damageAllocated : 0;
  const canConfirmDamageChoice = damageChoice
    ? damageChoice.allowPartial
      ? damageAllocated <= damageChoice.amount
      : damageRemaining === 0
    : false;
  const damagePreview = damageChoice ? getDamagePreview(currentPlayer, damageChoice) : null;

  // Check if current player is on a staircase tile
  const currentTileObj = game.board[currentPlayer.floor]?.find(
    (t) => t.x === currentPlayer.x && t.y === currentPlayer.y
  );
  const canUseMysticElevator =
    game.turnPhase === "move" &&
    !game.pendingExplore &&
    !game.pendingSpecialPlacement &&
    !game.tileEffect &&
    !isItemAbilityTileChoiceActive &&
    !game.drawnCard &&
    !diceAnimation &&
    currentTileObj?.id === "mystic-elevator" &&
    game.mysticElevatorReady &&
    !game.mysticElevatorUsed;
  const secretPassageTargets =
    game.turnPhase === "move" &&
    !game.pendingExplore &&
    !game.pendingSpecialPlacement &&
    !game.tileEffect &&
    !isItemAbilityTileChoiceActive
      ? Object.entries(game.board)
          .flatMap(([floor, tiles]) =>
            tiles
              .filter((tile) => (tile.tokens || []).some((token) => token.type === "secret-passage"))
              .map((tile) => ({
                floor,
                x: tile.x,
                y: tile.y,
                name: tile.name,
              }))
          )
          .filter(
            (tile) => !(tile.floor === currentPlayer.floor && tile.x === currentPlayer.x && tile.y === currentPlayer.y)
          )
      : [];
  const isOnSecretPassageTile = (currentTileObj?.tokens || []).some((token) => token.type === "secret-passage");
  const canUseSecretPassage = isOnSecretPassageTile && secretPassageTargets.length > 0;
  const endTurnPreviewPlayerName = (() => {
    if (game.extraTurnAfterCurrent && currentPlayer.isAlive) {
      return `${currentPlayer.name} (extra turn)`;
    }

    let next = (game.currentPlayerIndex + 1) % game.players.length;
    let attempts = 0;
    while (!game.players[next].isAlive && attempts < game.players.length) {
      next = (next + 1) % game.players.length;
      attempts++;
    }

    return game.players[next]?.name || currentPlayer.name;
  })();
  let stairTarget = null;
  let stairIsBacktrack = false;
  if (game.turnPhase === "move" && !game.pendingExplore && !isItemAbilityTileChoiceActive) {
    const connectedMove = getConnectedMoveTarget(game.board, currentTileObj, game.movePath);
    if (connectedMove) {
      stairIsBacktrack = connectedMove.isBacktrack;
      const moveCost = getLeaveMoveCost(currentTileObj);
      if (currentPlayer.movesLeft >= moveCost || stairIsBacktrack) {
        stairTarget = connectedMove.targetTile;
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
  pendingSpecialPlacementTargets.forEach((placement) => {
    allXs.push(placement.x);
    allYs.push(placement.y);
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

      {messageBubble && <div className="game-message-bubble">{messageBubble}</div>}

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
                >
                  {tile.description && <div className="tile-tooltip">{tile.description}</div>}
                  <div className="tile-name">{tile.name}</div>
                  {tile.cardType && <div className={`tile-type tile-type-${tile.cardType}`}>{tile.cardType}</div>}
                  {tile.obstacle && <div className="tile-obstacle">Obstacle</div>}
                  {tile.tokens?.length > 0 && (
                    <div className="tile-token-list">
                      {tile.tokens.map((token, tokenIndex) => (
                        <div
                          key={`${tile.id}-token-${token.type}-${tokenIndex}`}
                          className={`tile-token tile-token-${token.type}`}
                        >
                          {token.type.replace(/-/g, " ")}
                        </div>
                      ))}
                    </div>
                  )}
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
                  {dogTradeState &&
                    dogTradeState.floor === cameraFloor &&
                    dogTradeState.x === tile.x &&
                    dogTradeState.y === tile.y && (
                      <div className="player-token" title="Dog">
                        🐕
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
            {!dogTradeState &&
              !game.pendingExplore &&
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

            {game.pendingSpecialPlacement &&
              pendingSpecialPlacementTargets.map((placement) => {
                const left = (placement.x - minX) * (TILE_SIZE + GAP);
                const top = (placement.y - minY) * (TILE_SIZE + GAP);
                return (
                  <button
                    key={`special-placement-${placement.floor}-${placement.x}-${placement.y}`}
                    className="explore-target"
                    style={{ left, top, width: TILE_SIZE, height: TILE_SIZE }}
                    onClick={() => handlePlacePendingSpecialTile(placement)}
                  >
                    <span className="explore-icon">⇵</span>
                  </button>
                );
              })}

            <EventTileChoiceTargets
              eventTileChoiceOptions={eventTileChoiceOptions}
              selectedEventTileChoiceId={selectedEventTileChoiceId}
              cameraFloor={cameraFloor}
              minX={minX}
              minY={minY}
              onSelectOption={handleEventTileChoice}
            />

            {/* Clickable overlay on existing tiles for movement/backtrack */}
            {!dogTradeState &&
              validMoves
                .filter((m) => m.type === "move" || m.type === "backtrack" || m.type === "wall-move")
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

            {dogTradeState?.phase === "move" &&
              dogMoveOptionsOnFloor.map((move) => {
                const left = (move.x - minX) * (TILE_SIZE + GAP);
                const top = (move.y - minY) * (TILE_SIZE + GAP);
                return (
                  <button
                    key={`dog-move-${move.floor}-${move.x}-${move.y}`}
                    className="move-overlay"
                    style={{ left, top, width: TILE_SIZE, height: TILE_SIZE }}
                    onClick={() => handleMoveDogToken(move)}
                    title={`Dog move cost: ${move.cost}`}
                  />
                );
              })}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="game-actions">
        {eventState?.awaiting?.type === "tile-choice" && (
          <button
            className="btn btn-confirm"
            onClick={handleConfirmEventTileChoice}
            disabled={!selectedEventTileChoiceId}
          >
            Confirm Placement
          </button>
        )}
        {!dogTradeState && game.turnPhase === "move" && game.movePath.length > 1 && (
          <button className="btn btn-confirm" onClick={handleConfirmMove}>
            Move Here
          </button>
        )}
        {!dogTradeState && stairTarget && (
          <button className="btn btn-stairs" onClick={handleChangeFloor}>
            {stairIsBacktrack ? `Go back to ${stairTarget.name}` : `Move to ${stairTarget.name}`}
          </button>
        )}
        {!dogTradeState && canUseMysticElevator && (
          <button className="btn btn-stairs" onClick={handleRollMysticElevator}>
            Use Elevator
          </button>
        )}
        {!dogTradeState &&
          canUseSecretPassage &&
          secretPassageTargets.map((target) => (
            <button
              key={`secret-passage-${target.floor}-${target.x}-${target.y}`}
              className="btn btn-stairs"
              onClick={() => handleUseSecretPassage(target)}
              disabled={currentPlayer.movesLeft < 1}
            >
              {`Move to ${target.name} (${target.floor})`}
            </button>
          ))}
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
        {(game.turnPhase === "endTurn" || game.turnPhase === "move") &&
          !game.pendingExplore &&
          !dogTradeState &&
          !isItemAbilityTileChoiceAwaiting(eventState) && (
            <button className="btn btn-primary" onClick={handleEndTurn}>
              End Turn — Pass to {endTurnPreviewPlayerName}
            </button>
          )}

        {dogTradeState?.phase === "move" && (
          <>
            <button className="btn btn-secondary" disabled>
              Dog moves left: {dogTradeState.movesLeft}
            </button>
            {dogStairMoveOption && (
              <button className="btn btn-stairs" onClick={() => handleMoveDogToken(dogStairMoveOption)}>
                Move Dog to {dogStairDestination?.name || "connected tile"} ({dogStairMoveOption.floor})
              </button>
            )}
            {dogTradeTargetsOnTile.map(({ player, playerIndex }) => (
              <button
                key={`dog-trade-start-${playerIndex}`}
                className="btn btn-primary"
                onClick={() => handleStartDogTrade(playerIndex)}
              >
                Trade with {player.name}
              </button>
            ))}
            <button className="btn btn-secondary" onClick={handleCancelDogTrade}>
              Cancel Dog Ability
            </button>
          </>
        )}
      </div>

      {/* Player sidebar */}
      <div className="player-sidebar">
        {game.players.map((p, i) => {
          const isCurrent = i === game.currentPlayerIndex;
          const isExpanded = isCurrent || expandedSidebarPlayers.has(i);
          return (
            <div
              key={i}
              className={`sidebar-player ${isCurrent ? "sidebar-current" : ""} ${isExpanded ? "sidebar-expanded" : "sidebar-collapsed"} ${!p.isAlive ? "sidebar-dead" : ""}`}
              style={{ borderColor: isCurrent ? p.color : "transparent" }}
            >
              <button className="sidebar-header" onClick={() => toggleSidebarPlayer(i)} type="button">
                <div className="sidebar-name" style={{ color: p.color }}>
                  {p.name} {isCurrent && "◄"}
                </div>
                <span className={`sidebar-toggle ${isExpanded ? "sidebar-toggle-expanded" : ""}`} aria-hidden="true">
                  ▾
                </span>
              </button>
              <div className="sidebar-char">{p.character.name}</div>
              {!isExpanded && (
                <div className="sidebar-stats-summary">
                  {PLAYER_STAT_ORDER.map((stat) => (
                    <span key={`${p.name}-${stat}-summary`} className="sidebar-stats-summary-item">
                      <span>{STAT_ICONS[stat]}</span>
                      <span>{formatStatTrackValue(p.character[stat][p.statIndex[stat]])}</span>
                    </span>
                  ))}
                </div>
              )}
              <div className={`sidebar-stats ${isExpanded ? "sidebar-stats-expanded" : "sidebar-stats-collapsed"}`}>
                {PLAYER_STAT_ORDER.map((stat) => (
                  <div key={`${p.name}-${stat}`} className="sidebar-stat-row">
                    <div className="sidebar-stat-label">
                      <span>{STAT_ICONS[stat]}</span>
                      <span>{STAT_LABELS[stat]}</span>
                    </div>
                    <div className="sidebar-stat-track" aria-label={`${p.name} ${STAT_LABELS[stat]} track`}>
                      {p.character[stat].map((value, index) => (
                        <div
                          key={`${p.name}-${stat}-${index}`}
                          className={[
                            "sidebar-stat-cell",
                            index === p.statIndex[stat] ? "sidebar-stat-cell-current" : "",
                            index === p.character.startIndex[stat] ? "sidebar-stat-cell-start" : "",
                            index === CRITICAL_STAT_INDEX ? "sidebar-stat-cell-critical" : "",
                            value === 0 ? "sidebar-stat-cell-zero" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {formatStatTrackValue(value)}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="sidebar-card-groups">
                  <div className="sidebar-card-group">
                    <div className="sidebar-card-group-header">
                      <span>Items</span>
                      <span>{p.inventory.length}</span>
                    </div>
                    {p.inventory.length > 0 ? (
                      <div className="sidebar-card-list">
                        {p.inventory.map((card, cardIndex) => (
                          <button
                            key={`${p.name}-item-${card.id}-${cardIndex}`}
                            type="button"
                            className="sidebar-card-chip sidebar-card-chip-item"
                            onClick={() =>
                              handleViewOwnedCard(
                                {
                                  ...card,
                                  ownerCollection: "inventory",
                                  ownerCardIndex: cardIndex,
                                },
                                p.name,
                                i,
                                "inventory",
                                cardIndex
                              )
                            }
                          >
                            {card.name}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="sidebar-card-empty">No items</div>
                    )}
                  </div>
                  <div className="sidebar-card-group">
                    <div className="sidebar-card-group-header">
                      <span>Omens</span>
                      <span>{p.omens.length}</span>
                    </div>
                    {p.omens.length > 0 ? (
                      <div className="sidebar-card-list">
                        {p.omens.map((card, cardIndex) => (
                          <button
                            key={`${p.name}-omen-${card.id}-${cardIndex}`}
                            type="button"
                            className="sidebar-card-chip sidebar-card-chip-omen"
                            onClick={() =>
                              handleViewOwnedCard(
                                {
                                  ...card,
                                  ownerCollection: "omens",
                                  ownerCardIndex: cardIndex,
                                },
                                p.name,
                                i,
                                "omens",
                                cardIndex
                              )
                            }
                          >
                            {card.name}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="sidebar-card-empty">No omens</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <button className="btn btn-danger sidebar-quit" onClick={onQuit}>
          Quit Game
        </button>
      </div>

      <DrawnCardModal
        drawnCard={game.drawnCard}
        drawnEventPrimaryAction={drawnEventPrimaryAction}
        onDismissCard={handleDismissCard}
      />

      {viewedCard && (
        <div className="sidebar-card-viewer" role="dialog" aria-label={`${viewedCard.type} details`}>
          <div className={`card-modal card-${viewedCard.type} card-viewer`}>
            <div className="card-type-label">{viewedCard.type.toUpperCase()}</div>
            <h2 className="card-name">{viewedCard.name}</h2>
            <div className="card-owner-label">Held by {viewedCard.ownerName}</div>
            <CardAbilityContent card={viewedCard} />
            {(viewedCardActiveAbilityState?.canUseNow || showMoveConfirmUseNowDisabled) && (
              <span title={showMoveConfirmUseNowDisabled ? "Confirm your move to use" : ""}>
                <button
                  className="btn btn-primary"
                  onClick={handleUseViewedCardActiveAbilityNow}
                  disabled={!viewedCardActiveAbilityState?.canUseNow}
                >
                  Use now
                </button>
              </span>
            )}
            {viewedCard.showUseNowPicker && viewedCardActiveAbilityState?.requiresValueSelection && (
              <div className="event-option-list" style={{ marginTop: "0.75rem" }}>
                {viewedCardActiveAbilityState.valueOptions.map((option) => {
                  const optionValue = typeof option === "object" && option !== null ? option.value : option;
                  const optionLabel = typeof option === "object" && option !== null ? option.label : option;
                  return (
                    <button
                      key={`active-ability-value-${String(optionValue)}`}
                      className="btn btn-secondary"
                      onClick={() => handleChooseActiveAbilityValue(optionValue)}
                    >
                      {optionLabel}
                    </button>
                  );
                })}
              </div>
            )}
            {viewedCard.flavor && <p className="card-flavor">{viewedCard.flavor}</p>}
            <button className="btn btn-primary" onClick={handleCloseViewedCard}>
              Close
            </button>
          </div>
        </div>
      )}

      {dogTradeState?.phase === "trade" && (
        <div className="sidebar-card-viewer" role="dialog" aria-label="Dog trade">
          <div className="card-modal card-viewer">
            <div className="card-type-label">OMEN</div>
            <h2 className="card-name">Dog Trade</h2>
            {(() => {
              const owner = game.players[dogTradeState.ownerIndex];
              const selectedTarget = game.players[dogTradeState.targetPlayerIndex];
              const selectedTargetIndex = dogTradeState.targetPlayerIndex;

              return (
                <>
                  <p>
                    Dog is on {dogTradeState.floor}. Pick items Dog carries from {owner?.name} and items the target
                    willingly sends back.
                  </p>

                  <div style={{ marginBottom: "0.75rem" }}>
                    Trading with <strong>{selectedTarget?.name || "Unknown"}</strong>
                  </div>

                  <h3 style={{ marginTop: 0 }}>Send From {owner?.name}</h3>
                  <div className="event-option-list" style={{ marginBottom: "0.75rem" }}>
                    {(owner?.inventory || []).length === 0 && (
                      <div className="sidebar-card-empty">No items to send</div>
                    )}
                    {(owner?.inventory || []).map((card, index) => {
                      const selected = dogTradeState.ownerGiveIndexes.includes(index);
                      const locked = isItemTradeLockedThisTurn(card, game.turnNumber);
                      return (
                        <button
                          key={`dog-owner-give-${index}`}
                          className={selected ? "btn btn-primary" : "btn btn-secondary"}
                          onClick={() => handleToggleDogOwnerGive(index)}
                          disabled={locked}
                        >
                          {selected ? "[Send] " : ""}
                          {card.name}
                          {locked ? " (used this turn)" : ""}
                        </button>
                      );
                    })}
                  </div>

                  <h3 style={{ marginTop: 0 }}>Receive From {selectedTarget?.name || "Target"}</h3>
                  <div className="event-option-list" style={{ marginBottom: "0.75rem" }}>
                    {(selectedTarget?.inventory || []).length === 0 && (
                      <div className="sidebar-card-empty">No items offered</div>
                    )}
                    {(selectedTarget?.inventory || []).map((card, index) => {
                      const selected = dogTradeState.targetGiveIndexes.includes(index);
                      const locked = isItemTradeLockedThisTurn(card, game.turnNumber);
                      return (
                        <button
                          key={`dog-target-give-${selectedTargetIndex}-${index}`}
                          className={selected ? "btn btn-primary" : "btn btn-secondary"}
                          onClick={() => handleToggleDogTargetGive(index)}
                          disabled={locked}
                        >
                          {selected ? "[Offer] " : ""}
                          {card.name}
                          {locked ? " (used this turn)" : ""}
                        </button>
                      );
                    })}
                  </div>
                </>
              );
            })()}

            <button className="btn btn-primary" onClick={handleConfirmDogTrade}>
              Confirm Dog Trade
            </button>
            <button className="btn btn-secondary" onClick={handleBackToDogMove}>
              Back to Dog Movement
            </button>
            <button className="btn btn-secondary" onClick={handleCancelDogTrade}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {showEventResolutionModal && (
        <EventResolutionModal
          eventState={eventState}
          currentPlayer={currentPlayer}
          diceAnimation={diceAnimation}
          rabbitFootPendingReroll={game.rabbitFootPendingReroll}
          statLabels={STAT_LABELS}
          onAdjustEventRollTotal={handleAdjustEventRollTotal}
          onEventAwaitingChoice={handleEventAwaitingChoice}
          onSelectRabbitFootDie={handleSelectRabbitFootDie}
          onConfirmRabbitFootReroll={handleConfirmRabbitFootReroll}
          onContinueEvent={handleContinueEvent}
          renderDiceRow={(props) => <DiceRow {...props} />}
        />
      )}

      {/* Dice roll overlay — animating */}
      {diceAnimation &&
        !diceAnimation.settled &&
        diceAnimation.purpose !== "event-damage-sequence" &&
        diceAnimation.purpose !== "event-trait-sequence-roll" && (
          <div className="card-overlay card-overlay-animation">
            <div
              className={`card-modal ${diceAnimation.purpose === "haunt" ? "card-haunt-rolling" : "card-tile-rolling"}`}
            >
              <div className="card-type-label">
                {diceAnimation.purpose === "haunt"
                  ? "HAUNT ROLL"
                  : diceAnimation.purpose === "event-roll"
                    ? "EVENT ROLL"
                    : diceAnimation.purpose === "event-damage-roll"
                      ? "EVENT DAMAGE ROLL"
                      : diceAnimation.purpose === "skeleton-key"
                        ? "SKELETON KEY"
                        : diceAnimation.purpose === "mystic-elevator"
                          ? "MYSTIC ELEVATOR"
                          : diceAnimation.purpose === "collapsed"
                            ? "COLLAPSED ROOM"
                            : diceAnimation.purpose === "collapsed-damage"
                              ? "COLLAPSED ROOM — DAMAGE"
                              : "FURNACE ROOM"}
              </div>
              <DiceRow dice={diceAnimation.display} modifier={diceAnimation.modifier} rolling />
              <h2 className="card-name">Rolling...</h2>
            </div>
          </div>
        )}

      {/* Haunt roll overlay — settled */}
      {game.hauntRoll && diceAnimation?.settled && diceAnimation.purpose === "haunt" && (
        <div className="card-overlay">
          <div className={`card-modal ${game.hauntRoll.hauntTriggered ? "card-haunt-triggered" : "card-haunt-safe"}`}>
            <div className="card-type-label">HAUNT ROLL</div>
            <DiceRow dice={game.hauntRoll.dice} />
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

      {/* Tile effect overlay */}
      {game.tileEffect && (
        <div className="card-overlay">
          <div
            className={`card-modal card-tile-effect ${game.tileEffect.type === "laundry-chute" ? "card-tile-neutral" : game.tileEffect.type === "collapsed-pending" ? "card-tile-danger" : game.tileEffect.damage > 0 || game.tileEffect.collapsed ? "card-tile-danger" : "card-tile-safe"}`}
          >
            <div className="card-type-label">{game.tileEffect.tileName}</div>
            {game.tileEffect.dice &&
              !(
                isSkeletonKeyResultEffect(game.tileEffect) &&
                game.rabbitFootPendingReroll?.sourceType === "skeleton-key-roll"
              ) && <DiceRow dice={game.tileEffect.dice} modifier={game.tileEffect.diceModifier} />}
            {game.tileEffect.total !== undefined && <div className="dice-total">Total: {game.tileEffect.total}</div>}
            {game.tileEffect.collapsed && game.tileEffect.damageDice.length > 0 && (
              <>
                <div className="dice-total" style={{ marginTop: "0.5rem" }}>
                  Damage roll:
                </div>
                <DiceRow dice={game.tileEffect.damageDice} modifier={game.tileEffect.damageDiceModifier} />
              </>
            )}
            {isSkeletonKeyResultEffect(game.tileEffect) &&
              game.rabbitFootPendingReroll?.sourceType === "skeleton-key-roll" && (
                <div className="dice-row">
                  <div className="dice-container">
                    {(game.tileEffect.dice || []).map((die, index) => {
                      const selected = game.rabbitFootPendingReroll?.selectedDieIndex === index;
                      return (
                        <button
                          key={`skeleton-key-rabbit-foot-die-${index}`}
                          type="button"
                          className={selected ? "die die-selectable die-selected" : "die die-selectable"}
                          onClick={() => handleSelectRabbitFootDie(index)}
                        >
                          {die}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            <p className="card-description">{game.tileEffect.message}</p>
            {isSkeletonKeyResultEffect(game.tileEffect) &&
            game.rabbitFootPendingReroll?.sourceType === "skeleton-key-roll" ? (
              <button
                className="btn btn-primary"
                onClick={handleConfirmRabbitFootReroll}
                disabled={!Number.isInteger(game.rabbitFootPendingReroll?.selectedDieIndex)}
              >
                Reroll
              </button>
            ) : game.tileEffect.type === "necklace-of-teeth-choice" ? (
              <>
                <div className="event-option-list" style={{ marginTop: "0.75rem" }}>
                  {(game.tileEffect.statOptions || []).map((stat) => (
                    <button
                      key={`necklace-stat-${stat}`}
                      className="btn btn-secondary"
                      onClick={() => handleChooseNecklaceOfTeethStat(stat)}
                    >
                      Gain 1 {STAT_LABELS[stat]}
                    </button>
                  ))}
                </div>
                <button className="btn btn-primary" onClick={handleSkipNecklaceOfTeethGain}>
                  Skip
                </button>
              </>
            ) : game.tileEffect.type === "idol-event-choice" ? (
              <>
                <button className="btn btn-secondary" onClick={handleDrawIdolEventCard}>
                  Draw Event card
                </button>
                <button className="btn btn-primary" onClick={handleSkipIdolEventCard}>
                  Skip Event card
                </button>
              </>
            ) : game.tileEffect.type === "collapsed-pending" ? (
              <button className="btn btn-primary" onClick={handleStartCollapsedDamage}>
                Roll for damage
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handleDismissTileEffect}>
                {game.tileEffect.type === "mystic-elevator-result" && game.tileEffect.pendingSpecialPlacement
                  ? "Choose doorway"
                  : "Continue"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Damage choice overlay */}
      {damageChoice && (
        <div className="card-overlay">
          <div className="card-modal card-damage-choice">
            <div className="card-type-label">
              {damageChoice.adjustmentMode === "increase"
                ? "STAT GAIN"
                : `${damageChoice.damageType.toUpperCase()} DAMAGE`}
            </div>
            <h2 className="card-name">
              {damageChoice.adjustmentMode === "increase"
                ? "Choose where the gain goes"
                : "Choose where the damage goes"}
            </h2>
            <p className="card-description">
              {damageChoice.adjustmentMode === "increase"
                ? `Assign ${damageChoice.amount} point${damageChoice.amount === 1 ? "" : "s"} of gain to ${damageChoice.playerName}.`
                : damageChoice.allowPartial
                  ? `Assign up to ${damageChoice.amount} point${damageChoice.amount === 1 ? "" : "s"} of ${damageChoice.damageType} damage to ${damageChoice.playerName}.`
                  : `Assign ${damageChoice.amount} point${damageChoice.amount === 1 ? "" : "s"} of ${damageChoice.damageType} damage to ${damageChoice.playerName}.`}
            </p>
            {damageChoice.adjustmentMode !== "increase" && damageChoice.canConvertToGeneral && (
              <div className="damage-conversion-panel">
                <div className="damage-conversion-copy">
                  {damageChoice.damageType === "general"
                    ? `Taking this as General damage via ${formatSourceNames(damageChoice.conversionSourceNames)}.`
                    : `${formatSourceNames(damageChoice.conversionSourceNames)} can convert this to General damage.`}
                </div>
                <button className="btn btn-secondary damage-conversion-button" onClick={handleToggleDamageConversion}>
                  {damageChoice.damageType === "general"
                    ? `Use ${damageChoice.originalDamageType} damage`
                    : "Take as General Damage"}
                </button>
              </div>
            )}
            {damageChoice.adjustmentMode !== "increase" && damageChoice.postDamageEffects.length > 0 && (
              <p className="damage-choice-hint">
                After taking damage: {describePostDamageEffects(damageChoice.postDamageEffects)}.
              </p>
            )}
            <p className="damage-choice-hint">
              Use {damageChoice.adjustmentMode === "increase" ? "+" : "-"} to assign this change to a trait.
            </p>
            <div className="damage-choice-status">
              <span>Assigned: {damageAllocated}</span>
              <span>Remaining: {damageRemaining}</span>
            </div>
            <div className="damage-choice-list">
              {damageChoice.allowedStats.map((stat) => {
                const assigned = damageChoice.allocation[stat] || 0;
                const currentIndex = currentPlayer.statIndex[stat];
                const previewIndex = damagePreview[stat];
                const maxIncrease = currentPlayer.character[stat].length - 1 - currentIndex;
                const canAllocate =
                  damageChoice.adjustmentMode === "increase"
                    ? damageRemaining > 0 && assigned < maxIncrease
                    : damageRemaining > 0 && assigned < currentIndex;
                const canUndo = assigned > 0;
                const minusDelta = damageChoice.adjustmentMode === "increase" ? -1 : 1;
                const plusDelta = damageChoice.adjustmentMode === "increase" ? 1 : -1;
                const minusEnabled = minusDelta > 0 ? canAllocate : canUndo;
                const plusEnabled = plusDelta > 0 ? canAllocate : canUndo;

                return (
                  <div key={stat} className="damage-choice-row">
                    <div className="damage-choice-stat">
                      <div className="damage-choice-stat-header">
                        <div className="damage-choice-stat-name">{STAT_LABELS[stat]}</div>
                      </div>
                      <div className="stat-track-numbers" aria-label={`${STAT_LABELS[stat]} track`}>
                        {currentPlayer.character[stat].map((value, index) => (
                          <div
                            key={`${stat}-${index}`}
                            className={[
                              getStatTrackCellClass(index, currentIndex, previewIndex, damageChoice.adjustmentMode),
                              index === CRITICAL_STAT_INDEX ? "stat-track-cell-critical" : "",
                              value === 0 ? "stat-track-cell-zero" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            {formatStatTrackValue(value)}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="damage-choice-controls">
                      <button
                        className="btn btn-secondary damage-choice-button"
                        onClick={() => handleAdjustDamageAllocation(stat, minusDelta)}
                        disabled={!minusEnabled}
                        aria-label={`- ${STAT_LABELS[stat]}`}
                      >
                        -
                      </button>
                      <div className="damage-choice-count">{assigned}</div>
                      <button
                        className="btn btn-primary damage-choice-button"
                        onClick={() => handleAdjustDamageAllocation(stat, plusDelta)}
                        disabled={!plusEnabled}
                        aria-label={`+ ${STAT_LABELS[stat]}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <button className="btn btn-primary" onClick={handleConfirmDamageChoice} disabled={!canConfirmDamageChoice}>
              {damageChoice.adjustmentMode === "increase" ? "Apply gain" : "Apply damage"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
