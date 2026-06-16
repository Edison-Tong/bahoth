// GameBoard.jsx — Main game board component. See component comment near the export for full description.
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
import DiceBox from "./components/gameboard/DiceBox";
import CombatOverlay from "./components/gameboard/overlays/CombatOverlay";
import DiceRollOverlay from "./components/gameboard/overlays/DiceRollOverlay";
import HauntRollOverlay from "./components/gameboard/overlays/HauntRollOverlay";
import TileEffectOverlay from "./components/gameboard/overlays/TileEffectOverlay";
import HauntSetupOverlay from "./components/gameboard/overlays/HauntSetupOverlay";
import HauntRulesViewerOverlay from "./components/gameboard/overlays/HauntRulesViewerOverlay";
import HauntActionRollOverlay from "./components/gameboard/overlays/HauntActionRollOverlay";
import DamageChoiceOverlay from "./components/gameboard/overlays/DamageChoiceOverlay";
import ForceExplosivesOverlay from "./haunts/haunt_28/ForceExplosivesOverlay";
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
  resolveSetTradeExplosiveCountState,
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
  completeHauntSetupState,
  GAME_PHASES,
  getHauntActionButtonsState,
  getHauntActionRollPreviewState,
  getAllHauntDefinitions,
  getHauntCombatBonus,
  getHauntCombatActorProxyState,
  resolveHauntMonsterSpeedRollState,
  getHauntDefinitionById,
  resolveHauntActionRollContinueState,
  resolveHauntAfterDamageState,
  resolveHauntActionState,
  resolveHauntTurnStartState,
  startSelectedHauntState,
  getHauntTradeableTokensState,
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

/* [PLAYER-STATE] [FORMAT] Returns ☠ for 0 (dead), otherwise the stat value. Used by stat track cells. */
function formatStatTrackValue(value) {
  return value === 0 ? "☠" : value;
}

const ALL_DIRECTIONS = ["N", "E", "S", "W"];
const DEBUG_TILE_CATALOG = [...STARTING_TILES, ...TILES];
const DEBUG_HAUNT_CATALOG = getAllHauntDefinitions();

/* [TILE-PLACEMENT] Rotates a door direction array by N quarter-turn steps (each step: N→E→S→W→N). */
function rotateDoors(doors, rotation) {
  return doors.map((door) => {
    const doorIndex = ALL_DIRECTIONS.indexOf(door);
    return ALL_DIRECTIONS[(doorIndex + rotation) % 4];
  });
}

/* [TILE-PLACEMENT] [VALIDATION] Returns which rotation indexes produce door sets that are compatible with a given placement slot. */
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

/* [DEBUG] [CARD-DECK] Deduplicates a deck into { id, name, count } entries sorted by name, used by the debug grant UI. */
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

/* [PLAYER-STATE] [DICE-ROLL] Returns the player's current Might stat value as a dice count. */
function getPlayerMightDiceCount(player) {
  return player.character.might[player.statIndex.might] || 0;
}

/* [PLAYER-STATE] [DICE-ROLL] Returns the player's current Sanity stat value as a dice count. */
function getPlayerSanityDiceCount(player) {
  return player.character.sanity[player.statIndex.sanity] || 0;
}

/* [ITEM-PASSIVE] [COMBAT-ROLL] Sums all defense-roll-dice-bonus passive effects for a player (e.g. Knight's Shield). */
function getDefenseRollDiceBonus(player) {
  const effects = getPassiveEffects(player).filter((effect) => effect.type === "defense-roll-dice-bonus");
  return {
    amount: effects.reduce((sum, effect) => sum + (effect.amount || 0), 0),
    sourceNames: effects.map((effect) => effect.sourceName),
  };
}

/* [COMBAT] [ITEM-ABILITY] Builds the list of usable non-weapon combat item options for a player, filtering already-used keys. */
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

/* [DICE-ANIMATION] Renders a row of die face values with an optional modifier badge. */
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

