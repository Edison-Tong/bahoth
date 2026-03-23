import { useState, useRef, useEffect } from "react";
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
import EventResolutionModal, {
  CardAbilityContent,
  DrawnCardModal,
  EventTileChoiceTargets,
} from "./components/EventResolutionModal";
import GameBoardActions from "./components/gameboard/GameBoardActions";
import PlayerSidebar from "./components/gameboard/PlayerSidebar";
import { applyDrawIdolEventCardState, getIdolChoiceStateForQueuedEvent, applySkipIdolEventCardState, resolveSpecialOmenNowAbilityState, getDogTradeUiState, isItemTradeLockedThisTurn } from "./omens/omenDomain";
import { isEndTurnItemChoiceEffect, resolveEndTurnItemPassiveChoiceState, resolveEndTurnItemPassiveState, canUseArmedSkeletonKeyMovement, createSkeletonKeyResultTileEffect, isSkeletonKeyResultEffect, resolveSkeletonKeyResultAfterDismiss } from "./items/itemDomain";
import { applyPlacedTileDiscoverEffects, getEndTurnTileAbilityState, resolveTileDiceAnimationState, resolveDismissTileEffectState, getCurrentPlayerTile, getCanUseMysticElevator, getCanUseSecretPassage, getSecretPassageTargets, getStairTargetState, getRollMysticElevatorState, resolveMysticElevatorResultState, getConnectedMoveTarget, resolveSecretPassageMoveState } from "./tiles/tileDomain";
import { confirmMoveState, getValidMovesState, placePendingSpecialTileState, resolveKeyboardMoveAction, getPlacementOptionsState, resolveBacktrackActionState, resolveBoardMoveActionState, resolveChangeFloorActionState, resolveExploreActionState, resolveMovePlayerActionState, getLeaveMoveCostState, hasUnconfirmedMovePathState } from "./movement/movementDomain";
import { adjustDamageAllocationChoiceState, applyDamageAllocationState, applyPostDamagePassiveEffectsState, applyStatChangeState, getDamagePreviewState, getStatTrackCellClassState, toggleDamageConversionChoiceState, getDamageChoiceSummary, getEndTurnPreviewPlayerName, getPlayersOnFloor, resolveConfirmDamageChoiceActionState, createLocalPlayerTradeState, getPlayerTradeTargetsOnTile, resolveBackToTradeMoveState, resolveConfirmTradeActionState, resolveMoveTradeTokenState, resolveStartTradeSelectionState, resolveToggleTradeOwnerGiveState, resolveToggleTradeOwnerGiveOmenState, resolveToggleTradeTargetGiveState, resolveToggleTradeTargetGiveOmenState, resolveEndTurnActionState, resolvePassTurnActionState, resolvePassTurnCoreActionState } from "./players/playerDomain";
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
import "./GameBoard.css";

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


