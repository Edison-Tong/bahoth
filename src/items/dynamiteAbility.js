import { DAMAGE_STATS } from "../game/gameState";
import { getDamageConversionOptions, getPostDamageEffectsForChoice } from "./passiveItemEffectAbility";

const DYNAMITE_DAMAGE = 4;
const DYNAMITE_DAMAGE_TYPE = "physical";
const DYNAMITE_SAFE_THRESHOLD = 4;

function getInventoryCard(game, viewedCard) {
  if (!viewedCard || viewedCard.ownerCollection !== "inventory") return null;
  const owner = game.players[viewedCard.ownerIndex];
  return owner?.inventory?.[viewedCard.ownerCardIndex] || null;
}

/**
 * Activates the Dynamite item: discards it, sets hasAttackedThisTurn, and
 * opens a tile-choice awaiting state (own tile + door-adjacent tiles).
 *
 * deps: { getMovementNeighbors, getTileByPosition }
 */
export function applyDynamiteNowState(g, viewedCard, deps = {}) {
  const { getMovementNeighbors, getTileByPosition } = deps;

  if (!viewedCard) return { game: g, closeViewedCard: false, diceAnimation: null };
  if (viewedCard.activeAbilityRule?.action !== "dynamite-aoe-attack") {
    return { game: g, closeViewedCard: false, diceAnimation: null };
  }
  if (viewedCard.ownerCollection !== "inventory") {
    return { game: g, closeViewedCard: false, diceAnimation: null };
  }
  if (viewedCard.ownerIndex !== g.currentPlayerIndex) {
    return { game: g, closeViewedCard: false, diceAnimation: null };
  }
  if (g.gamePhase !== "hauntActive") {
    return { game: g, closeViewedCard: false, diceAnimation: null };
  }
  if (g.hasAttackedThisTurn) {
    return { game: g, closeViewedCard: false, diceAnimation: null };
  }

  const inventoryCard = getInventoryCard(g, viewedCard);
  if (!inventoryCard) return { game: g, closeViewedCard: false, diceAnimation: null };

  const owner = g.players[viewedCard.ownerIndex];
  const ownerPos = { floor: owner.floor, x: owner.x, y: owner.y };
  const ownKey = `${owner.floor}:${owner.x}:${owner.y}`;

  const options = [{ id: ownKey, floor: owner.floor, x: owner.x, y: owner.y, label: "Your tile" }];

  if (getMovementNeighbors && getTileByPosition) {
    const neighbors = getMovementNeighbors(g.board, ownerPos, { ignoreObstacles: true });
    for (const nb of neighbors) {
      const nbKey = `${nb.floor}:${nb.x}:${nb.y}`;
      if (!options.some((o) => o.id === nbKey)) {
        const tile = getTileByPosition(g.board, nb.floor, nb.x, nb.y);
        const label = tile?.name || "Adjacent tile";
        options.push({ id: nbKey, floor: nb.floor, x: nb.x, y: nb.y, label });
      }
    }
  }

  // Discard dynamite from owner's inventory
  const nextPlayers = g.players.map((player, index) =>
    index === viewedCard.ownerIndex
      ? {
          ...player,
          inventory: player.inventory.filter((_, cardIndex) => cardIndex !== viewedCard.ownerCardIndex),
        }
      : player
  );

  return {
    game: {
      ...g,
      players: nextPlayers,
      hasAttackedThisTurn: true,
      eventState: {
        ...g.eventState,
        awaiting: {
          type: "tile-choice",
          source: "item-active-ability",
          effect: { type: "dynamite-throw", attackerPlayerIndex: g.currentPlayerIndex },
          options,
          selectedOptionId: null,
          sourceName: inventoryCard.name,
        },
      },
      message: `${owner.name} throws Dynamite! Choose a tile.`,
    },
    closeViewedCard: true,
    diceAnimation: null,
  };
}

/**
 * Builds an event state that signals "Speed roll required" for a given player.
 * Used to make pre-roll items (Angel's Feather) and post-roll items
 * (Lucky Coin, Creepy Doll, Rabbit's Foot) available during dynamite rolls.
 */
