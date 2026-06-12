import { createEventDeck, createItemDeck, createOmenDeck } from "../cards";
import { STARTING_TILES, createTileStack } from "../tiles";
import { GAME_PHASES } from "../haunts/hauntDomain";

// Cardinal direction vectors for grid movement.
export const DIR = {
  N: { dx: 0, dy: -1 },
  S: { dx: 0, dy: 1 },
  E: { dx: 1, dy: 0 },
  W: { dx: -1, dy: 0 },
};

export const OPPOSITE = { N: "S", S: "N", E: "W", W: "E" };

// Maps damage types to the stat arrays they affect.
export const DAMAGE_STATS = {
  physical: ["might", "speed"],
  mental: ["sanity", "knowledge"],
  general: ["might", "speed", "sanity", "knowledge"],
};

// Human-readable labels and icons for each player stat; used throughout the UI.
export const STAT_LABELS = {
  might: "Might",
  speed: "Speed",
  sanity: "Sanity",
  knowledge: "Knowledge",
};

export const STAT_ICONS = {
  might: "💪",
  speed: "🏃",
  sanity: "🧠",
  knowledge: "📖",
};

// Canonical display order for stats and the index value that marks a stat as "critical".
export const PLAYER_STAT_ORDER = ["speed", "might", "knowledge", "sanity"];
export const CRITICAL_STAT_INDEX = 1;
// Pixel dimensions used when rendering board tiles on the canvas.
export const TILE_SIZE = 150;
export const GAP = 4;

/* [PLAYER-STATE] [BOARD-LAYOUT] Builds the full initial game state: shuffles decks, places starting tiles, and initialises each player at the Entrance with their starting speed as movesLeft. */
export function initGameState(players) {
  const tileStack = createTileStack();
  const itemDeck = createItemDeck();
  const omenDeck = createOmenDeck();
  const eventDeck = createEventDeck();

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
    gamePhase: GAME_PHASES.PRE_HAUNT,
    winnerTeam: null,
    activeHauntId: null,
    hauntState: null,
    hasAttackedThisTurn: false,
    hasMovedThisTurn: false,
    combatState: null,
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

/* [CARD-DISPLAY] Wraps a raw card object with a 'type' discriminator for the drawn-card display. */
export function createDrawnItemCard(card) {
  return { type: "item", ...card };
}

/* [CARD-DECK] [OMEN] Wraps a raw omen card with { type: "omen" } for use in player.omens. */
export function createDrawnOmenCard(card) {
  return { type: "omen", ...card };
}

/* [CARD-DECK] [EVENT] Wraps a raw event card with { type: "event" } for use as drawnCard. */
export function createDrawnEventCard(card) {
  return { type: "event", ...card };
}

/* [OVERLAY] [FORMAT] Returns false for routine move/rotate messages so the floating bubble stays hidden. */
export function shouldShowMessageBubble(message) {
  if (!message || !String(message).trim()) return false;

  const routinePatterns = [
    /\bmove(?:d|s)?\b/i,
    /\bmoves left\b/i,
    /\bno moves left\b/i,
    /rotate the tile, then place it/i,
    /turn\s*[-\u2014]/i,
  ];
  return !routinePatterns.some((pattern) => pattern.test(message));
}

/* [OVERLAY] [FORMAT] Returns true for "Now moving" messages that should linger longer in the bubble. */
export function isStickyMessageBubble(message) {
  if (!message || !String(message).trim()) return false;
  return /^Now moving\b/i.test(String(message).trim());
}
