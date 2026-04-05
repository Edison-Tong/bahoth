import { useState, useRef, useEffect, useMemo } from "react";
import {
  describeEventEffects,
  getEventRollButtonLabel,
  applyTileEffectConsequences,
  createDiceModifier,
  createDamageChoice,
  formatSourceNames,
  getEventUiState,
  getDamageReduction,
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
  getMatchingOutcome,
  useDrawnCardHandlers,
  useEventActionHandlers,
  useEventRuntimeEffects,
  resolveChooseViewedCardActiveAbilityValueState,
  resolveUseViewedCardActiveAbilityNowState,
} from "./events/eventDomain";
import EventResolutionModal, { DrawnCardModal } from "./components/EventResolutionModal";
import BoardCanvas from "./components/gameboard/BoardCanvas";
import DamageChoiceOverlay from "./components/gameboard/overlays/DamageChoiceOverlay";
import CombatOverlay from "./components/gameboard/overlays/CombatOverlay";
import DiceRollOverlay from "./components/gameboard/overlays/DiceRollOverlay";
import HauntRollOverlay from "./components/gameboard/overlays/HauntRollOverlay";
import TileEffectOverlay from "./components/gameboard/overlays/TileEffectOverlay";
import HauntSetupOverlay from "./components/gameboard/overlays/HauntSetupOverlay";
import HauntRulesViewerOverlay from "./components/gameboard/overlays/HauntRulesViewerOverlay";
import HauntActionRollOverlay from "./components/gameboard/overlays/HauntActionRollOverlay";
import DebugModePanel from "./components/gameboard/DebugModePanel";
import GameBoardActions from "./components/gameboard/GameBoardActions";
import PlayerSidebar from "./components/gameboard/PlayerSidebar";
import ViewedCardViewer from "./components/gameboard/ViewedCardViewer";
import TradeViewer from "./components/gameboard/TradeViewer";
import {
  applyDrawIdolEventCardState,
  getIdolChoiceStateForQueuedEvent,
  applySkipIdolEventCardState,
  resolveSpecialOmenNowAbilityState,
  getDogTradeUiState,
} from "./omens/omenDomain";
import {
  isEndTurnItemChoiceEffect,
  resolveEndTurnItemPassiveChoiceState,
  resolveEndTurnItemPassiveState,
  canUseArmedSkeletonKeyMovement,
  createSkeletonKeyResultTileEffect,
  isSkeletonKeyResultEffect,
  resolveSkeletonKeyResultAfterDismiss,
} from "./items/itemDomain";
import {
  applyPlacedTileDiscoverEffects,
  getEndTurnTileAbilityState,
  resolveTileDiceAnimationState,
  resolveDismissTileEffectState,
  getCurrentPlayerTile,
  getCanUseMysticElevator,
  getCanUseSecretPassage,
  getSecretPassageTargets,
  getStairTargetState,
  getRollMysticElevatorState,
  resolveMysticElevatorResultState,
  getConnectedMoveTarget,
  resolveSecretPassageMoveState,
} from "./tiles/tileDomain";
import {
  confirmMoveState,
  getValidMovesState,
  placePendingSpecialTileState,
  resolveKeyboardMoveAction,
  getPlacementOptionsState,
  resolveBacktrackActionState,
  resolveBoardMoveActionState,
  resolveChangeFloorActionState,
  resolveExploreActionState,
  resolveMovePlayerActionState,
  getLeaveMoveCostState,
  hasUnconfirmedMovePathState,
} from "./movement/movementDomain";
import {
  adjustDamageAllocationChoiceState,
  applyDamageAllocationState,
  applyPostDamagePassiveEffectsState,
  applyStatChangeState,
  getDamagePreviewState,
  getStatTrackCellClassState,
  toggleDamageConversionChoiceState,
  getDamageChoiceSummary,
  getEndTurnPreviewPlayerName,
  getPlayersOnFloor,
  resolveConfirmDamageChoiceActionState,
  createLocalPlayerTradeState,
  getPlayerTradeTargetsOnTile,
  resolveBackToTradeMoveState,
  resolveConfirmTradeActionState,
  resolveMoveTradeTokenState,
  resolveStartTradeSelectionState,
  resolveToggleTradeOwnerGiveState,
  resolveToggleTradeOwnerGiveOmenState,
  resolveToggleTradeTargetGiveState,
  resolveToggleTradeTargetGiveOmenState,
  resolveEndTurnActionState,
  resolvePassTurnActionState,
  resolvePassTurnCoreActionState,
} from "./players/playerDomain";
import {
  CRITICAL_STAT_INDEX,
  DAMAGE_STATS,
  DIR,
  GAP,
  initGameState,
  isStickyMessageBubble,
  OPPOSITE,
  PLAYER_STAT_ORDER,
  shouldShowMessageBubble,
  STAT_ICONS,
  STAT_LABELS,
  TILE_SIZE,
  createDrawnEventCard,
  createDrawnItemCard,
  createDrawnOmenCard,
} from "./game/gameState";
import {
  advanceHauntRulesViewState,
  beginHauntAfterRulesViewState,
  GAME_PHASES,
  getHauntActionButtonsState,
  getHauntActionRollPreviewState,
  getAllHauntDefinitions,
  getHauntCombatBonus,
  getHauntCombatActorProxyState,
  getHauntDefinitionById,
  resolveHauntActionRollContinueState,
  resolveHauntAfterDamageState,
  resolveHauntActionState,
  resolveHauntTurnStartState,
  startSelectedHauntState,
} from "./haunts/hauntDomain";
import { TILES, STARTING_TILES } from "./tiles";
import { getDamageConversionOptions, getPassiveEffects } from "./items/passiveItemEffectAbility";
import { advanceDynamiteRollState } from "./items/dynamiteAbility";
import {
  SUPPORTED_COMBAT_ITEM_ACTIONS,
  applyCombatItemSource,
  getCombatItemTargets,
  getCrossboxTargets,
  getGunTargets,
  getCombatTargetsOnCurrentTile,
  getPlayerSpeedDiceCount,
} from "./items/combatItemAbility";
import "./GameBoard.css";

function formatStatTrackValue(value) {
  return value === 0 ? "☠" : value;
}

const ALL_DIRECTIONS = ["N", "E", "S", "W"];
const DEBUG_TILE_CATALOG = [...STARTING_TILES, ...TILES];
const DEBUG_HAUNT_CATALOG = getAllHauntDefinitions();

function rotateDoors(doors, rotation) {
  return doors.map((door) => {
    const doorIndex = ALL_DIRECTIONS.indexOf(door);
    return ALL_DIRECTIONS[(doorIndex + rotation) % 4];
  });
}

function getValidRotationIndexesForPlacement(tile, placement) {
  if (!tile || !placement) return [];

  const validRotationSets = new Set((placement.validRotations || []).map((rotation) => rotation.join("")));
  const rotationIndexes = [];

  for (let rotation = 0; rotation < 4; rotation += 1) {
    const rotatedDoors = rotateDoors(tile.doors, rotation).join("");
    if (validRotationSets.has(rotatedDoors)) {
      rotationIndexes.push(rotation);
    }
  }

  return rotationIndexes;
}