export function buildDynamiteRollReadyEventState(g, playerIndex) {
  const player = g.players[playerIndex];
  if (!player) return null;
  const speedStat = player.statIndex?.speed ?? 0;
  const baseDiceCount = Math.max(player.character?.speed?.[speedStat] || 0, 1);
  return {
    card: { name: "Dynamite", id: "dynamite" },
    stepIndex: 0,
    context: {},
    pendingEffects: [],
    awaiting: {
      type: "roll-ready",
      rollKind: "trait-roll",
      rollStat: "speed",
      baseDiceCount,
      outcomes: [],
      source: "dynamite",
    },
    summary: null,
    lastRoll: null,
  };
}

/**
 * Called after the player picks a tile. Builds the dynamite roll queue
 * (attacker first if on tile, then others in turn order).
 * Returns { dynamiteState, rollReadyEventState } where rollReadyEventState
 * enables pre-roll and post-roll items for the first player in the queue.
 */
export function buildDynamiteThrowState(g, floor, x, y) {
  const attackerPlayerIndex = g.currentPlayerIndex;
  const numPlayers = g.players.length;
  const queue = [];

  for (let i = 0; i < numPlayers; i++) {
    const pi = (attackerPlayerIndex + i) % numPlayers;
    const player = g.players[pi];
    if (player?.isAlive && player.floor === floor && player.x === x && player.y === y) {
      queue.push(pi);
    }
  }

  const dynamiteState = {
    targetFloor: floor,
    targetX: x,
    targetY: y,
    attackerPlayerIndex,
    queue,
    results: [],
  };
  const rollReadyEventState = queue.length > 0 ? buildDynamiteRollReadyEventState(g, queue[0]) : null;
  return { dynamiteState, rollReadyEventState };
}

/**
 * Processes a single speed roll result for the first player in the queue.
 * Returns the updated game state (with either a damageChoice set, or just
 * the queue advanced for a safe roll). Clears dynamiteState if queue
 * becomes empty after a safe roll.
 */
export function advanceDynamiteRollState(g, playerIndex, rollArray, precomputedTotal = null) {
  const dynamiteState = g.dynamiteState;
  if (!dynamiteState) return g;

  const player = g.players[playerIndex];
  const total = precomputedTotal != null ? precomputedTotal : rollArray.reduce((sum, d) => sum + d, 0);
  const safe = total >= DYNAMITE_SAFE_THRESHOLD;

  const newResult = { playerIndex, name: player?.name || "Unknown", total, safe };
  const newResults = [...dynamiteState.results, newResult];
  const newQueue = dynamiteState.queue.slice(1);

  const nextDynamiteState =
    newQueue.length === 0 && safe
      ? null // all done, last player was safe
      : { ...dynamiteState, queue: newQueue, results: newResults };

  if (safe) {
    const safeMessage =
      newQueue.length === 0
        ? `${player?.name} rolls ${total} — escapes! Dynamite resolved.`
        : `${player?.name} rolls ${total} — escapes the blast!`;
    const nextEventState = newQueue.length > 0 ? buildDynamiteRollReadyEventState(g, newQueue[0]) : null;
    return {
      ...g,
      dynamiteState: nextDynamiteState,
      eventState: nextEventState,
      message: safeMessage,
    };
  }

  // Failed roll — set up damage choice
  const damageType = DYNAMITE_DAMAGE_TYPE;
  const allowedStats = DAMAGE_STATS[damageType];
  const allocation = Object.fromEntries(allowedStats.map((stat) => [stat, 0]));
  const conversionOptions = getDamageConversionOptions(player, damageType);

  const damageChoice = {
    source: "dynamite",
    effect: null,
    playerIndex,
    playerName: player?.name || "Unknown",
    originalDamageType: damageType,
    damageType,
    adjustmentMode: "decrease",
    amount: DYNAMITE_DAMAGE,
    allowedStats,
    allocation,
    canConvertToGeneral: conversionOptions.canConvertToGeneral,
    conversionSourceNames: conversionOptions.sourceNames,
    postDamageEffects: getPostDamageEffectsForChoice(player, {
      damageType,
      originalDamageType: damageType,
      allocation,
      amount: DYNAMITE_DAMAGE,
    }),
  };

  return {
    ...g,
    dynamiteState: { ...dynamiteState, queue: newQueue, results: newResults },
    damageChoice,
    eventState: null,
    message: `${player?.name} rolls ${total} — caught in the blast! Take ${DYNAMITE_DAMAGE} physical damage.`,
  };
}