export default function GameBoard({ players, onQuit }) {
  const [game, setGame] = useState(() => initGameState(players));
  const [cameraFloor, setCameraFloor] = useState("ground");
  const [diceAnimation, setDiceAnimation] = useState(null);
  const [expandedSidebarPlayers, setExpandedSidebarPlayers] = useState(() => new Set());
  const [viewedCard, setViewedCard] = useState(null);
  const [tradeState, setTradeState] = useState(null);
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
      } else if (da.purpose === "mystic-elevator") {
        setGame((g) =>
          resolveMysticElevatorResultState({
            game: g,
            animation: da,
            total,
            getPlacementOptions,
          })
        );
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
      const action = resolveKeyboardMoveAction({
        game,
        cameraFloor,
        currentPlayer,
        key: e.key,
        DIR,
        OPPOSITE,
        getTileAt,
        getLeaveMoveCost,
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
        handleMove(action.nx, action.ny, action.cost);
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
    setGame((g) => confirmMoveState(g));
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
    setGame((g) => resolveSecretPassageMoveState({ game: g, target, getTileAtPosition }));
    setCameraFloor(target.floor);
  }

  // End turn
  function handleEndTurn() {
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
        updateDamageChoiceType,
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

  function getDamagePreview(player, choice) {
    return getDamagePreviewState(player, choice);
  }

  function getStatTrackCellClass(index, currentIndex, previewIndex, adjustmentMode = "decrease") {
    return getStatTrackCellClassState(index, currentIndex, previewIndex, adjustmentMode);
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
    let nextCameraFloor = null;

    setGame((g) => {
      const resolved = placePendingSpecialTileState(g, placement, {
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

  function handleStartDogTrade(targetPlayerIndex) {
    setTradeState((prev) => resolveStartTradeSelectionState(prev, targetPlayerIndex));
  }

  function handleStartPlayerTrade(targetPlayerIndex) {
    setTradeState((prev) => {
      if (prev) return prev;
      return createLocalPlayerTradeState(game, game.currentPlayerIndex, targetPlayerIndex);
    });
  }

  function handleMoveDogToken(move) {
    setTradeState((prev) => {
      const resolved = resolveMoveTradeTokenState(prev, move);
      if (resolved.cameraFloor) {
        setCameraFloor(resolved.cameraFloor);
      }
      return resolved.tradeState;
    });
  }

  function handleBackToDogMove() {
    setTradeState((prev) => resolveBackToTradeMoveState(prev));
  }

  function handleToggleDogOwnerGive(index) {
    setTradeState((prev) => resolveToggleTradeOwnerGiveState(prev, game, index));
  }

  function handleToggleDogTargetGive(index) {
    setTradeState((prev) => resolveToggleTradeTargetGiveState(prev, game, index));
  }

  function handleToggleDogOwnerGiveOmen(index) {
    setTradeState((prev) => resolveToggleTradeOwnerGiveOmenState(prev, game, index));
  }

  function handleToggleDogTargetGiveOmen(index) {
    setTradeState((prev) => resolveToggleTradeTargetGiveOmenState(prev, game, index));
  }

  function handleCancelDogTrade() {
    setTradeState(null);
  }

  function handleConfirmDogTrade() {
    const result = resolveConfirmTradeActionState(game, tradeState);
    setGame(result.nextGame);
    setTradeState(result.nextTradeState);
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
  const isUnconfirmedMovePath = hasUnconfirmedMovePathState(game);
  const showMoveConfirmUseNowDisabled =
    !!viewedCard?.activeAbilityRule && viewedCard.ownerIndex === game.currentPlayerIndex && isUnconfirmedMovePath;
  const { damageAllocated, damageRemaining, canConfirmDamageChoice } = getDamageChoiceSummary(damageChoice);
  const damagePreview = damageChoice ? getDamagePreview(currentPlayer, damageChoice) : null;

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
  const endTurnPreviewPlayerName = getEndTurnPreviewPlayerName(game, currentPlayer);
  const stairTargetState = getStairTargetState({
    game,
    currentPlayer,
    currentTile: currentTileObj,
    isItemAbilityTileChoiceActive,
    getLeaveMoveCost,
  });
  const stairTarget = stairTargetState.target;
  const stairIsBacktrack = stairTargetState.isBacktrack;

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
                  {tradeState?.mode === "dog-remote" &&
                    tradeState.floor === cameraFloor &&
                    tradeState.x === tile.x &&
                    tradeState.y === tile.y && (
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
            {!tradeState &&
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
            {!tradeState &&
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

            {tradeState?.phase === "move" &&
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

      <GameBoardActions
        eventState={eventState}
        selectedEventTileChoiceId={selectedEventTileChoiceId}
        handleConfirmEventTileChoice={handleConfirmEventTileChoice}
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
        dogStairMoveOption={dogStairMoveOption}
        handleMoveDogToken={handleMoveDogToken}
        dogStairDestination={dogStairDestination}
        dogTradeTargetsOnTile={dogTradeTargetsOnTile}
        handleStartDogTrade={handleStartDogTrade}
        handleCancelDogTrade={handleCancelDogTrade}
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

      {tradeState?.phase === "trade" && (
        <div className="sidebar-card-viewer" role="dialog" aria-label="Trade">
          <div className="card-modal card-viewer">
            <div className="card-type-label">TRADE</div>
            <h2 className="card-name">{tradeState.mode === "dog-remote" ? "Dog Trade" : "Player Trade"}</h2>
            {(() => {
              const owner = game.players[tradeState.ownerIndex];
              const selectedTarget = game.players[tradeState.targetPlayerIndex];
              const selectedTargetIndex = tradeState.targetPlayerIndex;

              return (
                <>
                  {tradeState.mode === "dog-remote" ? (
                    <p>
                      Dog is on {tradeState.floor}. Pick any cards Dog carries from {owner?.name} and cards the target
                      willingly sends back.
                    </p>
                  ) : (
                    <p>Choose any number of cards each player gives. Trade completes only when both agree.</p>
                  )}

                  <div style={{ marginBottom: "0.75rem" }}>
                    Trading with <strong>{selectedTarget?.name || "Unknown"}</strong>
                  </div>

                  <h3 style={{ marginTop: 0 }}>Send From {owner?.name}</h3>
                  <div className="event-option-list" style={{ marginBottom: "0.75rem" }}>
                    {[
                      ...(owner?.inventory || []).map((card, index) => ({
                        kind: "item",
                        index,
                        card,
                        selected: (tradeState.ownerGiveIndexes || []).includes(index),
                        locked: isItemTradeLockedThisTurn(card, game.turnNumber),
                      })),
                      ...(owner?.omens || []).map((card, index) => {
                        const isActiveDogOmen = tradeState.mode === "dog-remote" && index === tradeState.dogOmenIndex;
                        return {
                          kind: "omen",
                          index,
                          card,
                          selected: (tradeState.ownerGiveOmenIndexes || []).includes(index),
                          locked: isActiveDogOmen || isItemTradeLockedThisTurn(card, game.turnNumber),
                          lockReason: isActiveDogOmen ? " (currently in use)" : "",
                        };
                      }),
                    ].map((entry) => (
                      <button
                        key={`trade-owner-give-${entry.kind}-${entry.index}`}
                        className={`${entry.selected ? "btn btn-primary" : "btn btn-secondary"} trade-option-btn trade-option-${entry.kind}`}
                        onClick={() =>
                          entry.kind === "item"
                            ? handleToggleDogOwnerGive(entry.index)
                            : handleToggleDogOwnerGiveOmen(entry.index)
                        }
                        disabled={entry.locked}
                      >
                        {entry.selected ? "[Send] " : ""}
                        {entry.card.name}
                        {entry.locked ? entry.lockReason || " (used this turn)" : ""}
                      </button>
                    ))}
                    {(owner?.inventory || []).length + (owner?.omens || []).length === 0 && (
                      <div className="sidebar-card-empty">No cards to send</div>
                    )}
                  </div>

                  <h3 style={{ marginTop: 0 }}>Receive From {selectedTarget?.name || "Target"}</h3>
                  <div className="event-option-list" style={{ marginBottom: "0.75rem" }}>
                    {[
                      ...(selectedTarget?.inventory || []).map((card, index) => ({
                        kind: "item",
                        index,
                        card,
                        selected: (tradeState.targetGiveIndexes || []).includes(index),
                        locked: isItemTradeLockedThisTurn(card, game.turnNumber),
                      })),
                      ...(selectedTarget?.omens || []).map((card, index) => ({
                        kind: "omen",
                        index,
                        card,
                        selected: (tradeState.targetGiveOmenIndexes || []).includes(index),
                        locked: isItemTradeLockedThisTurn(card, game.turnNumber),
                      })),
                    ].map((entry) => (
                      <button
                        key={`trade-target-give-${selectedTargetIndex}-${entry.kind}-${entry.index}`}
                        className={`${entry.selected ? "btn btn-primary" : "btn btn-secondary"} trade-option-btn trade-option-${entry.kind}`}
                        onClick={() =>
                          entry.kind === "item"
                            ? handleToggleDogTargetGive(entry.index)
                            : handleToggleDogTargetGiveOmen(entry.index)
                        }
                        disabled={entry.locked}
                      >
                        {entry.selected ? "[Offer] " : ""}
                        {entry.card.name}
                        {entry.locked ? " (used this turn)" : ""}
                      </button>
                    ))}
                    {(selectedTarget?.inventory || []).length + (selectedTarget?.omens || []).length === 0 && (
                      <div className="sidebar-card-empty">No cards offered</div>
                    )}
                  </div>
                </>
              );
            })()}

            <button className="btn btn-primary" onClick={handleConfirmDogTrade}>
              Confirm Trade
            </button>
            {tradeState.mode === "dog-remote" && (
              <button className="btn btn-secondary" onClick={handleBackToDogMove}>
                Back to Dog Movement
              </button>
            )}
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