/* [BOARD-LAYOUT] Main game board component (~3600 lines). Owns all client-side game state and is the single point of dispatch for every player action. Renders the board canvas, all overlays, sidebar, and action buttons. Online mode: syncs state via onlineConfig.send + receives via onlineConfig. */
export default function GameBoard({ players, onQuit, onlineConfig, initialGameState }) {
  const [game, setGame] = useState(() => initialGameState ?? initGameState(players));
  const [cameraFloor, setCameraFloor] = useState("ground");
  const [diceAnimation, setDiceAnimation] = useState(null);
  const [lastSettledRoll, setLastSettledRoll] = useState(null);
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

  // --- Online multiplayer sync ---
  // Tracks the last game state received from the server so we don't echo it back
  const lastReceivedRemoteGame = useRef(null);
  // Captures the very first game state so we don't broadcast it on mount
  const initialGameRef = useRef(game);
  // Always-current reference to the broadcast function (avoids stale closure in effect)
  const broadcastRef = useRef(null);
  broadcastRef.current = onlineConfig?.broadcast ?? null;

  // Apply remote state when App.jsx receives a state-update from the server
  useEffect(() => {
    const remoteGame = onlineConfig?.remoteGameState;
    if (!remoteGame || remoteGame === lastReceivedRemoteGame.current) return;
    lastReceivedRemoteGame.current = remoteGame;
    setGame(remoteGame);
    // Clear any spectator dice animation — the result is now in the incoming state
    setDiceAnimation((prev) => (prev?.spectator ? null : prev));
  }, [onlineConfig?.remoteGameState]);

  // Broadcast local state changes to all other players
  useEffect(() => {
    if (!broadcastRef.current) return;
    if (game === lastReceivedRemoteGame.current) return; // don't echo a received state
    if (game === initialGameRef.current) return; // don't broadcast the initial state
    broadcastRef.current(game);
  }, [game]);

  // Broadcast dice animation start so spectators can see the rolling animation
  const sentAnimPurposeRef = useRef(null);
  useEffect(() => {
    if (!onlineConfig?.sendDiceAnim) return;
    if (!diceAnimation || diceAnimation.settled || diceAnimation.spectator) {
      sentAnimPurposeRef.current = null;
      return;
    }
    // Guard: only broadcast once per animation (purpose changes on new animation, goes undefined when null)
    if (sentAnimPurposeRef.current === diceAnimation.purpose) return;
    sentAnimPurposeRef.current = diceAnimation.purpose;
    onlineConfig.sendDiceAnim(diceAnimation.purpose, diceAnimation.final?.length ?? 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diceAnimation?.purpose, diceAnimation?.settled, onlineConfig]);

  // Spectator: start visual-only animation when a dice-anim hint arrives via WS
  useEffect(() => {
    if (!onlineConfig?.remoteDiceAnim) return;
    setDiceAnimation((prev) => {
      if (prev) return prev; // already animating (event path may have started one)
      const { purpose, count } = onlineConfig.remoteDiceAnim;
      return {
        purpose,
        final: Array(count).fill(0),
        display: Array.from({ length: count }, () => Math.floor(Math.random() * 3)),
        settled: false,
        spectator: true,
        modifier: null,
      };
    });
  }, [onlineConfig?.remoteDiceAnim]);

  // Spectator: update dice box with real result when it arrives, and clear
  // the settled spectator animation in the same batch (no null gap).
  useEffect(() => {
    if (!onlineConfig?.remoteDiceResult) return;
    setLastSettledRoll(onlineConfig.remoteDiceResult);
    setDiceAnimation((prev) => (prev?.spectator ? null : prev));
  }, [onlineConfig?.remoteDiceResult]);
  // --- End online sync ---
  const hauntPendingChoiceType = game?.hauntState?.scenarioState?.pendingChoice?.type;
  const gameplayLockedByHauntSetup = game.gamePhase === GAME_PHASES.HAUNT_SETUP;
  const gameplayLockedByCombat = !!game.combatState;
  const gameplayLockedByHauntActionRoll = !!game.hauntActionRoll;
  const gameplayLockedByStalkPreyPlacement = hauntPendingChoiceType === "stalk-prey-placement";
  const gameplayLockedByHauntPendingChoice =
    hauntPendingChoiceType === "assign-knowledge-token" ||
    hauntPendingChoiceType === "move-exorcism-token" ||
    hauntPendingChoiceType === "flood-tile-selection" ||
    hauntPendingChoiceType === "cue-ominous-music-placement" ||
    hauntPendingChoiceType === "force-explosives-count";
  const gameIsOver = game.gamePhase === GAME_PHASES.GAME_OVER;
  const gameplayUiLocked =
    debugModeEnabled ||
    gameplayLockedByHauntSetup ||
    gameplayLockedByCombat ||
    gameplayLockedByHauntActionRoll ||
    gameplayLockedByStalkPreyPlacement ||
    gameplayLockedByHauntPendingChoice ||
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
      const da = activeAnimation;
      if (!da) return;

      // Spectator animation: mark it settled so DiceBox holds position while
      // we wait for the real dice-result message to arrive with the true values.
      if (da.spectator) {
        setDiceAnimation((prev) => (prev ? { ...prev, display: prev.final, settled: true } : null));
        return;
      }

      setDiceAnimation((prev) => {
        if (!prev) return prev;
        return { ...prev, display: prev.final, settled: true };
      });
      const baseTotal = da.final.reduce((a, b) => a + b, 0);
      const total = baseTotal;

      // Persist this roll in the dice box for all players to review
      const rollingPlayer = game.players[game.currentPlayerIndex];
      const settledRoll = {
        purpose: da.purpose,
        final: da.final,
        dice: da.final,
        total: Number.isFinite(da.total) ? da.total : baseTotal,
        modifier: da.modifier ?? null,
        playerName: rollingPlayer?.name ?? null,
      };
      setLastSettledRoll(settledRoll);
      onlineConfig?.sendDiceResult?.(settledRoll);

      if (da.purpose === "haunt") {
        const hauntTriggered = baseTotal >= 5;
        setGame((g) => ({
          ...g,
          hauntRoll: {
            dice: da.final,
            total: baseTotal,
            omenCount: da.omenCount,
            hauntTriggered,
            triggeringOmenId: da.triggeringOmenId ?? null,
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
                  const minSanity = g.gamePhase === "preHaunt" ? 1 : 0;
                  const nextSanity = Math.max(minSanity, (player.statIndex?.sanity ?? 0) - sanityLoss);
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
          const updatedLastRoll = {
            ...(actionRoll.lastRoll || {}),
            label: da.label || actionRoll.label || "Trait",
            stat: actionRoll.stat,
            dice: [...da.final],
            total: rollTotal,
            modifier: da.modifier || null,
            outcomes: Array.isArray(da.outcomes) ? [...da.outcomes] : [],
          };
          return {
            ...g,
            players: nextPlayers,
            rabbitFootPendingReroll: null,
            hauntActionRoll: {
              ...actionRoll,
              status: "rolled-pending-continue",
              lastRoll: updatedLastRoll,
            },
            ...(actionRoll.isCollapsedRoll && {
              tileEffect: {
                ...g.tileEffect,
                dice: [...da.final],
                diceModifier: da.modifier || null,
                total: rollTotal,
                message:
                  rollTotal >= 5
                    ? `Rolled ${rollTotal} — the floor holds! (Needed 5+)`
                    : `Rolled ${rollTotal} — the floor gives way! (Needed 5+)`,
              },
            }),
            message: `${actor?.name || "Explorer"} rolled ${rollTotal}. Review the result and press Continue to apply it.`,
          };
        });
        setDiceAnimation(null);
      } else if (da.purpose === "monster-speed-roll") {
        setGame((g) => {
          const total = Number.isFinite(da.total) ? da.total : baseTotal;
          return resolveHauntMonsterSpeedRollState(g, { dice: da.final, total, monsterName: da.monsterName });
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
      } else if (da.purpose === "collapsed") {
        // Store the roll in hauntActionRoll so after-roll items (Creepy Doll, Lucky Coin, Rabbit's Foot)
        // can interact with it as a standard trait roll before the player presses Continue.
        const resolvedTotal = Number.isFinite(da.resolvedTotal) ? da.resolvedTotal : baseTotal;
        setGame((g) => ({
          ...g,
          hauntActionRoll: {
            status: "rolled-pending-continue",
            isCollapsedRoll: true,
            tileName: da.tileName,
            playerIndex: da.playerIndex ?? g.currentPlayerIndex,
            lastRoll: {
              label: "Speed",
              stat: "speed",
              dice: [...da.final],
              total: resolvedTotal,
              modifier: da.modifier || null,
              outcomes: [],
            },
          },
          tileEffect: {
            type: "collapsed-roll-result",
            tileName: da.tileName,
            dice: da.final,
            diceModifier: da.modifier || null,
            total: resolvedTotal,
            message:
              resolvedTotal >= 5
                ? `Rolled ${resolvedTotal} — the floor holds! (Needed 5+)`
                : `Rolled ${resolvedTotal} — the floor gives way! (Needed 5+)`,
          },
        }));
        setDiceAnimation(null);
      } else if (da.purpose === "collapsed-damage" || da.purpose === "furnace") {
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
  // In online mode, only the player whose turn it is can interact
  const isMyTurn = onlineConfig == null || onlineConfig.myPlayerIndex === game.currentPlayerIndex;

  // Keyboard controls
  useEffect(() => {
    /* [MOVEMENT] [TILE-PLACEMENT] Arrow keys and R key handler: delegates to resolveKeyboardMoveAction for move/rotate/place. */
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
        gameplayLockedByHauntPendingChoice ||
        gameIsOver ||
        isInputFocused ||
        !isMyTurn
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

  /* [TILE-PLACEMENT] Thin wrapper around getPlacementOptionsState, passing DIR/OPPOSITE. */
  function getPlacementOptions(board, tile) {
    return getPlacementOptionsState(board, tile, DIR, OPPOSITE);
  }

  /* [DEBUG] [PLAYER-STATE] Debug: directly sets a player's stat track index and updates movesLeft for the current player. */
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

  /* [DEBUG] [TILE-PLACEMENT] Debug: places the selected tile at the chosen placement spot, validating rotation compatibility. */
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

  /* [DEBUG] [TILE-PLACEMENT] Debug: enters tile placement mode for the selected tile, computing valid placement options. */
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

  /* [DEBUG] [TILE-PLACEMENT] Debug: cancels tile placement mode and clears the selected placement key. */
  function cancelDebugPlacementMode() {
    setDebugPlacementModeActive(false);
    setDebugSelectedPlacementKey("");
  }

  /* [DEBUG] [EVENT] Debug: triggers a specific event card for the chosen player, removing it from the event deck. */
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

  /* [DEBUG] [CARD-DECK] Debug: adds a specific item or omen card to the chosen player's inventory/omens. */
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

  /* [DEBUG] [CARD-DECK] Debug: removes a card from a player's inventory or omens and returns it to the deck. */
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

  /* [DEBUG] [HAUNT-SETUP] Debug: starts a specific haunt with the chosen traitor player. */
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
    if (
      debugModeEnabled ||
      game.gamePhase === GAME_PHASES.HAUNT_SETUP ||
      game.gamePhase === GAME_PHASES.GAME_OVER ||
      gameplayLockedByHauntPendingChoice
    )
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
    if (!isMyTurn) return;
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

        // Discovering any tile always ends the turn
        nextPlayers = nextPlayers.map((pl, i) => (i === g.currentPlayerIndex ? { ...pl, movesLeft: 0 } : pl));
        if (turnPhase === "move") {
          message = `${p.name} discovered ${placedTile.name}. Turn ended.`;
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
          postDiscovery: true,
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

  /* [MOVEMENT] Uses a secret passage to move the current player to the target tile. */
  function handleUseSecretPassage(target) {
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP || game.gamePhase === GAME_PHASES.GAME_OVER)
      return;
    setGame((g) => resolveSecretPassageMoveState({ game: g, target, getTileAtPosition }));
    setCameraFloor(target.floor);
  }

  // End turn
  function handleEndTurn() {
    if (hasUnconfirmedMovePathState(game)) return;
    if (
      debugModeEnabled ||
      game.gamePhase === GAME_PHASES.HAUNT_SETUP ||
      game.gamePhase === GAME_PHASES.GAME_OVER ||
      gameplayLockedByHauntPendingChoice
    )
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
      return { ...resolved.game, postDiscovery: false };
    });

    if (nextDiceAnimation) {
      setDiceAnimation(nextDiceAnimation);
    }
    if (nextCameraFloor) {
      setCameraFloor(nextCameraFloor);
    }
  }

  /* [STAT-CHANGE] Local wrapper for applyStatChangeState. Used as a callback by combat, event, and haunt resolution. */
  function applyStatChange(players, playerIndex, stat, amount, options = {}) {
    return applyStatChangeState(players, playerIndex, stat, amount, options);
  }

  /* [DAMAGE] Local wrapper for applyDamageAllocationState. Used by damage confirmation logic. */
  function applyDamageAllocation(players, playerIndex, allocation, adjustmentMode = "decrease", options = {}) {
    return applyDamageAllocationState(players, playerIndex, allocation, adjustmentMode, options);
  }

  /* [COMBAT] Initiates combat against the chosen defender using no source card (melee). */
  function handleStartCombat(defenderIndex) {
    handleStartCombatWithSource(defenderIndex, null);
  }

  /* [COMBAT] Initiates combat against a defender, optionally using a weapon card as the source. */
  function handleStartCombatWithSource(defenderIndex, sourceCard) {
    if (hasUnconfirmedMovePathState(game)) return;
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP) return;

    setGame((g) => {
      const action = sourceCard?.activeAbilityRule?.action;
      const targets = getCombatItemTargets(g, action, getTileAtPosition);
      if (!targets.some((target) => target.playerIndex === defenderIndex)) return g;

      const attacker = g.players[g.currentPlayerIndex];
      const defender = g.players[defenderIndex];
      const attackerProxy = getHauntCombatActorProxyState(g, g.currentPlayerIndex);
      const defenderProxy = getHauntCombatActorProxyState(g, defenderIndex);
      const attackerDisplayName = attackerProxy?.name ?? attacker.name;
      const defenderDisplayName = defenderProxy?.name ?? defender.name;
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

      const defenderDefenseBonus = defenderProxy ? { amount: 0, sourceNames: [] } : getDefenseRollDiceBonus(defender);

      return {
        ...g,
        players: nextPlayers,
        hasAttackedThisTurn: true,
        combatState: {
          phase: "attacker-roll",
          attackerIndex: g.currentPlayerIndex,
          defenderIndex,
          attackerName: attackerDisplayName,
          defenderName: defenderDisplayName,
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
            preRollBonusDice: defenderDefenseBonus.amount,
            preRollFlatBonus: 0,
            preRollItemMessages:
              defenderDefenseBonus.amount > 0
                ? [`${defenderDefenseBonus.sourceNames.join(", ")}: +${defenderDefenseBonus.amount} defense die`]
                : [],
            bonusDiceIndexes: [],
          },
          outcome: null,
        },
        message: `${attackerDisplayName} attacks ${defenderDisplayName}.`,
      };
    });
  }

  /* [COMBAT-ROLL] [DICE-ROLL] Rolls dice for the attacker or defender, applying trait bonuses, haunt bonuses, and pre-roll item bonuses. */
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
    const defenseBonus = { amount: 0, sourceNames: [] };
    const baseStatDiceCount =
      rollStat === "sanity"
        ? getPlayerSanityDiceCount(actor)
        : rollStat === "speed"
          ? getPlayerSpeedDiceCount(actor)
          : getPlayerMightDiceCount(actor);
    const baseDiceCount =
      actorProxy?.statDiceCounts?.[rollStat] ??
      actorProxy?.usesMightDiceCount ??
      baseStatDiceCount + defenseBonus.amount;
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
    const hauntKnowledgeBonus = getHauntCombatBonus(game, actorIndex, opponentIndex, role);
    if (hauntKnowledgeBonus > 0) {
      itemMessages.push(`+${hauntKnowledgeBonus} to roll from Knowledge of Jack.`);
    }
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

  /* [COMBAT] [ITEM-ABILITY] Applies a combat item bonus (extra die, flat bonus, or Speed-for-dice trade) during the item phase. */
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

  /* [COMBAT] Advances combat after the attacker's item phase; transitions to defender-roll. */
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

  /* [COMBAT] Computes combat outcome after defender's item phase and transitions to resolution. */
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

      const loserProxy = loserIndex != null ? getHauntCombatActorProxyState(g, loserIndex) : null;
      const winnerProxy = winnerIndex != null ? getHauntCombatActorProxyState(g, winnerIndex) : null;
      const loserIsProxy = !!loserProxy;
      const outcome = {
        tie,
        attackerTotal,
        defenderTotal,
        winnerIndex,
        loserIndex,
        loserIsProxy,
        damage,
        winnerName: winnerProxy?.name ?? (winnerIndex != null ? g.players[winnerIndex]?.name || "Winner" : "No one"),
        loserName: loserProxy?.name ?? (loserIndex != null ? g.players[loserIndex]?.name || "Loser" : "No one"),
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

  /* [COMBAT] [DAMAGE] Applies combat damage and clears combatState; ties or zero-damage outcomes skip damage choice. */
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

      const loserIsProxy = !!getHauntCombatActorProxyState(g, outcome.loserIndex);
      if (loserIsProxy) {
        return {
          ...g,
          combatState: null,
          message: `${outcome.winnerName} wins (${outcome.attackerTotal} vs ${outcome.defenderTotal}). ${outcome.loserName} cannot be harmed.`,
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
    getHauntDefinitionById,
    startSelectedHauntState,
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
    isMyTurn,
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

  /* [DAMAGE] Increments or decrements a stat in the damage allocation by delta. */
  function handleAdjustDamageAllocation(stat, delta) {
    setGame((g) =>
      adjustDamageAllocationChoiceState(g, stat, delta, {
        getPostDamageEffectsForChoice,
      })
    );
  }

  /* [DAMAGE] [ITEM-PASSIVE] Toggles damage conversion between physical and general (e.g. Brooch of Blood). */
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

  /* [DAMAGE] [ITEM-PASSIVE] Local wrapper for applyPostDamagePassiveEffectsState (Strange Amulet, etc.). */
  function applyPostDamagePassiveEffects(players, playerIndex, choice) {
    return applyPostDamagePassiveEffectsState(players, playerIndex, choice, {
      applyStatChange,
      statLabels: STAT_LABELS,
    });
  }

  /* [DAMAGE] [STAT-CHANGE] Confirms damage allocation: applies stat changes, post-damage effects, and optionally passes the turn. */
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

  /* [DAMAGE] Local wrapper for getDamagePreviewState; returns projected stat values for the damage allocation UI. */
  function getDamagePreview(player, choice) {
    return getDamagePreviewState(player, choice);
  }

  /* [OMEN] [DICE-ANIMATION] [DEATH] Starts the 3-die Skull omen death-intercept roll animation. */
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

  /* [OMEN] [DEATH] [PLAYER-STATE] Revives the player after passing the Skull omen challenge, setting all stats to Critical. */
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

  /* [OMEN] [DEATH] [DAMAGE] Kills the player after failing the Skull omen challenge, applying the queued damage choice. */
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

  /* [PLAYER-STATE] Local wrapper for getStatTrackCellClassState; returns CSS class for a stat track cell. */
  function getStatTrackCellClass(index, currentIndex, previewIndex, adjustmentMode = "decrease") {
    return getStatTrackCellClassState(index, currentIndex, previewIndex, adjustmentMode);
  }

  /* [DICE-ROLL] [TILE-EFFECT] Rolls Speed dice (with defense bonus) for the next player in the Dynamite queue. */
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

  /* [DICE-ANIMATION] [TILE-EFFECT] Processes the settled Dynamite roll result and advances to the next target or clears state. */
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

  /* [TILE-EFFECT] Clears the dynamite state (e.g. after all targets have rolled). */
  function handleClearDynamiteState() {
    setGame((g) => ({ ...g, dynamiteState: null }));
  }

  /* [TILE-EFFECT] Continue button for tile effects: dismisses and optionally passes the turn. */
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

  /* [ITEM-ABILITY] [STAT-CHANGE] Picks a stat for the Necklace of Teeth end-of-turn critical stat gain. */
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

  /* [OMEN] [EVENT] [TILE-EFFECT] Draws the event card queued by the Idol omen tile effect. */
  function handleDrawIdolEventCard() {
    setGame((g) => applyDrawIdolEventCardState(g));
  }

  /* [OMEN] [TILE-EFFECT] Skips the Idol-queued event card draw (player chooses not to use it). */
  function handleSkipIdolEventCard() {
    setGame((g) => applySkipIdolEventCardState(g));
  }

  /* [ITEM-ABILITY] Skips the Necklace of Teeth end-of-turn critical stat gain and passes the turn. */
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

  /* [DICE-ROLL] [TILE-EFFECT] Rolls two dice for Mystic Elevator floor selection and shows the result. */
  function handleRollMysticElevator() {
    if (hasUnconfirmedMovePathState(game)) return;
    const rollState = getRollMysticElevatorState(game, rollDice);
    if (!rollState) return;

    setGame(rollState.game);
    setDiceAnimation(rollState.diceAnimation);
  }

  /* [DICE-ROLL] [TILE-EFFECT] Rolls Speed to check Collapsed Room stability; supports Book/Magic Camera stat substitutions and Angel's Feather overrides. */
  function handleRollCollapsedStability() {
    const te = game.tileEffect;
    if (!te || te.type !== "collapsed-prompt") return;
    const playerIndex = te.playerIndex ?? game.currentPlayerIndex;
    const player = game.players[playerIndex];

    const override = queuedTraitRollOverrideRef.current;
    let roll;
    let stat = "speed";

    if (override?.kind === "substitute-stat") {
      // Book / Magic Camera substituted a different stat for the roll
      stat = override.to || stat;
      const targetVal = player.character[stat]?.[player.statIndex?.[stat]] ?? te.diceCount;
      roll = resolveTraitRoll(player, {
        stat,
        baseDiceCount: targetVal,
        context: "end-of-turn",
        board: game.board,
      });
      setQueuedTraitRollOverride(null);
    } else {
      roll = resolveTraitRoll(player, {
        stat,
        baseDiceCount: te.diceCount,
        context: "end-of-turn",
        board: game.board,
      });
    }

    let resolvedTotal = roll.total;
    if (override?.kind === "set-total") {
      // Angel's Feather / similar item forced the total
      resolvedTotal = Math.max(0, Math.min(8, Number(override.total)));
      setQueuedTraitRollOverride(null);
    }

    const createRollToken = () => `${Date.now()}-${Math.random()}`;
    setGame((g) => ({ ...g, tileEffect: null, message: `${te.tileName} — rolling for stability...` }));
    setDiceAnimation({
      purpose: "collapsed",
      token: createRollToken(),
      final: roll.dice,
      display: Array.from({ length: roll.dice.length }, () => Math.floor(Math.random() * 3)),
      tileName: te.tileName,
      playerIndex,
      modifier: roll.modifier,
      resolvedTotal,
      settled: false,
    });
  }

  /* [DICE-ANIMATION] [TILE-EFFECT] Processes the settled Collapsed stability roll: advances turn on pass, shows collapsed-pending on fail. */
  function handleContinueCollapsedRoll() {
    const hauntRoll = game.hauntActionRoll;
    if (!hauntRoll?.isCollapsedRoll) return;
    const lastRoll = hauntRoll.lastRoll;
    const total = lastRoll.total;

    if (total >= 5) {
      // Pass: advance turn immediately — no need for the redundant "The floor holds!" intermediate step
      let passTurnCameraFloor = null;
      setGame((g) => {
        const base = { ...g, hauntActionRoll: null, tileEffect: null };
        const passTurnResult = resolvePassTurnActionState(base, {
          resolveEndTurnItemPassiveState,
          statLabels: STAT_LABELS,
        });
        passTurnCameraFloor = passTurnResult.cameraFloor;
        return resolveHauntAfterDamageState(g, passTurnResult.game);
      });
      if (passTurnCameraFloor) {
        setCameraFloor(passTurnCameraFloor);
      }
      return;
    }

    // Fail: show "collapsed-pending" so player can roll for damage
    const syntheticAnimation = {
      purpose: "collapsed",
      resolvedTotal: total,
      final: lastRoll.dice,
      modifier: lastRoll.modifier,
      playerIndex: hauntRoll.playerIndex,
      tileName: hauntRoll.tileName,
    };
    const baseTotal = (lastRoll.dice || []).reduce((a, b) => a + b, 0);
    setGame((g) => {
      const updated = { ...g, hauntActionRoll: null, tileEffect: null };
      return (
        resolveTileDiceAnimationState({
          game: updated,
          animation: syntheticAnimation,
          baseTotal,
          getDamageReduction,
          createDiceModifier,
        }) || updated
      );
    });
  }

  /* [DICE-ROLL] [TILE-EFFECT] [DAMAGE] Rolls 1 die for Furnace Room physical damage and starts the damage animation. */
  function handleRollFurnaceDamage() {
    const te = game.tileEffect;
    if (!te || te.type !== "furnace-prompt") return;
    const playerIndex = te.playerIndex ?? game.currentPlayerIndex;
    const player = game.players[playerIndex];
    const finalDice = rollDice(1);
    const damageReduction = getDamageReduction(player, "physical");
    setGame((g) => ({ ...g, tileEffect: null }));
    setDiceAnimation({
      purpose: "furnace",
      token: `${Date.now()}-${Math.random()}`,
      final: finalDice,
      display: [Math.floor(Math.random() * 3)],
      tileName: te.tileName,
      playerIndex,
      modifier: createDiceModifier({
        amount: damageReduction.amount,
        sourceNames: damageReduction.sourceNames,
        sign: "-",
        labelPrefix: "blocked by",
      }),
      settled: false,
    });
  }

  /* [DICE-ROLL] [TILE-EFFECT] [DAMAGE] Rolls 1 die for Collapsed Room damage after failing the stability check. */
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

  /* [TILE-PLACEMENT] Selects the placement slot for a pending special tile (e.g. Spirit Board). */
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

  /* [TILE-PLACEMENT] Cycles the rotation of the pending special tile in the chosen direction. */
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

  /* [TILE-PLACEMENT] Confirms the pending special tile placement and adds the tile to the board. */
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

  /* [SIDEBAR] Expands or collapses a player's entry in the sidebar. */
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

  /* [CARD-DISPLAY] Opens the viewed-card panel for an owned item or omen card. */
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

  /* [ITEM-ABILITY] Triggers the "Use Now" flow for the currently viewed card's active ability. */
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

  /* [ITEM-ABILITY] Confirms a value selection for an active ability that requires a value (Angel's Feather total, Lucky Coin target). */
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

  /* [CARD-DISPLAY] Closes the viewed card panel. */
  function handleCloseViewedCard() {
    setViewedCard(null);
  }

  /* [COMBAT] [CARD-DISPLAY] Starts combat from the weapon card viewer, closing the viewer afterward. */
  function handleStartCombatFromViewedCard(defenderIndex) {
    if (!viewedCard) return;
    if (viewedCard.ownerIndex !== game.currentPlayerIndex) return;
    if (viewedCard.activeAbilityRule?.trigger !== "attack") return;

    handleStartCombatWithSource(defenderIndex, viewedCard);
    setViewedCard(null);
  }

  /* [TRADE] Starts a Dog-mediated remote trade with a target player. */
  function handleStartDogTrade(targetPlayerIndex) {
    if (hasUnconfirmedMovePathState(game)) return;
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP) return;
    setTradeState((prev) => resolveStartTradeSelectionState(prev, targetPlayerIndex));
  }

  /* [TRADE] Starts a direct local player-to-player trade for players on the same tile. */
  function handleStartPlayerTrade(targetPlayerIndex) {
    if (hasUnconfirmedMovePathState(game)) return;
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP) return;
    setTradeState((prev) => {
      if (prev) return prev;
      return createLocalPlayerTradeState(game, game.currentPlayerIndex, targetPlayerIndex);
    });
  }

  /* [TRADE] [MOVEMENT] Moves the dog token one step during the trade movement phase. */
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

  /* [TRADE] Returns to the dog movement phase from the trade item selection phase. */
  function handleBackToDogMove() {
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP) return;
    setTradeState((prev) => resolveBackToTradeMoveState(prev));
  }

  /* [TRADE] Toggles an item in the trade owner's give list. */
  function handleToggleDogOwnerGive(index) {
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP) return;
    setTradeState((prev) => resolveToggleTradeOwnerGiveState(prev, game, index));
  }

  /* [TRADE] Toggles an item in the trade target's give list. */
  function handleToggleDogTargetGive(index) {
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP) return;
    setTradeState((prev) => resolveToggleTradeTargetGiveState(prev, game, index));
  }

  /* [TRADE] Toggles an omen in the trade owner's give list. */
  function handleToggleDogOwnerGiveOmen(index) {
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP) return;
    setTradeState((prev) => resolveToggleTradeOwnerGiveOmenState(prev, game, index));
  }

  /* [TRADE] Toggles an omen in the trade target's give list. */
  function handleToggleDogTargetGiveOmen(index) {
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP) return;
    setTradeState((prev) => resolveToggleTradeTargetGiveOmenState(prev, game, index));
  }

  /* [TRADE] Cancels the in-progress dog trade and resets trade state. */
  function handleCancelDogTrade() {
    if (hasUnconfirmedMovePathState(game)) return;
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP) return;
    setTradeState(null);
  }

  /* [HAUNT-ACTION] Decrements the force-explosives count stepper. */
  function handleForceExplosivesDecrement() {
    setGame((g) =>
      resolveHauntActionState(g, { actionId: "force-explosives-count-decrement", resolveTraitRoll, createDamageChoice })
    );
  }

  /* [HAUNT-ACTION] Increments the force-explosives count stepper. */
  function handleForceExplosivesIncrement() {
    setGame((g) =>
      resolveHauntActionState(g, { actionId: "force-explosives-count-increment", resolveTraitRoll, createDamageChoice })
    );
  }

  /* [TRADE] Sets how many Explosives (or other haunt tokens) the trade owner will offer. */
  function handleSetOwnerGiveExplosiveCount(newCount, maxCount) {
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP) return;
    setTradeState((prev) => resolveSetTradeExplosiveCountState(prev, "owner", newCount, maxCount));
  }

  /* [TRADE] Sets how many Explosives (or other haunt tokens) the trade target will offer. */
  function handleSetTargetGiveExplosiveCount(newCount, maxCount) {
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP) return;
    setTradeState((prev) => resolveSetTradeExplosiveCountState(prev, "target", newCount, maxCount));
  }

  /* [TRADE] Confirms the dog trade, transferring items between players. */
  function handleConfirmDogTrade() {
    if (debugModeEnabled || game.gamePhase === GAME_PHASES.HAUNT_SETUP) return;
    const result = resolveConfirmTradeActionState(game, tradeState);
    setGame(result.nextGame);
    setTradeState(result.nextTradeState);
  }

  /* [HAUNT-SETUP] Advances to the next page of the haunt rules booklet. */
  function handleAdvanceHauntRules() {
    setGame((g) => advanceHauntRulesViewState(g));
  }

  /* [HAUNT-SETUP] Closes the haunt rules overlay and begins the haunt phase. */
  function handleBeginHauntAfterRules() {
    let nextCameraFloor = null;

    setGame((g) => {
      const nextState = completeHauntSetupState(g, { getHauntDefinitionById });
      const activePlayer = nextState.players[nextState.currentPlayerIndex];
      nextCameraFloor = activePlayer?.floor || null;
      return nextState;
    });

    if (nextCameraFloor) {
      setCameraFloor(nextCameraFloor);
    }
  }

  /* [HAUNT-ACTION] [DICE-ROLL] Dispatches a haunt action button press, rolling dice if the action requires a trait roll. */
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

  /* [HAUNT-ACTION] Continue button after a haunt action roll settles; applies roll outcome and advances haunt state. */
  function handleContinueHauntActionRoll() {
    setGame((g) =>
      resolveHauntActionRollContinueState(g, {
        createDamageChoice,
      })
    );
  }

  /* [ITEM-REROLL] [DICE-ROLL] Selects which die index will be rerolled by the Rabbit's Foot. */
  function handleSelectRabbitFootDie(dieIndex) {
    setGame((g) => chooseRabbitFootDieState(g, dieIndex));
  }

  /* [ITEM-REROLL] [DICE-ANIMATION] Applies the Rabbit's Foot reroll for the selected die and starts the dice animation. */
  function handleConfirmRabbitFootReroll() {
    const result = applyRabbitFootRerollState(game);
    setGame(result.game);
    if (result.diceAnimation) {
      setDiceAnimation(result.diceAnimation);
    }
  }

  const validMoves = isMyTurn && cameraFloor === currentPlayer.floor ? getValidMoves() : [];
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
  const isFloodTileChoiceActive = hauntPendingChoice?.type === "flood-tile-selection";
  const floodTileChoiceOptions = isFloodTileChoiceActive ? hauntPendingChoice.options || [] : [];
  const isCueOminousMusicChoiceActive = hauntPendingChoice?.type === "cue-ominous-music-placement";
  const cueOminousMusicTileChoiceOptions = isCueOminousMusicChoiceActive ? hauntPendingChoice.options || [] : [];
  const selectedCueOminousMusicTileChoiceId = isCueOminousMusicChoiceActive
    ? hauntPendingChoice.selectedOptionId || null
    : null;
  const isEventTileChoiceActive = eventState?.awaiting?.type === "tile-choice";
  const boardTileChoiceOptions = isEventTileChoiceActive
    ? eventTileChoiceOptions
    : isStalkPreyTileChoiceActive
      ? stalkPreyTileChoiceOptions
      : isCueOminousMusicChoiceActive
        ? cueOminousMusicTileChoiceOptions
        : floodTileChoiceOptions;
  const selectedBoardTileChoiceId = isEventTileChoiceActive
    ? selectedEventTileChoiceId
    : isCueOminousMusicChoiceActive
      ? selectedCueOminousMusicTileChoiceId
      : selectedStalkPreyTileChoiceId;
  const isBoardTileChoiceActive =
    isEventTileChoiceActive || isStalkPreyTileChoiceActive || isFloodTileChoiceActive || isCueOminousMusicChoiceActive;

  /* [EVENT-TILE-CHOICE] [HAUNT-ACTION] Handles clicking a board tile-choice target (event tile-choice, stalk-prey, or flood tile). */
  function handleBoardTileChoice(option) {
    if (isEventTileChoiceActive) {
      handleEventTileChoice(option);
      return;
    }
    if (isStalkPreyTileChoiceActive && option?.id) {
      handleUseHauntAction(`pending-select-stalk-prey:${option.id}`);
      return;
    }
    if (isCueOminousMusicChoiceActive && option?.id) {
      handleUseHauntAction(`pending-select-cue-ominous-music:${option.id}`);
      return;
    }
    if (isFloodTileChoiceActive && option?.id) {
      handleUseHauntAction(`pending-flood-tile:${option.id}`);
    }
  }

  /* [EVENT-TILE-CHOICE] [HAUNT-ACTION] Confirms the selected board tile choice (event, stalk-prey, or cue ominous music). */
  function handleConfirmBoardTileChoice() {
    if (isEventTileChoiceActive) {
      handleConfirmEventTileChoice();
      return;
    }
    if (isStalkPreyTileChoiceActive) {
      handleUseHauntAction("confirm-stalk-prey-placement");
      return;
    }
    if (isCueOminousMusicChoiceActive) {
      handleUseHauntAction("confirm-cue-ominous-music");
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
    const player = game.players[game.currentPlayerIndex];
    if (player?.floor) {
      setCameraFloor(player.floor);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.currentPlayerIndex, game.turnNumber]);

  // Recovery: if game is stuck with "rolling for stability" or "rolling for damage" message
  // but no dice animation running (animation was lost due to a race condition), re-trigger the roll.
  useEffect(() => {
    if (diceAnimation) return;
    if (game.tileEffect) return;
    const isFurnaceStuck = game.message.includes("Furnace Room") && game.message.includes("rolling for damage");
    const isCollapsedStuck = game.message.endsWith("— rolling for stability...");
    if (!isFurnaceStuck && !isCollapsedStuck) return;
    const currentPlayer = game.players[game.currentPlayerIndex];
    if (!currentPlayer) return;
    const currentTile = game.board[currentPlayer.floor]?.find(
      (t) => t.x === currentPlayer.x && t.y === currentPlayer.y
    );
    if (isCollapsedStuck && currentTile?.endOfTurn !== "collapsed") return;
    if (isFurnaceStuck && currentTile?.endOfTurn !== "furnace") return;

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
      nextDiceAnimation = resolved.diceAnimation;
      return resolved.game;
    });
    if (nextDiceAnimation) setDiceAnimation(nextDiceAnimation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diceAnimation, game.tileEffect, game.message, game.currentPlayerIndex]);

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

  // Haunt 28 shark token position
  const sharkToken =
    game.activeHauntId === "haunt_28" && game.hauntState?.scenarioState?.ghostShark?.active
      ? game.hauntState.scenarioState.ghostShark
      : null;

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

      <DiceBox diceAnimation={diceAnimation} lastSettled={lastSettledRoll} />

      {/* Board */}
      <BoardCanvas
        boardRef={boardRef}
        cameraFloor={cameraFloor}
        game={game}
        currentPlayer={currentPlayer}
        floorTiles={floorTiles}
        playersOnFloor={playersOnFloor}
        sharkToken={sharkToken}
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
        isMyTurn={isMyTurn}
        currentTurnPlayerName={game.players[game.currentPlayerIndex]?.name ?? ""}
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
        isMyTurn={isMyTurn}
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

      <ForceExplosivesOverlay
        pendingChoice={
          hauntPendingChoiceType === "force-explosives-count" ? game.hauntState?.scenarioState?.pendingChoice : null
        }
        onDecrement={handleForceExplosivesDecrement}
        onIncrement={handleForceExplosivesIncrement}
        onConfirm={() => handleUseHauntAction("force-explosives-count-confirm")}
      />

      <TradeViewer
        game={game}
        tradeState={tradeState}
        hauntTradeTokens={
          tradeState?.mode === "player-local"
            ? getHauntTradeableTokensState(game, tradeState.ownerIndex, tradeState.targetPlayerIndex)
            : null
        }
        actionsDisabled={gameplayUiLocked}
        handlers={{
          handleToggleDogOwnerGive,
          handleToggleDogOwnerGiveOmen,
          handleToggleDogTargetGive,
          handleToggleDogTargetGiveOmen,
          handleConfirmDogTrade,
          handleBackToDogMove,
          handleCancelDogTrade,
          handleSetOwnerGiveExplosiveCount,
          handleSetTargetGiveExplosiveCount,
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
          isMyTurn={isMyTurn}
          currentTurnPlayerName={currentPlayer?.name ?? ""}
        />
      )}

      <HauntActionRollOverlay
        game={game}
        diceAnimation={diceAnimation}
        hauntActionRollPreview={hauntActionRollPreview}
        onContinue={handleContinueHauntActionRoll}
        renderDiceRow={(props) => <DiceRow {...props} />}
        isMyTurn={isMyTurn}
      />

      <DiceRollOverlay
        diceAnimation={diceAnimation}
        renderDiceRow={(props) => <DiceRow {...props} />}
        isMyTurn={isMyTurn}
      />

      <HauntRollOverlay
        game={game}
        diceAnimation={diceAnimation}
        onDismissHauntRoll={handleDismissHauntRoll}
        renderDiceRow={(props) => <DiceRow {...props} />}
        isMyTurn={isMyTurn}
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
        onRollCollapsedStability={handleRollCollapsedStability}
        onContinueCollapsedRoll={handleContinueCollapsedRoll}
        onStartCollapsedDamage={handleStartCollapsedDamage}
        onRollFurnaceDamage={handleRollFurnaceDamage}
        onDismissTileEffect={handleDismissTileEffect}
        isMyTurn={isMyTurn}
        currentTurnPlayerName={currentPlayer?.name ?? ""}
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
        myPlayerIndex={onlineConfig?.myPlayerIndex ?? -1}
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
        isMyDamage={onlineConfig == null || onlineConfig.myPlayerIndex === damageChoicePlayerIndex}
      />

      {game.skullChallenge &&
        !(diceAnimation && diceAnimation.purpose === "skull-roll" && !diceAnimation.settled) &&
        (() => {
          const sc = game.skullChallenge;
          const player = game.players[sc.playerIndex];
          const rolled = sc.roll !== null;
          const survived = rolled && sc.total >= 4;
          const isSkullPlayer = onlineConfig == null || onlineConfig.myPlayerIndex === sc.playerIndex;
          if (!isSkullPlayer) {
            // Spectator: show mini peek
            const statusLabel = !rolled
              ? `${player?.name} must use the Skull…`
              : survived
                ? `${player?.name} survived the Skull!`
                : `${player?.name} failed the Skull roll.`;
            return (
              <div className="mini-peek mini-peek-skull">
                <span className="mini-peek-icon">☠</span>
                <span className="mini-peek-label">
                  {statusLabel}
                  {rolled ? ` (${sc.total})` : ""}
                </span>
              </div>
            );
          }
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
