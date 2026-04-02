import { createEventDeck, createItemDeck, createOmenDeck } from "../cards";
import { STARTING_TILES, createTileStack } from "../tiles";
import { GAME_PHASES } from "../haunts/hauntDomain";

export const DIR = {
  N: { dx: 0, dy: -1 },
  S: { dx: 0, dy: 1 },
  E: { dx: 1, dy: 0 },
  W: { dx: -1, dy: 0 },
};

export const OPPOSITE = { N: "S", S: "N", E: "W", W: "E" };

export const DAMAGE_STATS = {
  physical: ["might", "speed"],
  mental: ["sanity", "knowledge"],
  general: ["might", "speed", "sanity", "knowledge"],
};

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

export const PLAYER_STAT_ORDER = ["might", "speed", "sanity", "knowledge"];
export const CRITICAL_STAT_INDEX = 1;
export const TILE_SIZE = 150;
export const GAP = 4;

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

export function createDrawnItemCard(card) {
  return { type: "item", ...card };
}

export function createDrawnOmenCard(card) {
  return { type: "omen", ...card };
}

export function createDrawnEventCard(card) {
  return { type: "event", ...card };
}

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

export function isStickyMessageBubble(message) {
  if (!message || !String(message).trim()) return false;
  return /^Now moving\b/i.test(String(message).trim());
}