function getCardPoolOptions(deck) {
  const countsById = new Map();
  for (const card of deck) {
    const existing = countsById.get(card.id);
    if (existing) {
      existing.count += 1;
      continue;
    }
    countsById.set(card.id, {
      id: card.id,
      name: card.name,
      count: 1,
    });
  }
  return Array.from(countsById.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function getPlayerMightDiceCount(player) {
  return player.character.might[player.statIndex.might] || 0;
}

function getPlayerSanityDiceCount(player) {
  return player.character.sanity[player.statIndex.sanity] || 0;
}

function getDefenseRollDiceBonus(player) {
  const effects = getPassiveEffects(player).filter((effect) => effect.type === "defense-roll-dice-bonus");
  return {
    amount: effects.reduce((sum, effect) => sum + (effect.amount || 0), 0),
    sourceNames: effects.map((effect) => effect.sourceName),
  };
}

function getCombatItemOptionsForPlayer(player, usedItemKeys) {
  const options = [];

  (player.inventory || []).forEach((card, cardIndex) => {
    if (card.isWeapon) return;

    const action = card.activeAbilityRule?.action;
    if (card.activeAbilityRule?.trigger !== "attack") return;
    if (!SUPPORTED_COMBAT_ITEM_ACTIONS.has(action)) return;

    const key = `inventory:${cardIndex}:${card.id}`;
    const alreadyUsed = usedItemKeys.includes(key);
    const requiresSpeed = action === "optional-speed-loss-for-attack-dice";
    const canPaySpeed = (player.statIndex.speed || 0) > 0;

    options.push({
      key,
      name: card.name,
      action,
      cardIndex,
      collection: "inventory",
      canUse: !alreadyUsed && (!requiresSpeed || canPaySpeed),
      disabledReason: alreadyUsed
        ? "Already used this attack"
        : requiresSpeed && !canPaySpeed
          ? "Not enough Speed"
          : "",
      rule: card.activeAbilityRule,
    });
  });

  return options;
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

export default function GameBoard({ players, onQuit }) {
  const [game, setGame] = useState(() => initGameState(players));
  const [cameraFloor, setCameraFloor] = useState("ground");
  const [diceAnimation, setDiceAnimation] = useState(null);
  const [expandedSidebarPlayers, setExpandedSidebarPlayers] = useState(() => new Set());
  const [viewedCard, setViewedCard] = useState(null);
  const [tradeState, setTradeState] = useState(null);
  const [queuedTraitRollOverride, setQueuedTraitRollOverride] = useState(null);
  const [messageBubble, setMessageBubble] = useState("");
  const [debugModeEnabled, setDebugModeEnabled] = useState(false);
  const [debugSelectedTileId, setDebugSelectedTileId] = useState(DEBUG_TILE_CATALOG[0]?.id || "");
  const [debugTileRotation, setDebugTileRotation] = useState(0);
  const [debugPlacementModeActive, setDebugPlacementModeActive] = useState(false);
  const [debugSelectedPlacementKey, setDebugSelectedPlacementKey] = useState("");
  const [debugGrantType, setDebugGrantType] = useState("item");
  const [debugGrantPlayerIndex, setDebugGrantPlayerIndex] = useState(0);
  const [debugGrantCardId, setDebugGrantCardId] = useState("");
  const [debugEventPlayerIndex, setDebugEventPlayerIndex] = useState(0);
  const [debugEventCardId, setDebugEventCardId] = useState("");
  const [debugRemoveType, setDebugRemoveType] = useState("item");
  const [debugRemovePlayerIndex, setDebugRemovePlayerIndex] = useState(0);
  const [debugRemoveCardKey, setDebugRemoveCardKey] = useState("");
  const [debugSelectedHauntId, setDebugSelectedHauntId] = useState(DEBUG_HAUNT_CATALOG[0]?.id || "");
  const [debugHauntTraitorPlayerIndex, setDebugHauntTraitorPlayerIndex] = useState(0);
  const [hauntRulesViewerRole, setHauntRulesViewerRole] = useState(null);
  const queuedTraitRollOverrideRef = useRef(null);
  const messageBubbleTimeoutRef = useRef(null);
  const boardRef = useRef(null);
  const hauntPendingChoiceType = game?.hauntState?.scenarioState?.pendingChoice?.type;
  const gameplayLockedByHauntSetup = game.gamePhase === GAME_PHASES.HAUNT_SETUP;
  const gameplayLockedByCombat = !!game.combatState;
  const gameplayLockedByHauntActionRoll = !!game.hauntActionRoll;
  const gameplayLockedByStalkPreyPlacement = hauntPendingChoiceType === "stalk-prey-placement";
  const gameIsOver = game.gamePhase === GAME_PHASES.GAME_OVER;
  const gameplayUiLocked =
    debugModeEnabled ||
    gameplayLockedByHauntSetup ||
    gameplayLockedByCombat ||
    gameplayLockedByHauntActionRoll ||
    gameplayLockedByStalkPreyPlacement ||
    gameIsOver;

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
      } else if (da.purpose === "haunt-action-roll" || da.purpose === "haunt-action-partial-reroll") {
        setGame((g) => {
          const actionRoll = g.hauntActionRoll;
          if (!actionRoll) return g;
          const rollTotal = Number.isFinite(da.total) ? da.total : baseTotal;
          const actor = g.players[actionRoll.actorIndex] || g.players[g.currentPlayerIndex];
          const sanityLoss = Math.max(0, Number(da.sanityLoss) || 0);
          const nextPlayers =
            sanityLoss > 0 && Number.isInteger(da.ownerIndex)
              ? g.players.map((player, playerIndex) => {
                  if (playerIndex !== da.ownerIndex) return player;
                  const nextSanity = Math.max(0, (player.statIndex?.sanity ?? 0) - sanityLoss);
                  const nextStatIndex = {
                    ...player.statIndex,
                    sanity: nextSanity,
                  };
                  return {
                    ...player,
                    statIndex: nextStatIndex,
                    isAlive: Object.values(nextStatIndex).every((value) => value > 0),
                  };
                })
              : g.players;
          return {
            ...g,
            players: nextPlayers,
            rabbitFootPendingReroll: null,
            hauntActionRoll: {
              ...actionRoll,
              status: "rolled-pending-continue",
              lastRoll: {
                ...(actionRoll.lastRoll || {}),
                label: da.label || actionRoll.label || "Trait",
                stat: actionRoll.stat,
                dice: [...da.final],
                total: rollTotal,
                modifier: da.modifier || null,
                outcomes: Array.isArray(da.outcomes) ? [...da.outcomes] : [],
              },
            },
            message: `${actor?.name || "Explorer"} rolled ${rollTotal}. Review the result and press Continue to apply it.`,
          };
        });
        setDiceAnimation(null);
      } else if (da.purpose === "monster-speed-roll") {
        setGame((g) => {
          const scenarioState = g.hauntState?.scenarioState;
          const spirit = scenarioState?.jacksSpirit;
          if (!spirit?.active) return g;
          const total = Number.isFinite(da.total) ? da.total : baseTotal;
          const moves = Math.max(1, total);
          const traitorIndex = g.hauntState?.traitorPlayerIndex;
          const nextPlayers = g.players.map((player, index) =>
            index === traitorIndex
              ? {
                  ...player,
                  floor: spirit.floor,
                  x: spirit.x,
                  y: spirit.y,
                  movesLeft: moves,
                }
              : player
          );
          return {
            ...g,
            players: nextPlayers,
            movePath: [{ x: spirit.x, y: spirit.y, floor: spirit.floor, cost: 0 }],
            hauntState: {
              ...g.hauntState,
              scenarioState: {
                ...scenarioState,
                jacksSpirit: {
                  ...spirit,
                  movesLeft: moves,
                  speedRoll: [...da.final],
                  speedTotal: total,
                },
              },
            },
            message: `${da.monsterName || "Jack's Spirit"} rolls ${da.final.join(", ")} (${total}) and may move ${moves} tile${
              moves !== 1 ? "s" : ""
            } this turn.`,
          };
        });
        setDiceAnimation(null);
      } else if (
        da.purpose === "event-roll" ||
        da.purpose === "event-partial-reroll" ||
        da.purpose === "event-damage-roll" ||
        da.purpose === "event-damage-sequence" ||
        da.purpose === "event-trait-sequence-roll"
      ) {
        setGame((g) => resolveEventAnimationSettlement(g, da).game);
        setDiceAnimation(null);
      } else if (da.purpose === "collapsed" || da.purpose === "collapsed-damage" || da.purpose === "furnace") {
        setGame(
          (g) =>
            resolveTileDiceAnimationState({
              game: g,
              animation: da,
              baseTotal,
              getDamageReduction,
              createDiceModifier,
            }) || g
        );
        setDiceAnimation(null);
      } else if (da.purpose === "mystic-elevator") {
        setGame((g) =>
          resolveMysticElevatorResultState({
            game: g,
            animation: da,
            total,
            getPlacementOptions,
          })
        );
        setDiceAnimation(null);
      } else if (da.purpose === "skeleton-key") {
        setGame((g) => {
          return {
            ...g,
            tileEffect: createSkeletonKeyResultTileEffect(da.final, g.message),
          };
        });
        setDiceAnimation(null);
      } else if (da.purpose === "combat-attacker-roll" || da.purpose === "combat-defender-roll") {
        setDiceAnimation(null);
      } else if (da.purpose === "skull-roll") {
        const total = baseTotal;
        setGame((g) => {
          if (!g.skullChallenge) return g;
          return { ...g, skullChallenge: { ...g.skullChallenge, roll: da.final, total } };
        });
        setDiceAnimation(null);
      } else if (da.purpose === "dynamite-roll") {
        const rollingPlayerIndex = da.playerIndex;
        const total = da.total != null ? da.total : da.final.reduce((s, d) => s + d, 0);
        setGame((g) => {
          if (!g.dynamiteState) return g;
          const lastRoll = {
            label: "Speed",
            dice: da.final,
            total,
            modifier: da.modifier || null,
            bonusDiceIndexes: da.bonusDiceIndexes || [],
            outcomes: [],
          };
          return {
            ...g,
            dynamiteState: {
              ...g.dynamiteState,
              pendingRoll: {
                playerIndex: rollingPlayerIndex,
                dice: da.final,
                total,
                bonusDiceIndexes: da.bonusDiceIndexes || [],
              },
            },
            eventState: g.eventState
              ? { ...g.eventState, awaiting: null, lastRoll }
              : {
                  card: { name: "Dynamite", id: "dynamite" },
                  stepIndex: 0,
                  context: {},
                  pendingEffects: [],
                  summary: null,
                  awaiting: null,
                  lastRoll,
                },
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
  }, [diceAnimation?.purpose, diceAnimation?.settled, diceAnimation?.token]);

  const currentPlayer = game.players[game.currentPlayerIndex];
  const floorTiles = game.board[cameraFloor] || [];

  // Keyboard controls
  useEffect(() => {
    function handleKeyDown(e) {
      const target = e.target;
      const isInputFocused =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "SELECT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        setDebugModeEnabled((prev) => !prev);
        return;
      }

      if (e.key === "Escape" && debugModeEnabled) {
        e.preventDefault();
        setDebugModeEnabled(false);
        return;
      }

      if (
        debugModeEnabled ||
        gameplayLockedByHauntSetup ||
        gameplayLockedByCombat ||
        gameplayLockedByStalkPreyPlacement ||
        gameIsOver ||
        isInputFocused
      ) {
        return;
      }

      const action = resolveKeyboardMoveAction({
        game,
        cameraFloor,
        currentPlayer,
        key: e.key,
        DIR,
        OPPOSITE,
        getTileAt,
        getLeaveMoveCost,
        canUseArmedSkeletonKeyMovement,
        isItemAbilityTileChoiceAwaiting,
        dogTradeState: tradeState,
      });

      if (!action) return;

      e.preventDefault();

      if (action.type === "rotate") {
        handleRotateTile(action.direction);
      } else if (action.type === "place-tile") {
        handlePlaceTile();
      } else if (action.type === "backtrack") {
        handleBacktrack();
      } else if (action.type === "move") {
        handleMove(action.nx, action.ny, action.cost, { useSkeletonKey: action.useSkeletonKey });
      } else if (action.type === "explore") {
        handleExplore(action.dir, action.nx, action.ny, action.cost);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Get tile at position
  function getTileAt(x, y, floor) {
    return game.board[floor]?.find((t) => t.x === x && t.y === y);
  }

  const getLeaveMoveCost = getLeaveMoveCostState;

  function getPlacementOptions(board, tile) {
    return getPlacementOptionsState(board, tile, DIR, OPPOSITE);
  }

  function setDebugPlayerStat(playerIndex, stat, nextIndex) {
    setGame((g) => {
      if (!g.players[playerIndex]) return g;

      const updatedPlayers = g.players.map((player, index) => {
        if (index !== playerIndex) return player;
        const safeIndex = Math.max(0, Math.min(player.character[stat].length - 1, nextIndex));
        const statIndex = {
          ...player.statIndex,
          [stat]: safeIndex,
        };
        const isAlive = Object.values(statIndex).every((value) => value > 0);
        const movesLeft = index === g.currentPlayerIndex ? player.character.speed[statIndex.speed] : player.movesLeft;

        return {
          ...player,
          statIndex,
          isAlive,
          movesLeft,
        };
      });

      return {
        ...g,
        players: updatedPlayers,
        message: `Debug: updated ${g.players[playerIndex].name}'s ${STAT_LABELS[stat]}.`,
      };
    });
  }

  function placeDebugTile() {
    if (!debugPlacementModeActive) return;
    if (!debugSelectedPlacementKey) return;

    const selectedTile = DEBUG_TILE_CATALOG.find((tile) => tile.id === debugSelectedTileId);
    if (!selectedTile) return;

    setGame((g) => {
      const placementOptions = getPlacementOptions(g.board, selectedTile).map((placement) => ({
        ...placement,
        key: `${placement.floor}:${placement.x}:${placement.y}`,
      }));
      const placement = placementOptions.find((option) => option.key === debugSelectedPlacementKey);
      if (!placement) {
        return {
          ...g,
          message: "Debug: selected placement is no longer valid.",
        };
      }

      const rotatedDoors = rotateDoors(selectedTile.doors, debugTileRotation);
      const isRotationValid = placement.validRotations.some((rotation) => rotation.join("") === rotatedDoors.join(""));
      if (!isRotationValid) {
        return {
          ...g,
          message: "Debug: selected rotation cannot connect at that placement.",
        };
      }

      const alreadyPlaced = Object.values(g.board).some((floorTiles) =>
        (floorTiles || []).some((placedTile) => placedTile.id === selectedTile.id)
      );
      if (alreadyPlaced) {
        return {
          ...g,
          message: `Debug: ${selectedTile.name} is already on the board.`,
        };
      }

      const newBoard = {
        ...g.board,
        [placement.floor]: [
          ...(g.board[placement.floor] || []),
          {
            ...selectedTile,
            x: placement.x,
            y: placement.y,
            floor: placement.floor,
            doors: rotatedDoors,
          },
        ],
      };

      const tileStackIndex = g.tileStack.findIndex((tile) => tile.id === selectedTile.id);
      const tileStack = [...g.tileStack];
      if (tileStackIndex >= 0) {
        tileStack.splice(tileStackIndex, 1);
      }

      return {
        ...g,
        board: newBoard,
        tileStack,
        message: `Debug: placed ${selectedTile.name} on ${placement.floor} (${placement.x}, ${placement.y}).`,
      };
    });

    setDebugPlacementModeActive(false);
    setDebugSelectedPlacementKey("");
  }

  function startDebugPlacementMode() {
    if (!selectedDebugTile) return;

    const alreadyPlaced = Object.values(game.board).some((floorTiles) =>
      (floorTiles || []).some((placedTile) => placedTile.id === selectedDebugTile.id)
    );
    if (alreadyPlaced) {
      setGame((g) => ({
        ...g,
        message: `Debug: ${selectedDebugTile.name} is already on the board.`,
      }));
      return;
    }

    if (debugPlacementOptions.length === 0) {
      setGame((g) => ({
        ...g,
        message: `Debug: no valid placements for ${selectedDebugTile.name}.`,
      }));
      return;
    }

    setDebugSelectedPlacementKey("");
    setDebugPlacementModeActive(true);
    setGame((g) => ({
      ...g,
      message: `Debug: pick a highlighted spot for ${selectedDebugTile.name}, then confirm placement.`,
    }));
  }

  function cancelDebugPlacementMode() {
    setDebugPlacementModeActive(false);
    setDebugSelectedPlacementKey("");
  }

  function activateDebugEvent() {
    if (!debugEventCardId) return;

    const eventTarget = game.players[debugEventPlayerIndex];
    if (eventTarget) {
      setCameraFloor(eventTarget.floor);
    }

    setGame((g) => {
      const sourceDeck = [...g.eventDeck];
      const cardIndex = sourceDeck.findIndex((card) => card.id === debugEventCardId);
      if (cardIndex < 0 || !g.players[debugEventPlayerIndex]) {
        return {
          ...g,
          message: "Debug: selected event is not available in undrawn cards.",
        };
      }

      const [card] = sourceDeck.splice(cardIndex, 1);
      const targetPlayer = g.players[debugEventPlayerIndex];

      return {
        ...g,
        eventDeck: sourceDeck,
        currentPlayerIndex: debugEventPlayerIndex,
        movePath: [{ x: targetPlayer.x, y: targetPlayer.y, floor: targetPlayer.floor, cost: 0 }],
        turnPhase: "card",
        drawnCard: createDrawnEventCard(card),
        eventState: null,
        tileEffect: null,
        damageChoice: null,
        rabbitFootPendingReroll: null,
        message: `Debug: activated ${card.name} for ${targetPlayer.name}.`,
      };
    });
  }

  function grantDebugCard() {
    if (!debugGrantCardId) return;

    setGame((g) => {
      const deckKey = debugGrantType === "omen" ? "omenDeck" : "itemDeck";
      const collectionKey = debugGrantType === "omen" ? "omens" : "inventory";
      const sourceDeck = [...g[deckKey]];
      const cardIndex = sourceDeck.findIndex((card) => card.id === debugGrantCardId);
      if (cardIndex < 0 || !g.players[debugGrantPlayerIndex]) {
        return {
          ...g,
          message: `Debug: selected ${debugGrantType} is not available in undrawn cards.`,
        };
      }

      const [card] = sourceDeck.splice(cardIndex, 1);
      const grantedCard = debugGrantType === "omen" ? createDrawnOmenCard(card) : createDrawnItemCard(card);
      const updatedPlayers = g.players.map((player, playerIndex) => {
        if (playerIndex !== debugGrantPlayerIndex) return player;
        return {
          ...player,
          [collectionKey]: [...player[collectionKey], grantedCard],
        };
      });

      return {
        ...g,
        [deckKey]: sourceDeck,
        players: updatedPlayers,
        omenCount: debugGrantType === "omen" ? g.omenCount + 1 : g.omenCount,
        message: `Debug: gave ${card.name} to ${g.players[debugGrantPlayerIndex].name}.`,
      };
    });
  }

  function removeDebugCard() {
    if (!debugRemoveCardKey) return;

    setGame((g) => {
      const player = g.players[debugRemovePlayerIndex];
      if (!player) return g;

      const [cardType, rawIndex] = debugRemoveCardKey.split(":");
      const cardIndex = Number(rawIndex);
      const fromOmens = cardType === "omen";
      const collectionKey = fromOmens ? "omens" : "inventory";
      const deckKey = fromOmens ? "omenDeck" : "itemDeck";
      const sourceCards = player[collectionKey] || [];
      if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= sourceCards.length) {
        return {
          ...g,
          message: "Debug: selected owned card is no longer available.",
        };
      }

      const card = sourceCards[cardIndex];
      const { type: _discardedType, ...deckCard } = card;
      const updatedPlayers = g.players.map((targetPlayer, playerIndex) => {
        if (playerIndex !== debugRemovePlayerIndex) return targetPlayer;
        return {
          ...targetPlayer,
          [collectionKey]: targetPlayer[collectionKey].filter((_, index) => index !== cardIndex),
        };
      });

      return {
        ...g,
        players: updatedPlayers,
        [deckKey]: [deckCard, ...g[deckKey]],
        omenCount: fromOmens ? Math.max(0, g.omenCount - 1) : g.omenCount,
        message: `Debug: removed ${card.name} from ${player.name}.`,
      };
    });
  }

  function startDebugHaunt() {
    if (!debugSelectedHauntId) return;

    const targetTraitor = game.players[debugHauntTraitorPlayerIndex];
    if (targetTraitor?.floor) {
      setCameraFloor(targetTraitor.floor);
    }

    setViewedCard(null);
    setTradeState(null);

    setGame((g) => {
      const hauntDefinition = getHauntDefinitionById(debugSelectedHauntId);
      if (!hauntDefinition) {
        return {
          ...g,
          message: "Debug: selected haunt is not available.",
        };
      }

      const clampedTraitorIndex = Math.max(0, Math.min(g.players.length - 1, debugHauntTraitorPlayerIndex));
      const nextState = startSelectedHauntState(g, {
        hauntDefinition,
        traitorPlayerIndex: clampedTraitorIndex,
      });
      const traitorName = nextState.players[clampedTraitorIndex]?.name || "the traitor";

      return {
        ...nextState,
        message: `Debug: started ${hauntDefinition.title} with ${traitorName} as traitor.`,
      };
    });
  }

  // Get valid move directions from current tile
  function getValidMoves() {
    return getValidMovesState({
      game,
      currentPlayer,
      DIR,
      OPPOSITE,
      getTileAt,
      getLeaveMoveCost,
      canUseArmedSkeletonKeyMovement,
      isItemAbilityTileChoiceAwaiting,
    });
  }

  // Move player to an existing tile and extend the current path.
  function handleMove(nx, ny, cost, options = {}) {
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP || game.gamePhase === GAME_PHASES.GAME_OVER)
      return;
    let nextDiceAnimation = null;
    setGame((g) => {
      const resolved = resolveMovePlayerActionState(g, {
        nx,
        ny,
        cost,
        useSkeletonKey: options.useSkeletonKey,
        rollDice,
        getLeaveMoveCost,
        canUseArmedSkeletonKeyMovement,
      });
      nextDiceAnimation = resolved.diceAnimation;
      return resolved.game;
    });

    if (nextDiceAnimation) {
      setDiceAnimation(nextDiceAnimation);
    }
  }

  // Backtrack to previous tile in path and refund the cost of the undone step.
  function handleBacktrack() {
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP || game.gamePhase === GAME_PHASES.GAME_OVER)
      return;
    let nextCameraFloor = null;
    setGame((g) => {
      const resolved = resolveBacktrackActionState(g);
      nextCameraFloor = resolved.cameraFloor;
      return resolved.game;
    });

    if (nextCameraFloor) {
      setCameraFloor(nextCameraFloor);
    }
  }

  // Explore — move player onto placeholder, don't reveal tile yet.
  function handleExplore(dir, nx, ny, cost) {
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP || game.gamePhase === GAME_PHASES.GAME_OVER)
      return;
    setGame((g) => {
      const resolved = resolveExploreActionState(g, {
        dir,
        nx,
        ny,
        cost,
        OPPOSITE,
        getLeaveMoveCost,
      });
      return resolved.game;
    });
  }

  // Handle clicking a move/explore/backtrack target
  function handleAction(move) {
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP || game.gamePhase === GAME_PHASES.GAME_OVER)
      return;
    let nextCameraFloor = null;
    let nextDiceAnimation = null;

    setGame((g) => {
      const resolved = resolveBoardMoveActionState(g, move, {
        rollDice,
        OPPOSITE,
        getLeaveMoveCost,
        canUseArmedSkeletonKeyMovement,
      });
      nextCameraFloor = resolved.cameraFloor;
      nextDiceAnimation = resolved.diceAnimation;
      return resolved.game;
    });

    if (nextCameraFloor) {
      setCameraFloor(nextCameraFloor);
    }
    if (nextDiceAnimation) {
      setDiceAnimation(nextDiceAnimation);
    }
  }

  // Confirm move — commit current position, reset path
  // If on a pending explore, enter rotate phase to choose orientation
  function handleConfirmMove() {
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP || game.gamePhase === GAME_PHASES.GAME_OVER)
      return;
    setGame((g) => confirmMoveState(g));
  }

  // Rotate the pending tile to the next valid orientation
  function handleRotateTile(direction) {
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP || game.gamePhase === GAME_PHASES.GAME_OVER)
      return;
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
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP || game.gamePhase === GAME_PHASES.GAME_OVER)
      return;
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
          if (cardType === "omen" && drawnCard) {
            nextOmenCount += 1;
          }
          if (drawnCard) {
            message += ` A${cardType === "omen" || cardType === "event" ? "n" : "n"} ${cardType} card appears...`;
            turnPhase = "card";
          } else {
            message += ` No ${cardType} cards remain. ${p.movesLeft} move${p.movesLeft !== 1 ? "s" : ""} left.`;
            turnPhase = "move";
          }
        } else {
          message += ` ${p.movesLeft} move${p.movesLeft !== 1 ? "s" : ""} left.`;
        }

        const discoverResolution = applyPlacedTileDiscoverEffects({
          placedTile,
          player: p,
          currentPlayerIndex: g.currentPlayerIndex,
          board: nextBoard,
          tileStack: nextStack,
          itemDeck: nextItemDeck,
          players: nextPlayers,
          drawnCard,
          turnPhase,
          message,
          tileEffect,
          mysticElevatorUsed: g.mysticElevatorUsed,
          getPlacementOptions,
          createDrawnItemCard,
          applyStatChange,
          statLabels: STAT_LABELS,
        });
        nextBoard = discoverResolution.board;
        nextStack = discoverResolution.tileStack;
        nextItemDeck = discoverResolution.itemDeck;
        nextPlayers = discoverResolution.players;
        drawnCard = discoverResolution.drawnCard;
        turnPhase = discoverResolution.turnPhase;
        message = discoverResolution.message;
        tileEffect = discoverResolution.tileEffect;
        const enableMysticElevator = discoverResolution.enableMysticElevator;

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
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP || game.gamePhase === GAME_PHASES.GAME_OVER)
      return;
    let nextCameraFloor = null;
    setGame((g) => {
      const resolved = resolveChangeFloorActionState(g, {
        getConnectedMoveTarget,
        getLeaveMoveCost,
      });
      nextCameraFloor = resolved.cameraFloor;
      return resolved.game;
    });
    if (nextCameraFloor) {
      setCameraFloor(nextCameraFloor);
    }
  }

  function handleUseSecretPassage(target) {
    if (hasUnconfirmedMovePathState(game)) return;
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP || game.gamePhase === GAME_PHASES.GAME_OVER)
      return;
    setGame((g) => resolveSecretPassageMoveState({ game: g, target, getTileAtPosition }));
    setCameraFloor(target.floor);
  }

  // End turn
  function handleEndTurn() {
    if (hasUnconfirmedMovePathState(game)) return;
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP || game.gamePhase === GAME_PHASES.GAME_OVER)
      return;
    let nextCameraFloor = null;
    let nextDiceAnimation = null;

    setGame((g) => {
      const resolved = resolveEndTurnActionState(g, {
        isItemAbilityTileChoiceAwaiting,
        getEndTurnTileAbilityState,
        rollDice,
        resolveTraitRoll,
        getDamageReduction,
        createDiceModifier,
        resolveEndTurnItemPassiveState,
        statLabels: STAT_LABELS,
      });
      nextCameraFloor = resolved.cameraFloor;
      nextDiceAnimation = resolved.diceAnimation;
      return resolved.game;
    });

    if (nextDiceAnimation) {
      setDiceAnimation(nextDiceAnimation);
    }
    if (nextCameraFloor) {
      setCameraFloor(nextCameraFloor);
    }
  }

  function applyStatChange(players, playerIndex, stat, amount) {
    return applyStatChangeState(players, playerIndex, stat, amount);
  }

  function applyDamageAllocation(players, playerIndex, allocation, adjustmentMode = "decrease") {
    return applyDamageAllocationState(players, playerIndex, allocation, adjustmentMode);
  }

  function handleStartCombat(defenderIndex) {
    handleStartCombatWithSource(defenderIndex, null);
  }

  function handleStartCombatWithSource(defenderIndex, sourceCard) {
    if (hasUnconfirmedMovePathState(game)) return;
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP) return;

    setGame((g) => {
      const action = sourceCard?.activeAbilityRule?.action;
      const targets = getCombatItemTargets(g, action, getTileAtPosition);
      if (!targets.some((target) => target.playerIndex === defenderIndex)) return g;

      const attacker = g.players[g.currentPlayerIndex];
      const defender = g.players[defenderIndex];
      const sourceRule = sourceCard?.activeAbilityRule || null;
      const {
        rollStat,
        combatDamageType,
        attackerNoDamageOnLoss,
        preRollBonusDice,
        preRollFlatBonus,
        preRollItemMessages,
        usedItemKeys,
        nextPlayers,
      } = applyCombatItemSource(sourceRule, sourceCard, g.currentPlayerIndex, g.players);

      return {
        ...g,
        players: nextPlayers,
        hasAttackedThisTurn: true,
        combatState: {
          phase: "attacker-roll",
          attackerIndex: g.currentPlayerIndex,
          defenderIndex,
          rollStat,
          combatDamageType,
          attackerNoDamageOnLoss,
          attacker: {
            dice: [],
            total: null,
            itemMessages: [],
            usedItemKeys,
            preRollBonusDice,
            preRollFlatBonus,
            preRollItemMessages,
            bonusDiceIndexes: [],
          },
          defender: {
            dice: [],
            total: null,
            itemMessages: [],
            usedItemKeys: [],
            bonusDiceIndexes: [],
          },
          outcome: null,
        },
        message: `${attacker.name} attacks ${defender.name}.`,
      };
    });
  }

  function handleRollCombat(role) {
    const combatState = game.combatState;
    if (!combatState) return;

    const expectedPhase = role === "attacker" ? "attacker-roll" : "defender-roll";
    if (combatState.phase !== expectedPhase) return;

    const actorIndex = role === "attacker" ? combatState.attackerIndex : combatState.defenderIndex;
    const actor = game.players[actorIndex];
    const actorProxy = getHauntCombatActorProxyState(game, actorIndex);
    if (!actor?.isAlive && !actorProxy) return;

    const rollStat = combatState.rollStat || "might";
    const defenseBonus =
      actorProxy || rollStat !== "might"
        ? { amount: 0, sourceNames: [] }
        : role === "defender"
          ? getDefenseRollDiceBonus(actor)
          : { amount: 0, sourceNames: [] };
    const baseStatDiceCount =
      rollStat === "sanity"
        ? getPlayerSanityDiceCount(actor)
        : rollStat === "speed"
          ? getPlayerSpeedDiceCount(actor)
          : getPlayerMightDiceCount(actor);
    const baseDiceCount = actorProxy?.usesMightDiceCount ?? baseStatDiceCount + defenseBonus.amount;
    const rollResult = actorProxy
      ? {
          dice: rollDice(baseDiceCount),
          total: 0,
          modifier: null,
        }
      : resolveTraitRoll(actor, {
          stat: rollStat,
          baseDiceCount,
          context: "attack",
          board: game.board,
          usePassives: true,
        });
    if (actorProxy) {
      rollResult.total = rollResult.dice.reduce((sum, value) => sum + value, 0);
    }

    const itemMessages = [];
    if (defenseBonus.amount > 0) {
      itemMessages.push(`+${defenseBonus.amount} defense dice from ${formatSourceNames(defenseBonus.sourceNames)}.`);
    }

    const roleState = combatState[role] || {};
    const preRollBonusDice = roleState.preRollBonusDice || 0;
    const preRollFlatBonus = roleState.preRollFlatBonus || 0;
    const preRollItemMessages = roleState.preRollItemMessages || [];
    const preRollDice = preRollBonusDice > 0 ? rollDice(preRollBonusDice) : [];
    const preRollDiceTotal = preRollDice.reduce((sum, value) => sum + value, 0);
    const opponentIndex = role === "attacker" ? combatState.defenderIndex : combatState.attackerIndex;
    const hauntKnowledgeBonus = getHauntCombatBonus(game, actorIndex, opponentIndex);
    const animatedDice = [...rollResult.dice, ...preRollDice];

    setGame((g) => {
      if (!g.combatState || g.combatState.phase !== expectedPhase) return g;

      const nextActorState = {
        ...g.combatState[role],
        dice: [...rollResult.dice, ...preRollDice],
        total: rollResult.total + preRollDiceTotal + preRollFlatBonus + hauntKnowledgeBonus,
        itemMessages: [...itemMessages, ...preRollItemMessages],
        preRollBonusDice: 0,
        preRollFlatBonus: 0,
        preRollItemMessages: [],
        bonusDiceIndexes: preRollDice.map((_, index) => rollResult.dice.length + index),
      };

      return {
        ...g,
        combatState: {
          ...g.combatState,
          [role]: nextActorState,
          phase: role === "attacker" ? "attacker-item" : "defender-item",
        },
      };
    });

    setDiceAnimation({
      purpose: role === "attacker" ? "combat-attacker-roll" : "combat-defender-roll",
      final: animatedDice,
      display: Array.from({ length: animatedDice.length }, () => Math.floor(Math.random() * 3)),
      settled: false,
      modifier: rollResult.modifier,
    });
  }

  function handleUseCombatItem(role, itemKey) {
    setGame((g) => {
      const combatState = g.combatState;
      if (!combatState) return g;

      const expectedPhase = role === "attacker" ? "attacker-item" : "defender-item";
      if (combatState.phase !== expectedPhase) return g;

      const actorState = combatState[role];
      if (actorState.total == null) return g;

      const actorIndex = role === "attacker" ? combatState.attackerIndex : combatState.defenderIndex;
      const actor = g.players[actorIndex];
      if (!actor) return g;

      const itemOptions = getCombatItemOptionsForPlayer(actor, actorState.usedItemKeys || []);
      const option = itemOptions.find((item) => item.key === itemKey && item.canUse);
      if (!option) return g;

      let nextPlayers = g.players;
      let extraDiceCount = 0;
      let extraTotal = 0;
      let itemMessage = "";

      if (option.action === "attack-bonus-die") {
        extraDiceCount = 1;
        itemMessage = `${option.name}: +1 attack die`;
      } else if (option.action === "attack-bonus-total") {
        extraTotal = 1;
        itemMessage = `${option.name}: +1 to roll total`;
      } else if (option.action === "optional-speed-loss-for-attack-dice") {
        const costAmount = option.rule?.costAmount || 1;
        const bonusDice = option.rule?.bonusDice || 2;
        nextPlayers = applyStatChangeState(g.players, actorIndex, "speed", -costAmount);
        extraDiceCount = bonusDice;
        itemMessage = `${option.name}: paid ${costAmount} Speed for +${bonusDice} attack dice`;
      }

      const bonusDice = extraDiceCount > 0 ? rollDice(extraDiceCount) : [];
      const bonusDiceTotal = bonusDice.reduce((sum, value) => sum + value, 0);

      const nextActorState = {
        ...actorState,
        dice: [...actorState.dice, ...bonusDice],
        total: actorState.total + bonusDiceTotal + extraTotal,
        itemMessages: [
          ...(actorState.itemMessages || []),
          extraDiceCount > 0 ? `${itemMessage} (rolled ${bonusDice.join(", ")})` : itemMessage,
        ],
        usedItemKeys: [...(actorState.usedItemKeys || []), itemKey],
        bonusDiceIndexes: [
          ...(actorState.bonusDiceIndexes || []),
          ...bonusDice.map((_, index) => actorState.dice.length + index),
        ],
      };

      return {
        ...g,
        players: nextPlayers,
        combatState: {
          ...combatState,
          [role]: nextActorState,
        },
        message: `${actor.name} uses ${option.name}.`,
      };
    });
  }

  function handleContinueCombatAttacker() {
    setGame((g) => {
      if (!g.combatState || g.combatState.phase !== "attacker-item") return g;
      return {
        ...g,
        combatState: {
          ...g.combatState,
          phase: "defender-roll",
        },
      };
    });
  }

  function handleContinueCombatDefender() {
    setGame((g) => {
      if (!g.combatState || g.combatState.phase !== "defender-item") return g;

      const attackerTotal = g.combatState.attacker.total || 0;
      const defenderTotal = g.combatState.defender.total || 0;

      const tie = attackerTotal === defenderTotal;
      const winnerIndex = tie
        ? null
        : attackerTotal > defenderTotal
          ? g.combatState.attackerIndex
          : g.combatState.defenderIndex;
      const loserIndex = tie
        ? null
        : winnerIndex === g.combatState.attackerIndex
          ? g.combatState.defenderIndex
          : g.combatState.attackerIndex;
      const damage = tie ? 0 : Math.abs(attackerTotal - defenderTotal);

      const outcome = {
        tie,
        attackerTotal,
        defenderTotal,
        winnerIndex,
        loserIndex,
        damage,
        winnerName: winnerIndex != null ? g.players[winnerIndex]?.name || "Winner" : "No one",
        loserName: loserIndex != null ? g.players[loserIndex]?.name || "Loser" : "No one",
      };

      return {
        ...g,
        combatState: {
          ...g.combatState,
          phase: "resolution",
          outcome,
        },
      };
    });
  }

  function handleAdvanceCombatResolution() {
    setGame((g) => {
      const combatState = g.combatState;
      const outcome = combatState?.outcome;
      if (!combatState || combatState.phase !== "resolution" || !outcome) return g;

      if (outcome.tie || outcome.damage <= 0 || outcome.loserIndex == null) {
        return {
          ...g,
          combatState: null,
          message: `Combat tied at ${outcome.attackerTotal}. No damage dealt.`,
        };
      }

      if (combatState.attackerNoDamageOnLoss && outcome.loserIndex === combatState.attackerIndex) {
        return {
          ...g,
          combatState: null,
          message: `${outcome.winnerName} wins (${outcome.attackerTotal} vs ${outcome.defenderTotal}). ${outcome.loserName} takes no damage (Crossbow).`,
        };
      }

      const loser = g.players[outcome.loserIndex];
      const combatDamageType = combatState.combatDamageType || "physical";
      const allocation = Object.fromEntries(DAMAGE_STATS[combatDamageType].map((stat) => [stat, 0]));
      const conversionOptions = getDamageConversionOptions(loser, combatDamageType);

      const damageChoice = {
        source: "combat",
        effect: null,
        playerIndex: outcome.loserIndex,
        playerName: loser.name,
        originalDamageType: combatDamageType,
        damageType: combatDamageType,
        adjustmentMode: "decrease",
        amount: outcome.damage,
        allowedStats: DAMAGE_STATS[combatDamageType],
        allocation,
        canConvertToGeneral: conversionOptions.canConvertToGeneral,
        conversionSourceNames: conversionOptions.sourceNames,
        postDamageEffects: getPostDamageEffectsForChoice(loser, {
          damageType: combatDamageType,
          originalDamageType: combatDamageType,
          allocation,
          amount: outcome.damage,
        }),
        combatSummaryMessage: `${outcome.winnerName} wins combat (${outcome.attackerTotal} vs ${outcome.defenderTotal}). ${outcome.loserName} takes ${outcome.damage} damage.`,
      };

      return {
        ...g,
        combatState: null,
        damageChoice,
        message: `${outcome.loserName} must allocate ${outcome.damage} damage.`,
      };
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
    setGame((g) =>
      adjustDamageAllocationChoiceState(g, stat, delta, {
        getPostDamageEffectsForChoice,
      })
    );
  }

  function handleToggleDamageConversion() {
    setGame((g) =>
      toggleDamageConversionChoiceState(g, {
        updateDamageChoiceType: (choice, _player, damageType) => {
          const playerIndex = Number.isInteger(choice.playerIndex) ? choice.playerIndex : g.currentPlayerIndex;
          const targetPlayer = g.players[playerIndex];
          return updateDamageChoiceType(choice, targetPlayer, damageType);
        },
      })
    );
  }

  function applyPostDamagePassiveEffects(players, playerIndex, choice) {
    return applyPostDamagePassiveEffectsState(players, playerIndex, choice, {
      applyStatChange,
      statLabels: STAT_LABELS,
    });
  }

  function handleConfirmDamageChoice() {
    let nextCameraFloor = null;
    let shouldClearDiceAnimation = false;
    let passTurnCameraFloor = null;

    setGame((g) => {
      const resolved = resolveConfirmDamageChoiceActionState(g, {
        applyDamageAllocation,
        applyPostDamagePassiveEffects,
        applyTileEffectConsequences,
        resolveEventDamageChoiceState,
        runAdvanceEventResolution,
        passTurn: (state) => {
          const passTurnResult = resolvePassTurnActionState(state, {
            resolveEndTurnItemPassiveState,
            statLabels: STAT_LABELS,
          });
          passTurnCameraFloor = passTurnResult.cameraFloor;
          return passTurnResult.game;
        },
      });
      const postHauntDamageGame = resolveHauntAfterDamageState(g, resolved.game);
      nextCameraFloor = resolved.cameraFloor || passTurnCameraFloor;
      shouldClearDiceAnimation = resolved.clearDiceAnimation;
      return postHauntDamageGame;
    });

    if (shouldClearDiceAnimation) {
      setDiceAnimation(null);
    }
    if (nextCameraFloor) {
      setCameraFloor(nextCameraFloor);
    }
  }

  function getDamagePreview(player, choice) {
    return getDamagePreviewState(player, choice);
  }

  function handleSkullRoll() {
    if (!game.skullChallenge || game.skullChallenge.roll !== null) return;
    const dice = rollDice(3);
    setDiceAnimation({
      purpose: "skull-roll",
      final: dice,
      display: Array.from({ length: dice.length }, () => Math.floor(Math.random() * 3)),
      settled: false,
      modifier: null,
    });
  }

  function handleSkullRevive() {
    setGame((g) => {
      const skullChallenge = g.skullChallenge;
      if (!skullChallenge) return g;
      const player = g.players[skullChallenge.playerIndex];
      const critStatIndex = Object.fromEntries(PLAYER_STAT_ORDER.map((stat) => [stat, CRITICAL_STAT_INDEX]));
      const revivedPlayer = { ...player, statIndex: critStatIndex, isAlive: true };
      const nextPlayers = g.players.map((p, i) => (i === skullChallenge.playerIndex ? revivedPlayer : p));
      return {
        ...g,
        skullChallenge: null,
        players: nextPlayers,
        message: `${player.name}'s Skull saves them! All traits set to Critical.`,
      };
    });
  }

  function handleSkullFinalizeDeath() {
    let nextCameraFloor = null;
    let shouldClearDiceAnimation = false;
    let passTurnCameraFloor = null;

    setGame((g) => {
      const skullChallenge = g.skullChallenge;
      if (!skullChallenge) return g;
      const gameWithDamage = { ...g, skullChallenge: null, damageChoice: skullChallenge.damageChoice };
      const resolved = resolveConfirmDamageChoiceActionState(gameWithDamage, {
        applyDamageAllocation,
        applyPostDamagePassiveEffects,
        applyTileEffectConsequences,
        resolveEventDamageChoiceState,
        runAdvanceEventResolution,
        passTurn: (state) => {
          const passTurnResult = resolvePassTurnActionState(state, {
            resolveEndTurnItemPassiveState,
            statLabels: STAT_LABELS,
          });
          passTurnCameraFloor = passTurnResult.cameraFloor;
          return passTurnResult.game;
        },
      });
      nextCameraFloor = resolved.cameraFloor || passTurnCameraFloor;
      shouldClearDiceAnimation = resolved.clearDiceAnimation;
      return resolveHauntAfterDamageState(gameWithDamage, resolved.game);
    });

    if (shouldClearDiceAnimation) setDiceAnimation(null);
    if (nextCameraFloor) setCameraFloor(nextCameraFloor);
  }

  function getStatTrackCellClass(index, currentIndex, previewIndex, adjustmentMode = "decrease") {
    return getStatTrackCellClassState(index, currentIndex, previewIndex, adjustmentMode);
  }

  function handleDynamiteRoll() {
    if (!game.dynamiteState || game.dynamiteState.queue.length === 0) return;
    const playerIndex = game.dynamiteState.queue[0];
    const player = game.players[playerIndex];
    if (!player) return;
    // Check for Angel's Feather override already applied via eventState
    if (game.eventState?.awaiting?.overrideTotal !== undefined) {
      // Angel's Feather was used — no dice animation needed, advance directly
      handleConfirmDynamiteRoll();
      return;
    }
    const speedStat = player.statIndex?.speed ?? 0;
    const baseSpeedDice = Math.max(player.character?.speed?.[speedStat] || 0, 1);
    // Include defense-roll-dice-bonus (e.g. Leather Jacket) since dodging dynamite is a defense roll.
    // Pass as extraDiceBonus so it appears in the modifier display and is tracked for visual highlighting.
    const defenseBonus = getDefenseRollDiceBonus(player);
    const rollResult = resolveTraitRoll(player, {
      stat: "speed",
      baseDiceCount: baseSpeedDice,
      context: { isDefenseRoll: true },
      board: game.board,
      extraDiceBonus: defenseBonus,
    });
    // Bonus dice are the ones beyond the base speed dice count (defense bonus + any omen dice)
    const bonusDiceIndexes = Array.from(
      { length: rollResult.dice.length - baseSpeedDice },
      (_, i) => baseSpeedDice + i
    );
    setDiceAnimation({
      purpose: "dynamite-roll",
      final: rollResult.dice,
      display: Array.from({ length: rollResult.dice.length }, () => Math.floor(Math.random() * 3)),
      settled: false,
      modifier: rollResult.modifier,
      total: rollResult.total,
      bonusDiceIndexes,
      playerIndex,
    });
  }

  function handleConfirmDynamiteRoll() {
    setGame((g) => {
      const ds = g.dynamiteState;
      if (!ds) return g;
      const pendingRoll = ds.pendingRoll;
      // Player index: from pendingRoll (normal roll) or queue[0] (Angel's Feather set total directly)
      const playerIndex = pendingRoll?.playerIndex ?? ds.queue[0];
      // Dice/total: prefer eventState.lastRoll (may reflect rerolls by Lucky Coin etc.) over pendingRoll
      const lastRoll = g.eventState?.lastRoll;
      const dice = lastRoll?.dice ?? pendingRoll?.dice;
      // Use precomputed total so flat bonuses (trait stat modifiers) are respected
      const total = lastRoll?.total ?? pendingRoll?.total ?? null;
      if (playerIndex == null || !dice) return g;
      return advanceDynamiteRollState(
        { ...g, dynamiteState: { ...ds, pendingRoll: null }, eventState: null },
        playerIndex,
        dice,
        total
      );
    });
  }

  function handleClearDynamiteState() {
    setGame((g) => ({ ...g, dynamiteState: null }));
  }

  function handleDismissTileEffect() {
    let nextCameraFloor = null;
    let shouldClearDiceAnimation = false;
    let passTurnCameraFloor = null;

    setGame((g) => {
      const resolved = resolveDismissTileEffectState(g, {
        cameraFloor,
        passTurn: (state) => {
          const passTurnResult = resolvePassTurnActionState(state, {
            resolveEndTurnItemPassiveState,
            statLabels: STAT_LABELS,
          });
          passTurnCameraFloor = passTurnResult.cameraFloor;
          return passTurnResult.game;
        },
        isQueuedTileEffectType,
        isSkeletonKeyResultEffect,
        resolveSkeletonKeyResultAfterDismiss,
        getIdolChoiceStateForQueuedEvent,
        resolveDamageEffect,
        createDamageChoice,
        applyTileEffectConsequences,
      });
      nextCameraFloor = resolved.cameraFloor || passTurnCameraFloor;
      shouldClearDiceAnimation = resolved.clearDiceAnimation;
      return resolved.game;
    });

    if (shouldClearDiceAnimation) {
      setDiceAnimation(null);
    }
    if (nextCameraFloor) {
      setCameraFloor(nextCameraFloor);
    }
  }

  function handleChooseNecklaceOfTeethStat(stat) {
    let nextCameraFloor = null;

    setGame((g) => {
      const resolution = resolveEndTurnItemPassiveChoiceState(g, { stat });
      if (!resolution) return g;

      const current = g.players[g.currentPlayerIndex];
      const passTurnCoreResult = resolvePassTurnCoreActionState({
        ...g,
        players: resolution.players,
        tileEffect: null,
      });
      nextCameraFloor = passTurnCoreResult.cameraFloor;
      const nextState = passTurnCoreResult.game;

      return {
        ...nextState,
        message: `${current.name} gains 1 ${STAT_LABELS[resolution.gainedStat]} with ${
          resolution.sourceName || "Necklace of Teeth"
        }. ${nextState.message}`,
      };
    });
    setDiceAnimation(null);
    if (nextCameraFloor) {
      setCameraFloor(nextCameraFloor);
    }
  }

  function handleDrawIdolEventCard() {
    setGame((g) => applyDrawIdolEventCardState(g));
  }

  function handleSkipIdolEventCard() {
    setGame((g) => applySkipIdolEventCardState(g));
  }

  function handleSkipNecklaceOfTeethGain() {
    let nextCameraFloor = null;

    setGame((g) => {
      if (!isEndTurnItemChoiceEffect(g.tileEffect)) return g;

      const current = g.players[g.currentPlayerIndex];
      const passTurnCoreResult = resolvePassTurnCoreActionState({
        ...g,
        tileEffect: null,
      });
      nextCameraFloor = passTurnCoreResult.cameraFloor;
      const nextState = passTurnCoreResult.game;

      return {
        ...nextState,
        message: `${current.name} skips Necklace of Teeth. ${nextState.message}`,
      };
    });
    setDiceAnimation(null);
    if (nextCameraFloor) {
      setCameraFloor(nextCameraFloor);
    }
  }

  function handleRollMysticElevator() {
    if (hasUnconfirmedMovePathState(game)) return;
    const rollState = getRollMysticElevatorState(game, rollDice);
    if (!rollState) return;

    setGame(rollState.game);
    setDiceAnimation(rollState.diceAnimation);
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
    if (!placement) return;
    const placementId = `${placement.floor}:${placement.x}:${placement.y}`;
    setGame((g) => {
      const pendingPlacement = g.pendingSpecialPlacement;
      if (!pendingPlacement) return g;
      return {
        ...g,
        pendingSpecialPlacement: {
          ...pendingPlacement,
          selectedPlacementId: placementId,
          rotationIndex: 0,
        },
        message: "Choose an orientation, then confirm placement.",
      };
    });
  }

  function handleRotatePendingSpecialPlacement(direction) {
    setGame((g) => {
      const pendingPlacement = g.pendingSpecialPlacement;
      if (!pendingPlacement?.selectedPlacementId) return g;

      const selected = (pendingPlacement.placements || []).find(
        (candidate) => `${candidate.floor}:${candidate.x}:${candidate.y}` === pendingPlacement.selectedPlacementId
      );
      const count = selected?.validRotations?.length || 0;
      if (count <= 1) return g;

      const currentIndex = pendingPlacement.rotationIndex || 0;
      const rotationIndex = direction === 1 ? (currentIndex + 1) % count : (currentIndex - 1 + count) % count;
      return {
        ...g,
        pendingSpecialPlacement: {
          ...pendingPlacement,
          rotationIndex,
        },
      };
    });
  }

  function handleConfirmPendingSpecialPlacement() {
    let nextCameraFloor = null;

    setGame((g) => {
      const resolved = placePendingSpecialTileState(g, null, {
        getIdolChoiceStateForQueuedEvent,
      });
      nextCameraFloor = resolved.cameraFloor;
      return resolved.game;
    });

    if (nextCameraFloor) {
      setCameraFloor(nextCameraFloor);
    }
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
    if (hasUnconfirmedMovePathState(game)) return;
    const resolved = resolveUseViewedCardActiveAbilityNowState({
      game,
      viewedCard,
      viewedCardActiveAbilityState,
      drawnEventPrimaryAction,
      queuedTraitRollOverride: queuedTraitRollOverrideRef.current,
      oppositeByDirection: OPPOSITE,
      getDogTradeTargets,
      resolveSpecialOmenNowAbilityState,
      chooseCardActiveAbilityNowState,
    });
    if (!resolved.handled) return;

    if (resolved.game) {
      setGame(resolved.game);
    }
    if (resolved.dogTradeState) {
      setTradeState(resolved.dogTradeState);
    }
    if (resolved.diceAnimation) {
      setDiceAnimation(resolved.diceAnimation);
    }
    if (resolved.queueTraitRollOverride !== undefined) {
      queuedTraitRollOverrideRef.current = resolved.queueTraitRollOverride;
      setQueuedTraitRollOverride(resolved.queueTraitRollOverride);
    }
    if (resolved.showUseNowPicker) {
      setViewedCard((card) => {
        if (!card) return card;
        return {
          ...card,
          showUseNowPicker: true,
        };
      });
    }
    if (resolved.closeViewedCard) {
      setViewedCard(null);
    }
  }

  function handleChooseActiveAbilityValue(total) {
    if (hasUnconfirmedMovePathState(game)) return;
    const resolved = resolveChooseViewedCardActiveAbilityValueState({
      game,
      total,
      viewedCard,
      drawnEventPrimaryAction,
      queuedTraitRollOverride: queuedTraitRollOverrideRef.current,
      chooseCardActiveAbilityValueState,
    });
    if (!resolved.handled) return;

    setGame(resolved.game);
    if (resolved.diceAnimation) {
      setDiceAnimation(resolved.diceAnimation);
    }
    if (resolved.queueTraitRollOverride !== undefined) {
      queuedTraitRollOverrideRef.current = resolved.queueTraitRollOverride;
      setQueuedTraitRollOverride(resolved.queueTraitRollOverride);
    }
    if (resolved.closeViewedCard) {
      setViewedCard(null);
    }
  }

  function handleCloseViewedCard() {
    setViewedCard(null);
  }

  function handleStartCombatFromViewedCard(defenderIndex) {
    if (!viewedCard) return;
    if (viewedCard.ownerIndex !== game.currentPlayerIndex) return;
    if (viewedCard.activeAbilityRule?.trigger !== "attack") return;

    handleStartCombatWithSource(defenderIndex, viewedCard);
    setViewedCard(null);
  }

  function handleStartDogTrade(targetPlayerIndex) {
    if (hasUnconfirmedMovePathState(game)) return;
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP) return;
    setTradeState((prev) => resolveStartTradeSelectionState(prev, targetPlayerIndex));
  }

  function handleStartPlayerTrade(targetPlayerIndex) {
    if (hasUnconfirmedMovePathState(game)) return;
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP) return;
    setTradeState((prev) => {
      if (prev) return prev;
      return createLocalPlayerTradeState(game, game.currentPlayerIndex, targetPlayerIndex);
    });
  }

  function handleMoveDogToken(move) {
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP) return;
    setTradeState((prev) => {
      const resolved = resolveMoveTradeTokenState(prev, move);
      if (resolved.cameraFloor) {
        setCameraFloor(resolved.cameraFloor);
      }
      return resolved.tradeState;
    });
  }

  function handleBackToDogMove() {
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP) return;
    setTradeState((prev) => resolveBackToTradeMoveState(prev));
  }

  function handleToggleDogOwnerGive(index) {
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP) return;
    setTradeState((prev) => resolveToggleTradeOwnerGiveState(prev, game, index));
  }

  function handleToggleDogTargetGive(index) {
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP) return;
    setTradeState((prev) => resolveToggleTradeTargetGiveState(prev, game, index));
  }

  function handleToggleDogOwnerGiveOmen(index) {
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP) return;
    setTradeState((prev) => resolveToggleTradeOwnerGiveOmenState(prev, game, index));
  }

  function handleToggleDogTargetGiveOmen(index) {
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP) return;
    setTradeState((prev) => resolveToggleTradeTargetGiveOmenState(prev, game, index));
  }

  function handleCancelDogTrade() {
    if (hasUnconfirmedMovePathState(game)) return;
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP) return;
    setTradeState(null);
  }

  function handleConfirmDogTrade() {
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP) return;
    const result = resolveConfirmTradeActionState(game, tradeState);
    setGame(result.nextGame);
    setTradeState(result.nextTradeState);
  }

  function handleAdvanceHauntRules() {
    setGame((g) => advanceHauntRulesViewState(g));
  }

  function handleBeginHauntAfterRules() {
    let nextCameraFloor = null;

    setGame((g) => {
      const nextState = beginHauntAfterRulesViewState(g);
      const activePlayer = nextState.players[nextState.currentPlayerIndex];
      nextCameraFloor = activePlayer?.floor || null;
      return nextState;
    });

    if (nextCameraFloor) {
      setCameraFloor(nextCameraFloor);
    }
  }

  function handleUseHauntAction(actionId) {
    if (debugModeEnabled || game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE) return;
    const nextGame = resolveHauntActionState(game, {
      actionId,
      resolveTraitRoll,
      createDamageChoice,
    });
    setGame(nextGame);

    const actionRoll = nextGame.hauntActionRoll;
    if (!actionRoll || actionRoll.status !== "awaiting-roll") return;
    const actionRollOwner = nextGame.players[actionRoll.actorIndex] || nextGame.players[nextGame.currentPlayerIndex];

    const forcedTotal = Number.isFinite(actionRoll.forcedTotal) ? Number(actionRoll.forcedTotal) : null;
    const rollResult =
      forcedTotal !== null
        ? {
            dice: [forcedTotal],
            total: forcedTotal,
            modifier: null,
          }
        : resolveTraitRoll(actionRollOwner, {
            stat: actionRoll.stat,
            baseDiceCount: Math.max(0, Number(actionRoll.baseDiceCount) || 0),
            context: "haunt-action",
            board: nextGame.board,
            usePassives: true,
          });
    const finalDice = rollResult.dice;
    const rollTotal = rollResult.total;

    setDiceAnimation({
      purpose: "haunt-action-roll",
      final: finalDice,
      display: Array.from({ length: finalDice.length }, () => Math.floor(Math.random() * 3)),
      settled: false,
      label: actionRoll.label || "Trait",
      total: rollTotal,
      modifier: rollResult.modifier || null,
      outcomes: [],
    });
  }

  function handleContinueHauntActionRoll() {
    setGame((g) =>
      resolveHauntActionRollContinueState(g, {
        createDamageChoice,
      })
    );
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

  const validMoves = cameraFloor === currentPlayer.floor ? getValidMoves() : [];
  const placedTileIds = useMemo(() => {
    const ids = new Set();
    for (const floorTiles of Object.values(game.board)) {
      for (const tile of floorTiles || []) {
        ids.add(tile.id);
      }
    }
    return ids;
  }, [game.board]);
  const availableDebugTiles = useMemo(
    () => DEBUG_TILE_CATALOG.filter((tile) => !placedTileIds.has(tile.id)),
    [placedTileIds]
  );
  const selectedDebugTile = useMemo(
    () => availableDebugTiles.find((tile) => tile.id === debugSelectedTileId) || availableDebugTiles[0] || null,
    [availableDebugTiles, debugSelectedTileId]
  );
  const debugPlacementOptions = useMemo(
    () =>
      selectedDebugTile
        ? getPlacementOptions(game.board, selectedDebugTile).map((placement) => ({
            ...placement,
            key: `${placement.floor}:${placement.x}:${placement.y}`,
          }))
        : [],
    [game.board, selectedDebugTile]
  );
  const selectedDebugPlacement = useMemo(
    () => debugPlacementOptions.find((placement) => placement.key === debugSelectedPlacementKey) || null,
    [debugPlacementOptions, debugSelectedPlacementKey]
  );
  const debugHauntOptions = useMemo(() => DEBUG_HAUNT_CATALOG, []);
  const debugRotationOptions = useMemo(
    () => getValidRotationIndexesForPlacement(selectedDebugTile, selectedDebugPlacement),
    [selectedDebugTile, selectedDebugPlacement]
  );
  const debugGrantDeck = debugGrantType === "omen" ? game.omenDeck : game.itemDeck;
  const debugGrantOptions = useMemo(() => getCardPoolOptions(debugGrantDeck), [debugGrantDeck]);
  const debugEventOptions = useMemo(() => getCardPoolOptions(game.eventDeck), [game.eventDeck]);
  const debugPlacementTargetsOnFloor = useMemo(
    () =>
      debugPlacementModeActive ? debugPlacementOptions.filter((placement) => placement.floor === cameraFloor) : [],
    [cameraFloor, debugPlacementModeActive, debugPlacementOptions]
  );
  // NOTE: DEBUG MODE
  const debugPlacementPreview = useMemo(() => {
    if (!debugPlacementModeActive || !selectedDebugTile || !debugSelectedPlacementKey) return null;

    const selectedPlacement = debugPlacementOptions.find((placement) => placement.key === debugSelectedPlacementKey);
    if (!selectedPlacement) return null;

    return {
      id: selectedDebugTile.id,
      name: selectedDebugTile.name,
      cardType: selectedDebugTile.cardType,
      floor: selectedPlacement.floor,
      x: selectedPlacement.x,
      y: selectedPlacement.y,
      doors: rotateDoors(selectedDebugTile.doors, debugTileRotation),
    };
  }, [
    debugPlacementModeActive,
    selectedDebugTile,
    debugSelectedPlacementKey,
    debugPlacementOptions,
    debugTileRotation,
  ]);
  // NOTE: DEBUG MODE
  const selectedDebugPlacementLabel = useMemo(() => {
    if (!selectedDebugPlacement) return "";
    return `${selectedDebugPlacement.floor} (${selectedDebugPlacement.x}, ${selectedDebugPlacement.y})`;
  }, [selectedDebugPlacement]);
  const debugRemovePlayer = game.players[debugRemovePlayerIndex];
  const debugRemovableCards = useMemo(
    () =>
      debugRemovePlayer
        ? (debugRemoveType === "omen" ? debugRemovePlayer.omens : debugRemovePlayer.inventory).map((card, index) => ({
            ...card,
            key: `${debugRemoveType}:${index}`,
          }))
        : [],
    [debugRemovePlayer, debugRemoveType]
  );
  const { dogMoveOptionsOnFloor, dogStairMoveOption, dogStairDestination, dogTradeTargetsOnTile } = getDogTradeUiState(
    game,
    tradeState,
    cameraFloor,
    getDogMoveOptions,
    getTileAtPosition
  );
  const playerTradeTargetsOnTile = getPlayerTradeTargetsOnTile(
    game,
    game.currentPlayerIndex,
    currentPlayer.floor,
    currentPlayer.x,
    currentPlayer.y
  );
  const combatTargetsOnTile = getCombatTargetsOnCurrentTile(game);
  const pendingSpecialPlacementTargets = (game.pendingSpecialPlacement?.placements || []).filter(
    (placement) => placement.floor === cameraFloor
  );
  const selectedPendingSpecialPlacementId = game.pendingSpecialPlacement?.selectedPlacementId || null;
  const selectedPendingSpecialPlacementBase = (game.pendingSpecialPlacement?.placements || []).find(
    (placement) => `${placement.floor}:${placement.x}:${placement.y}` === selectedPendingSpecialPlacementId
  );
  const selectedPendingSpecialPlacement = selectedPendingSpecialPlacementBase
    ? {
        ...selectedPendingSpecialPlacementBase,
        rotationIndex: game.pendingSpecialPlacement?.rotationIndex || 0,
      }
    : null;
  const canConfirmPendingSpecialPlacement = !!selectedPendingSpecialPlacement;
  const canRotatePendingSpecialPlacement = (selectedPendingSpecialPlacement?.validRotations?.length || 0) > 1;
  const damageChoice = game.damageChoice;
  const damageChoicePlayerIndex = Number.isInteger(damageChoice?.playerIndex)
    ? damageChoice.playerIndex
    : game.currentPlayerIndex;
  const damageChoicePlayer = game.players[damageChoicePlayerIndex] || currentPlayer;
  const attackerCombatItemOptions = useMemo(() => {
    if (!game.combatState || game.combatState.phase !== "attacker-item") return [];
    const attacker = game.players[game.combatState.attackerIndex];
    if (!attacker) return [];
    return getCombatItemOptionsForPlayer(attacker, game.combatState.attacker?.usedItemKeys || []);
  }, [game.combatState, game.players]);
  const defenderCombatItemOptions = useMemo(() => {
    if (!game.combatState || game.combatState.phase !== "defender-item") return [];
    const defender = game.players[game.combatState.defenderIndex];
    if (!defender) return [];
    return getCombatItemOptionsForPlayer(defender, game.combatState.defender?.usedItemKeys || []);
  }, [game.combatState, game.players]);
  const eventState = game.eventState;
  const isItemAbilityTileChoiceActive = isItemAbilityTileChoiceAwaiting(eventState);
  const { drawnEventPrimaryAction, eventTileChoiceOptions, selectedEventTileChoiceId, showEventResolutionModal } =
    getEventUiState(game, eventEngineDeps, queuedTraitRollOverride);
  const hauntPendingChoice = game.hauntState?.scenarioState?.pendingChoice;
  const isStalkPreyTileChoiceActive = hauntPendingChoice?.type === "stalk-prey-placement";
  const stalkPreyTileChoiceOptions = isStalkPreyTileChoiceActive ? hauntPendingChoice.options || [] : [];
  const selectedStalkPreyTileChoiceId = isStalkPreyTileChoiceActive
    ? hauntPendingChoice.selectedOptionId || null
    : null;
  const isEventTileChoiceActive = eventState?.awaiting?.type === "tile-choice";
  const boardTileChoiceOptions = isEventTileChoiceActive ? eventTileChoiceOptions : stalkPreyTileChoiceOptions;
  const selectedBoardTileChoiceId = isEventTileChoiceActive ? selectedEventTileChoiceId : selectedStalkPreyTileChoiceId;
  const isBoardTileChoiceActive = isEventTileChoiceActive || isStalkPreyTileChoiceActive;

  function handleBoardTileChoice(option) {
    if (isEventTileChoiceActive) {
      handleEventTileChoice(option);
      return;
    }
    if (isStalkPreyTileChoiceActive && option?.id) {
      handleUseHauntAction(`pending-select-stalk-prey:${option.id}`);
    }
  }

  function handleConfirmBoardTileChoice() {
    if (isEventTileChoiceActive) {
      handleConfirmEventTileChoice();
      return;
    }
    if (isStalkPreyTileChoiceActive) {
      handleUseHauntAction("confirm-stalk-prey-placement");
    }
  }
  const viewedCardActiveAbilityState = viewedCard
    ? getCardActiveAbilityState({
        game,
        viewedCard,
        drawnEventPrimaryAction,
        queuedTraitRollOverride,
      })
    : null;
  const isUnconfirmedMovePath = hasUnconfirmedMovePathState(game);
  const showMoveConfirmUseNowDisabled =
    !!viewedCard?.activeAbilityRule && viewedCard.ownerIndex === game.currentPlayerIndex && isUnconfirmedMovePath;
  const canStartCardAttackFromViewer =
    game.turnPhase === "move" &&
    !game.pendingExplore &&
    !tradeState &&
    !isItemAbilityTileChoiceAwaiting(eventState) &&
    !isUnconfirmedMovePath &&
    !gameplayUiLocked;
  const { damageAllocated, damageRemaining, canConfirmDamageChoice } = getDamageChoiceSummary(
    damageChoice,
    damageChoicePlayer
  );
  const damagePreview = damageChoice ? getDamagePreview(damageChoicePlayer, damageChoice) : null;

  // Check if current player is on a staircase tile
  const currentTileObj = getCurrentPlayerTile(game.board, currentPlayer);
  const canUseMysticElevator = getCanUseMysticElevator({
    game,
    currentTile: currentTileObj,
    isItemAbilityTileChoiceActive,
    diceAnimation,
  });
  const secretPassageTargets = getSecretPassageTargets({
    game,
    currentPlayer,
    isItemAbilityTileChoiceActive,
  });
  const canUseSecretPassage = getCanUseSecretPassage(currentTileObj, secretPassageTargets);
  const activeHauntDefinition = useMemo(() => getHauntDefinitionById(game.activeHauntId), [game.activeHauntId]);
  const hauntTraitorName =
    game.hauntState?.traitorPlayerIndex != null
      ? game.players[game.hauntState.traitorPlayerIndex]?.name || "the traitor"
      : "the traitor";
  const canOpenHauntRulesViewer = game.gamePhase === GAME_PHASES.HAUNT_ACTIVE && !!activeHauntDefinition;
  const endTurnPreviewPlayerName = getEndTurnPreviewPlayerName(game, currentPlayer);
  const hauntActionLocked =
    gameplayUiLocked ||
    !!tradeState ||
    !!game.pendingExplore ||
    !!game.pendingSpecialPlacement ||
    isItemAbilityTileChoiceAwaiting(eventState) ||
    hasUnconfirmedMovePathState(game);
  const hauntActionButtons = getHauntActionButtonsState(game, { hauntActionLocked });
  const hauntActionRollPreview = getHauntActionRollPreviewState(game);
  const stairTargetState = getStairTargetState({
    game,
    currentPlayer,
    currentTile: currentTileObj,
    isItemAbilityTileChoiceActive,
    getLeaveMoveCost,
  });
  const stairTarget = stairTargetState.target;
  const stairIsBacktrack = stairTargetState.isBacktrack;

  useEffect(() => {
    setGame((g) => {
      const resolved = resolveHauntTurnStartState(g, { rollDice });
      if (!resolved || !resolved.game) return g;
      if (resolved.diceAnimation) {
        setDiceAnimation(resolved.diceAnimation);
      }
      return resolved.game;
    });
  }, [game.currentPlayerIndex, game.turnNumber]);

  useEffect(() => {
    if (debugHauntOptions.length === 0) {
      if (debugSelectedHauntId !== "") {
        setDebugSelectedHauntId("");
      }
      return;
    }

    if (!debugHauntOptions.some((haunt) => haunt.id === debugSelectedHauntId)) {
      setDebugSelectedHauntId(debugHauntOptions[0].id);
    }
  }, [debugHauntOptions, debugSelectedHauntId]);

  useEffect(() => {
    if (game.players.length === 0) {
      if (debugHauntTraitorPlayerIndex !== 0) {
        setDebugHauntTraitorPlayerIndex(0);
      }
      return;
    }

    if (debugHauntTraitorPlayerIndex < 0 || debugHauntTraitorPlayerIndex >= game.players.length) {
      setDebugHauntTraitorPlayerIndex(0);
    }
  }, [debugHauntTraitorPlayerIndex, game.players.length]);

  useEffect(() => {
    if (availableDebugTiles.length === 0) {
      if (debugSelectedTileId !== "") {
        setDebugSelectedTileId("");
      }
      return;
    }
    if (!availableDebugTiles.some((tile) => tile.id === debugSelectedTileId)) {
      setDebugSelectedTileId(availableDebugTiles[0].id);
      setDebugPlacementModeActive(false);
      setDebugSelectedPlacementKey("");
    }
  }, [availableDebugTiles, debugSelectedTileId]);

  useEffect(() => {
    if (!debugPlacementModeActive) {
      if (debugSelectedPlacementKey !== "") {
        setDebugSelectedPlacementKey("");
      }
      return;
    }

    if (debugPlacementOptions.length === 0) {
      setDebugSelectedPlacementKey("");
      setDebugPlacementModeActive(false);
      return;
    }
    if (
      debugSelectedPlacementKey &&
      !debugPlacementOptions.some((placement) => placement.key === debugSelectedPlacementKey)
    ) {
      setDebugSelectedPlacementKey("");
    }
  }, [debugPlacementModeActive, debugPlacementOptions, debugSelectedPlacementKey]);

  useEffect(() => {
    if (!selectedDebugPlacement) return;
    if (debugRotationOptions.length === 0) return;

    if (!debugRotationOptions.includes(debugTileRotation)) {
      setDebugTileRotation(debugRotationOptions[0]);
    }
  }, [selectedDebugPlacement, debugRotationOptions, debugTileRotation]);

  useEffect(() => {
    if (debugGrantOptions.length === 0) {
      setDebugGrantCardId("");
      return;
    }
    if (!debugGrantOptions.some((option) => option.id === debugGrantCardId)) {
      setDebugGrantCardId(debugGrantOptions[0].id);
    }
  }, [debugGrantCardId, debugGrantOptions]);

  useEffect(() => {
    if (debugEventOptions.length === 0) {
      setDebugEventCardId("");
      return;
    }
    if (!debugEventOptions.some((option) => option.id === debugEventCardId)) {
      setDebugEventCardId(debugEventOptions[0].id);
    }
  }, [debugEventCardId, debugEventOptions]);

  useEffect(() => {
    if (debugRemovableCards.length === 0) {
      setDebugRemoveCardKey("");
      return;
    }
    if (!debugRemovableCards.some((card) => card.key === debugRemoveCardKey)) {
      setDebugRemoveCardKey(debugRemovableCards[0].key);
    }
  }, [debugRemoveCardKey, debugRemovableCards]);

  useEffect(() => {
    if (!canOpenHauntRulesViewer && hauntRulesViewerRole !== null) {
      setHauntRulesViewerRole(null);
    }
  }, [canOpenHauntRulesViewer, hauntRulesViewerRole]);

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
  const playersOnFloor = getPlayersOnFloor(game.players, cameraFloor);

  useEffect(() => {
    const scrollEl = boardRef.current;
    if (!scrollEl || currentPlayer.floor !== cameraFloor) return;
    const gridEl = scrollEl.querySelector(".board-grid");
    if (!gridEl) return;

    const tileCenterX = gridEl.offsetLeft + (currentPlayer.x - minX) * (TILE_SIZE + GAP) + TILE_SIZE / 2;
    const tileCenterY = gridEl.offsetTop + (currentPlayer.y - minY) * (TILE_SIZE + GAP) + TILE_SIZE / 2;

    const viewLeft = scrollEl.scrollLeft;
    const viewTop = scrollEl.scrollTop;
    const viewRight = viewLeft + scrollEl.clientWidth;
    const viewBottom = viewTop + scrollEl.clientHeight;
    const safeInset = Math.max(96, Math.round(TILE_SIZE * 0.7));

    const insideSafeZone =
      tileCenterX >= viewLeft + safeInset &&
      tileCenterX <= viewRight - safeInset &&
      tileCenterY >= viewTop + safeInset &&
      tileCenterY <= viewBottom - safeInset;

    if (insideSafeZone) return;

    const maxLeft = Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth);
    const maxTop = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);
    const targetLeft = Math.min(Math.max(tileCenterX - scrollEl.clientWidth / 2, 0), maxLeft);
    const targetTop = Math.min(Math.max(tileCenterY - scrollEl.clientHeight / 2, 0), maxTop);

    scrollEl.scrollTo({
      left: targetLeft,
      top: targetTop,
      behavior: "smooth",
    });
  }, [cameraFloor, currentPlayer.floor, currentPlayer.x, currentPlayer.y, minX, minY]);

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
        <div className="game-header-right">
          {canOpenHauntRulesViewer && (
            <div className="haunt-rule-shortcuts" aria-label="Haunt rules shortcuts">
              <button
                className="btn btn-secondary haunt-rule-shortcut-btn"
                onClick={() => setHauntRulesViewerRole("heroes")}
              >
                View Hero Rules
              </button>
              <button
                className="btn btn-secondary haunt-rule-shortcut-btn"
                onClick={() => setHauntRulesViewerRole("traitor")}
              >
                View Traitor Rules
              </button>
            </div>
          )}
        </div>
      </div>

      {gameIsOver && (
        <div className="game-over-banner">
          <div className="game-over-banner-title">{game.winnerTeam === "traitor" ? "Traitor Wins" : "Heroes Win"}</div>
          <div className="game-over-banner-subtitle">{game.message || "The haunt has ended."}</div>
        </div>
      )}

      {messageBubble && !gameIsOver && <div className="game-message-bubble">{messageBubble}</div>}

      {/* Board */}
      <BoardCanvas
        boardRef={boardRef}
        cameraFloor={cameraFloor}
        game={game}
        currentPlayer={currentPlayer}
        floorTiles={floorTiles}
        playersOnFloor={playersOnFloor}
        tradeState={tradeState}
        validMoves={validMoves}
        pendingSpecialPlacementTargets={pendingSpecialPlacementTargets}
        selectedPendingSpecialPlacementId={selectedPendingSpecialPlacementId}
        selectedPendingSpecialPlacement={selectedPendingSpecialPlacement}
        minX={minX}
        minY={minY}
        gridWidth={gridWidth}
        gridHeight={gridHeight}
        TILE_SIZE={TILE_SIZE}
        GAP={GAP}
        eventTileChoiceOptions={boardTileChoiceOptions}
        selectedEventTileChoiceId={selectedBoardTileChoiceId}
        handleEventTileChoice={handleBoardTileChoice}
        handleAction={handleAction}
        handlePlacePendingSpecialTile={handlePlacePendingSpecialTile}
        handleMoveDogToken={handleMoveDogToken}
        dogMoveOptionsOnFloor={dogMoveOptionsOnFloor}
        debugPlacementModeActive={debugPlacementModeActive}
        debugPlacementTargetsOnFloor={debugPlacementTargetsOnFloor}
        debugPlacementPreview={debugPlacementPreview}
        selectedDebugPlacementKey={debugSelectedPlacementKey}
        onSelectDebugPlacement={setDebugSelectedPlacementKey}
        interactionLocked={gameplayUiLocked}
      />

      <GameBoardActions
        eventState={eventState}
        isSpecialPlacementActive={!!game.pendingSpecialPlacement}
        canRotateSpecialPlacement={canRotatePendingSpecialPlacement}
        canConfirmSpecialPlacement={canConfirmPendingSpecialPlacement}
        handleRotateSpecialPlacement={handleRotatePendingSpecialPlacement}
        handleConfirmSpecialPlacement={handleConfirmPendingSpecialPlacement}
        isBoardTileChoiceActive={isBoardTileChoiceActive}
        selectedBoardTileChoiceId={selectedBoardTileChoiceId}
        handleConfirmBoardTileChoice={handleConfirmBoardTileChoice}
        tradeState={tradeState}
        game={game}
        handleConfirmMove={handleConfirmMove}
        stairTarget={stairTarget}
        stairIsBacktrack={stairIsBacktrack}
        handleChangeFloor={handleChangeFloor}
        canUseMysticElevator={canUseMysticElevator}
        handleRollMysticElevator={handleRollMysticElevator}
        canUseSecretPassage={canUseSecretPassage}
        secretPassageTargets={secretPassageTargets}
        handleUseSecretPassage={handleUseSecretPassage}
        currentPlayer={currentPlayer}
        handleRotateTile={handleRotateTile}
        handlePlaceTile={handlePlaceTile}
        isItemAbilityTileChoiceAwaiting={isItemAbilityTileChoiceAwaiting}
        endTurnPreviewPlayerName={endTurnPreviewPlayerName}
        handleEndTurn={handleEndTurn}
        playerTradeTargetsOnTile={playerTradeTargetsOnTile}
        handleStartPlayerTrade={handleStartPlayerTrade}
        combatTargetsOnTile={combatTargetsOnTile}
        handleStartCombat={handleStartCombat}
        dogStairMoveOption={dogStairMoveOption}
        handleMoveDogToken={handleMoveDogToken}
        dogStairDestination={dogStairDestination}
        dogTradeTargetsOnTile={dogTradeTargetsOnTile}
        handleStartDogTrade={handleStartDogTrade}
        handleCancelDogTrade={handleCancelDogTrade}
        hauntActionButtons={hauntActionButtons}
        onUseHauntAction={handleUseHauntAction}
        controlsDisabled={gameplayUiLocked && !isBoardTileChoiceActive}
      />

      <PlayerSidebar
        game={game}
        expandedSidebarPlayers={expandedSidebarPlayers}
        toggleSidebarPlayer={toggleSidebarPlayer}
        PLAYER_STAT_ORDER={PLAYER_STAT_ORDER}
        STAT_ICONS={STAT_ICONS}
        STAT_LABELS={STAT_LABELS}
        CRITICAL_STAT_INDEX={CRITICAL_STAT_INDEX}
        formatStatTrackValue={formatStatTrackValue}
        handleViewOwnedCard={handleViewOwnedCard}
        onQuit={onQuit}
      />

      <DrawnCardModal
        drawnCard={game.drawnCard}
        drawnEventPrimaryAction={drawnEventPrimaryAction}
        hauntStarted={game.gamePhase !== GAME_PHASES.PRE_HAUNT}
        onDismissCard={handleDismissCard}
      />

      <ViewedCardViewer
        viewedCard={viewedCard}
        viewedCardActiveAbilityState={viewedCardActiveAbilityState}
        showMoveConfirmUseNowDisabled={showMoveConfirmUseNowDisabled}
        canStartCardAttack={canStartCardAttackFromViewer}
        cardAttackTargets={
          viewedCard?.activeAbilityRule?.action === "ranged-attack-speed"
            ? getCrossboxTargets(game, getTileAtPosition)
            : viewedCard?.activeAbilityRule?.action === "gun-ranged-attack"
              ? getGunTargets(game)
              : combatTargetsOnTile
        }
        handleStartCardAttack={handleStartCombatFromViewedCard}
        handleUseViewedCardActiveAbilityNow={handleUseViewedCardActiveAbilityNow}
        handleChooseActiveAbilityValue={handleChooseActiveAbilityValue}
        handleCloseViewedCard={handleCloseViewedCard}
      />

      <TradeViewer
        game={game}
        tradeState={tradeState}
        actionsDisabled={gameplayUiLocked}
        handlers={{
          handleToggleDogOwnerGive,
          handleToggleDogOwnerGiveOmen,
          handleToggleDogTargetGive,
          handleToggleDogTargetGiveOmen,
          handleConfirmDogTrade,
          handleBackToDogMove,
          handleCancelDogTrade,
        }}
      />

      <HauntSetupOverlay
        game={game}
        hauntDefinition={activeHauntDefinition}
        onAdvanceRules={handleAdvanceHauntRules}
        onBeginHaunt={handleBeginHauntAfterRules}
      />

      <HauntRulesViewerOverlay
        role={hauntRulesViewerRole}
        hauntDefinition={activeHauntDefinition}
        traitorName={hauntTraitorName}
        onClose={() => setHauntRulesViewerRole(null)}
      />

      <DebugModePanel
        game={game}
        isOpen={debugModeEnabled}
        onClose={() => setDebugModeEnabled(false)}
        playerStatOrder={PLAYER_STAT_ORDER}
        debugTileCatalog={availableDebugTiles}
        selectedTileId={selectedDebugTile?.id || ""}
        onTileChange={setDebugSelectedTileId}
        tileRotation={debugTileRotation}
        onTileRotationChange={setDebugTileRotation}
        rotationOptions={debugRotationOptions}
        rotationDisabled={!selectedDebugPlacement}
        placementModeActive={debugPlacementModeActive}
        selectedPlacementLabel={selectedDebugPlacementLabel}
        onStartPlacementMode={startDebugPlacementMode}
        onCancelPlacementMode={cancelDebugPlacementMode}
        onConfirmPlacement={placeDebugTile}
        selectedPlacementKey={debugSelectedPlacementKey}
        placementOptions={debugPlacementOptions}
        grantType={debugGrantType}
        onGrantTypeChange={(value) => setDebugGrantType(value === "omen" ? "omen" : "item")}
        grantPlayerIndex={debugGrantPlayerIndex}
        onGrantPlayerChange={setDebugGrantPlayerIndex}
        grantCardId={debugGrantCardId}
        onGrantCardChange={setDebugGrantCardId}
        grantOptions={debugGrantOptions}
        onGrantCard={grantDebugCard}
        eventPlayerIndex={debugEventPlayerIndex}
        onEventPlayerChange={setDebugEventPlayerIndex}
        eventCardId={debugEventCardId}
        onEventCardChange={setDebugEventCardId}
        eventOptions={debugEventOptions}
        onActivateEvent={activateDebugEvent}
        removeType={debugRemoveType}
        onRemoveTypeChange={(value) => setDebugRemoveType(value === "omen" ? "omen" : "item")}
        removePlayerIndex={debugRemovePlayerIndex}
        onRemovePlayerChange={setDebugRemovePlayerIndex}
        removeCardKey={debugRemoveCardKey}
        onRemoveCardKeyChange={setDebugRemoveCardKey}
        removableCards={debugRemovableCards}
        onRemoveCard={removeDebugCard}
        hauntOptions={debugHauntOptions}
        selectedHauntId={debugSelectedHauntId}
        onHauntChange={setDebugSelectedHauntId}
        hauntTraitorPlayerIndex={debugHauntTraitorPlayerIndex}
        onHauntTraitorPlayerChange={setDebugHauntTraitorPlayerIndex}
        onStartHaunt={startDebugHaunt}
        onSetPlayerStat={setDebugPlayerStat}
      />

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

      <HauntActionRollOverlay
        game={game}
        diceAnimation={diceAnimation}
        hauntActionRollPreview={hauntActionRollPreview}
        onContinue={handleContinueHauntActionRoll}
        renderDiceRow={(props) => <DiceRow {...props} />}
      />

      <DiceRollOverlay diceAnimation={diceAnimation} renderDiceRow={(props) => <DiceRow {...props} />} />

      <HauntRollOverlay
        game={game}
        diceAnimation={diceAnimation}
        onDismissHauntRoll={handleDismissHauntRoll}
        renderDiceRow={(props) => <DiceRow {...props} />}
      />

      <TileEffectOverlay
        game={game}
        statLabels={STAT_LABELS}
        isSkeletonKeyResultEffect={isSkeletonKeyResultEffect}
        renderDiceRow={(props) => <DiceRow {...props} />}
        onSelectRabbitFootDie={handleSelectRabbitFootDie}
        onConfirmRabbitFootReroll={handleConfirmRabbitFootReroll}
        onChooseNecklaceOfTeethStat={handleChooseNecklaceOfTeethStat}
        onSkipNecklaceOfTeethGain={handleSkipNecklaceOfTeethGain}
        onDrawIdolEventCard={handleDrawIdolEventCard}
        onSkipIdolEventCard={handleSkipIdolEventCard}
        onStartCollapsedDamage={handleStartCollapsedDamage}
        onDismissTileEffect={handleDismissTileEffect}
      />

      <CombatOverlay
        combatState={game.combatState}
        diceAnimation={diceAnimation}
        players={game.players}
        attackerItemOptions={attackerCombatItemOptions}
        defenderItemOptions={defenderCombatItemOptions}
        onRollAttacker={() => handleRollCombat("attacker")}
        onRollDefender={() => handleRollCombat("defender")}
        onUseAttackerItem={(itemKey) => handleUseCombatItem("attacker", itemKey)}
        onUseDefenderItem={(itemKey) => handleUseCombatItem("defender", itemKey)}
        onContinueAttacker={handleContinueCombatAttacker}
        onContinueDefender={handleContinueCombatDefender}
        onAdvanceResolution={handleAdvanceCombatResolution}
      />

      <DamageChoiceOverlay
        damageChoice={damageChoice}
        currentPlayer={damageChoicePlayer}
        damageAllocated={damageAllocated}
        damageRemaining={damageRemaining}
        canConfirmDamageChoice={canConfirmDamageChoice}
        damagePreview={damagePreview}
        statLabels={STAT_LABELS}
        criticalStatIndex={CRITICAL_STAT_INDEX}
        formatStatTrackValue={formatStatTrackValue}
        getStatTrackCellClass={getStatTrackCellClass}
        formatSourceNames={formatSourceNames}
        onToggleDamageConversion={handleToggleDamageConversion}
        onAdjustDamageAllocation={handleAdjustDamageAllocation}
        onConfirmDamageChoice={handleConfirmDamageChoice}
      />

      {game.skullChallenge &&
        !(diceAnimation && diceAnimation.purpose === "skull-roll" && !diceAnimation.settled) &&
        (() => {
          const sc = game.skullChallenge;
          const player = game.players[sc.playerIndex];
          const rolled = sc.roll !== null;
          const survived = rolled && sc.total >= 4;
          return (
            <div className="skull-challenge-overlay">
              <div className="skull-challenge-modal">
                <h2 className="skull-challenge-title">☠ Skull</h2>
                {!rolled ? (
                  <>
                    <p className="skull-challenge-description">
                      <strong>{player?.name}</strong> is about to die! They are holding the Skull.
                    </p>
                    <p className="skull-challenge-description">
                      Roll 3 dice — 4+ saves you (all traits set to Critical). 0–3 you die.
                    </p>
                    <div className="skull-challenge-buttons">
                      <button className="btn btn-danger" onClick={handleSkullRoll}>
                        Use Skull
                      </button>
                      <button className="btn btn-secondary" onClick={handleSkullFinalizeDeath}>
                        Accept Death
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="dice-container skull-challenge-dice">
                      {sc.roll.map((die, i) => (
                        <div key={i} className="die">
                          {die}
                        </div>
                      ))}
                    </div>
                    <p className="skull-challenge-total">Total: {sc.total}</p>
                    <p className="skull-challenge-description">
                      {survived
                        ? `${player?.name} survives! All traits set to Critical.`
                        : `${player?.name} rolls too low… they die.`}
                    </p>
                    <button
                      className="btn btn-primary"
                      onClick={survived ? handleSkullRevive : handleSkullFinalizeDeath}
                    >
                      Continue
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })()}

      {game.dynamiteState &&
        !game.damageChoice &&
        !(diceAnimation && diceAnimation.purpose === "dynamite-roll" && !diceAnimation.settled) &&
        (() => {
          const ds = game.dynamiteState;
          const pendingRoll = ds.pendingRoll ?? null;
          // eventState.lastRoll may be updated by Lucky Coin / Creepy Doll rerolls
          // or set directly by Angel's Feather (no pendingRoll in that case)
          const eventLastRoll = game.eventState?.lastRoll ?? null;
          const displayDice = eventLastRoll?.dice ?? pendingRoll?.dice ?? null;
          const displayTotal = eventLastRoll?.total ?? pendingRoll?.total ?? null;
          const displayModifier = eventLastRoll?.modifier ?? pendingRoll?.modifier ?? null;
          const displayBonusDiceIndexes = eventLastRoll?.bonusDiceIndexes ?? pendingRoll?.bonusDiceIndexes ?? [];
          const hasConfirmedRoll = !!displayDice;
          const allDone = ds.queue.length === 0 && !hasConfirmedRoll;
          const currentRollerIndex = pendingRoll?.playerIndex ?? ds.queue[0];
          const currentRoller = currentRollerIndex != null ? game.players[currentRollerIndex] : null;

          // Rabbit's Foot die selection active during dynamite
          const rabbitFoot = game.rabbitFootPendingReroll;
          const isRabbitFootSelectionActive =
            !!rabbitFoot && hasConfirmedRoll && !!displayDice && diceAnimation?.purpose !== "event-partial-reroll";
          const selectedRabbitFootDieIndex = rabbitFoot?.selectedDieIndex;
          const canConfirmRabbitFootReroll =
            isRabbitFootSelectionActive &&
            Number.isInteger(selectedRabbitFootDieIndex) &&
            selectedRabbitFootDieIndex >= 0 &&
            selectedRabbitFootDieIndex < (displayDice?.length || 0);

          return (
            <div className="dynamite-overlay">
              <div className="dynamite-modal">
                <h2 className="dynamite-title">💥 Dynamite!</h2>
                {ds.results.length > 0 && (
                  <div className="dynamite-results">
                    {ds.results.map((r) => (
                      <p key={r.playerIndex} className={`dynamite-result ${r.safe ? "safe" : "hit"}`}>
                        {r.name}: {r.total} — {r.safe ? "✓ Escaped" : "✗ Hit!"}
                      </p>
                    ))}
                  </div>
                )}
                {hasConfirmedRoll ? (
                  <>
                    <p className="dynamite-description">
                      <strong>{currentRoller?.name}</strong> rolled Speed:
                    </p>
                    {isRabbitFootSelectionActive ? (
                      <div className="dice-container dynamite-dice">
                        {displayDice.map((d, i) => {
                          const isSelected = i === selectedRabbitFootDieIndex;
                          const isBonus = displayBonusDiceIndexes.includes(i);
                          return (
                            <button
                              key={i}
                              type="button"
                              className={`die die-selectable${isSelected ? " die-selected" : ""}${isBonus ? " dynamite-die-bonus" : ""}`}
                              onClick={() => handleSelectRabbitFootDie(i)}
                              aria-label={`Select die ${i + 1}`}
                              aria-pressed={isSelected}
                            >
                              {d}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="dice-container dynamite-dice">
                        {displayDice.map((d, i) => (
                          <div
                            key={i}
                            className={`die${displayBonusDiceIndexes.includes(i) ? " dynamite-die-bonus" : ""}`}
                          >
                            {d}
                          </div>
                        ))}
                      </div>
                    )}
                    {displayModifier && (
                      <div className={`dice-modifier dice-modifier-${displayModifier.tone}`}>
                        <div className="dice-modifier-value">{displayModifier.value}</div>
                        <div className="dice-modifier-label">{displayModifier.label}</div>
                      </div>
                    )}
                    <p className="dynamite-roll-total">Total: {displayTotal}</p>
                    <p className={`dynamite-roll-outcome ${displayTotal >= 4 ? "safe" : "hit"}`}>
                      {displayTotal >= 4 ? "✓ Escaped the blast!" : "✗ Caught in the blast — takes 4 physical damage"}
                    </p>
                    {isRabbitFootSelectionActive ? (
                      <button
                        className="btn btn-primary"
                        onClick={handleConfirmRabbitFootReroll}
                        disabled={!canConfirmRabbitFootReroll}
                      >
                        Reroll Selected Die
                      </button>
                    ) : (
                      <>
                        <p className="dynamite-description" style={{ fontSize: "0.8em", opacity: 0.8 }}>
                          Items in your inventory can still be used.
                        </p>
                        <button className="btn btn-primary" onClick={handleConfirmDynamiteRoll}>
                          Confirm
                        </button>
                      </>
                    )}
                  </>
                ) : allDone ? (
                  <>
                    <p className="dynamite-description">Dynamite resolved!</p>
                    <button className="btn btn-primary" onClick={handleClearDynamiteState}>
                      Continue
                    </button>
                  </>
                ) : (
                  <>
                    <p className="dynamite-description">
                      <strong>{currentRoller?.name}</strong> must roll Speed.
                    </p>
                    <p className="dynamite-description">Roll 4+ to escape, 0–3 takes 4 physical damage.</p>
                    <p className="dynamite-description" style={{ fontSize: "0.8em", opacity: 0.8 }}>
                      Angel's Feather can be used before rolling.
                    </p>
                    <button className="btn btn-danger" onClick={handleDynamiteRoll}>
                      Roll Speed ({currentRoller?.name})
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })()}
    </div>
  );
}
