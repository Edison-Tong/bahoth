import { GAME_PHASES, HAUNT_TEAMS } from "../core/hauntPhases";
import { STAT_LABELS } from "../../game/gameState";

// The set of starting tile IDs that can never be Flooded.
const STARTING_TILE_IDS = new Set(["entrance-hall", "hallway", "grand-staircase", "upper-landing", "basement-landing"]);

const GHOST_SHARK_SPEED_DICE = 2;
const MAX_EXPLOSIVES = 5;

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

/* [HAUNT-SETUP] Creates the clean starting scenario state for Haunt 28 (We're Going to Need a Bigger House). */
export function createInitialScenarioState() {
  return {
    ghostShark: {
      active: true,
      floor: null, // set during haunt setup completion
      x: null,
      y: null,
      movesLeft: 0,
      speedRoll: [],
      speedTotal: 0,
    },
    floodedTiles: [], // [{ floor, x, y }]
    playerExplosives: {}, // { [playerIndex]: count }
    pendingChoice: null,
    pendingForceExplosivesQueue: [], // remaining hero indexes to take damage after failed force attempt
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/* [PLAYER-STATE] Returns the current player object. */
function getCurrentPlayer(game) {
  return game.players[game.currentPlayerIndex] || null;
}

/* [LOOKUP] Returns the board tile at the current player's position. */
function getCurrentTile(game) {
  const player = getCurrentPlayer(game);
  if (!player) return null;
  return (game.board[player.floor] || []).find((t) => t.x === player.x && t.y === player.y) || null;
}

/* [HAUNT-ACTION] Creates a "turnNumber:playerIndex:actionId" string for once-per-turn gating. */
function createUsageKey(game, actionId) {
  return `${game.turnNumber}:${game.currentPlayerIndex}:${actionId}`;
}

/* [HAUNT-ACTION] Marks a haunt action usage key in hauntState. */
function markHauntActionUsed(hauntState, usageKey) {
  return {
    ...hauntState,
    oncePerTurnUsage: {
      ...(hauntState.oncePerTurnUsage || {}),
      [usageKey]: true,
    },
  };
}

/* [HAUNT-SETUP] Merges hauntState.scenarioState with defaults. */
function getScenarioState(hauntState) {
  const s = hauntState?.scenarioState || {};
  const defaults = createInitialScenarioState();
  return {
    ...defaults,
    ...s,
    ghostShark: s.ghostShark || defaults.ghostShark,
    floodedTiles: s.floodedTiles || defaults.floodedTiles,
    playerExplosives: s.playerExplosives || defaults.playerExplosives,
    pendingChoice: s.pendingChoice || null,
    pendingForceExplosivesQueue: s.pendingForceExplosivesQueue || [],
  };
}

/* [LOOKUP] Returns hero player indexes (all non-traitor). */
function getHeroIndexes(game) {
  if (!game.hauntState) return [];
  const traitorIndex = game.hauntState.traitorPlayerIndex;
  return game.players.map((_, i) => i).filter((i) => i !== traitorIndex);
}

/* [LOOKUP] Returns living hero indexes. */
function getLivingHeroIndexes(game) {
  return getHeroIndexes(game).filter((i) => game.players[i]?.isAlive);
}

/* [VALIDATION] Returns true if the given player index is a hero. */
function isHero(game, playerIndex) {
  return getHeroIndexes(game).includes(playerIndex);
}

/* [HAUNT-SETUP] Called once when the haunt begins: floods the traitor's starting tile and positions the shark there. */
export function onHauntBegin(game) {
  const scenarioState = getScenarioState(game.hauntState);
  const traitorIndex = game.hauntState.traitorPlayerIndex;
  const traitor = game.players[traitorIndex];
  if (!traitor) return null;
  const { floor, x, y } = traitor;
  const alreadyFlooded = isTileFlooded(scenarioState.floodedTiles, floor, x, y);
  const nextScenarioState = {
    ...scenarioState,
    ghostShark: {
      ...scenarioState.ghostShark,
      floor,
      x,
      y,
    },
    floodedTiles: alreadyFlooded ? scenarioState.floodedTiles : [...scenarioState.floodedTiles, { floor, x, y }],
  };
  const nextBoard = alreadyFlooded ? game.board : applyFloodToBoardState(game.board, floor, x, y);
  const nextFloodedTiles = alreadyFlooded
    ? scenarioState.floodedTiles
    : [...scenarioState.floodedTiles, { floor, x, y }];

  // Bury traitor's items and omens — strip the drawn `type` wrapper and return to respective decks.
  // eslint-disable-next-line no-unused-vars
  const itemsToBury = (traitor.inventory || []).map(({ type, ...card }) => card);
  // eslint-disable-next-line no-unused-vars
  const omensToBury = (traitor.omens || []).map(({ type, ...card }) => card);
  const omensBuried = omensToBury.length;

  // Mark the traitor as dead — their human form is replaced by the shark.
  const nextPlayers = game.players.map((player, index) =>
    index === traitorIndex ? { ...player, isAlive: false, inventory: [], omens: [] } : player
  );

  const baseGame = {
    ...game,
    players: nextPlayers,
    board: nextBoard,
    itemDeck: [...game.itemDeck, ...itemsToBury],
    omenDeck: [...game.omenDeck, ...omensToBury],
    omenCount: Math.max(0, game.omenCount - omensBuried),
    hauntState: { ...game.hauntState, scenarioState: { ...nextScenarioState, floodedTiles: nextFloodedTiles } },
  };

  // Set up extra setup floods if player count requires it.
  const setupFloodChoice = buildSetupFloodPendingChoice(baseGame, floor, nextFloodedTiles);
  if (setupFloodChoice) {
    return {
      ...baseGame,
      currentPlayerIndex: traitorIndex,
      movePath: [{ x, y, floor, cost: 0 }],
      hauntState: {
        ...baseGame.hauntState,
        scenarioState: {
          ...baseGame.hauntState.scenarioState,
          pendingChoice: setupFloodChoice,
        },
      },
      message: `The shark has awoken! Flood ${setupFloodChoice.remaining} more tile${setupFloodChoice.remaining !== 1 ? "s" : ""} anywhere on the ${floor} floor to begin.`,
    };
  }

  return {
    ...game,
    players: nextPlayers,
    board: nextBoard,
    itemDeck: [...game.itemDeck, ...itemsToBury],
    omenDeck: [...game.omenDeck, ...omensToBury],
    omenCount: Math.max(0, game.omenCount - omensBuried),
    hauntState: { ...game.hauntState, scenarioState: { ...nextScenarioState, floodedTiles: nextFloodedTiles } },
  };
}

/* [HAUNT-SETUP] Builds the setup-flood pending choice after the initial tile is flooded, if player count requires extra floods. Returns null if no extra floods needed or no eligible tiles. */
function buildSetupFloodPendingChoice(game, traitorFloor, alreadyFloodedTiles) {
  const playerCount = game.players.length;
  const EXTRA_FLOODS = { 3: 0, 4: 1, 5: 2, 6: 3 };
  const remaining = EXTRA_FLOODS[playerCount] ?? 0;
  if (remaining === 0) return null;

  const floodedSet = new Set(alreadyFloodedTiles.map((t) => `${t.floor}:${t.x}:${t.y}`));
  const candidates = (game.board[traitorFloor] || [])
    .filter((t) => !isTileLanding(t.id) && !floodedSet.has(`${traitorFloor}:${t.x}:${t.y}`))
    .map((t) => ({
      id: `${traitorFloor}:${t.x}:${t.y}`,
      floor: traitorFloor,
      x: t.x,
      y: t.y,
      label: `${t.name} (${traitorFloor})`,
    }));

  if (candidates.length === 0) return null;

  return {
    type: "setup-flood-selection",
    remaining: Math.min(remaining, candidates.length),
    options: candidates,
  };
}

/* [LOOKUP] Returns true if { floor, x, y } is a Flooded tile. */
function isTileFlooded(floodedTiles, floor, x, y) {
  return floodedTiles.some((t) => t.floor === floor && t.x === x && t.y === y);
}

/* [FLOODING] Applies flood effects to a board tile: opens all 4 doors and nullifies the card type (water erodes walls and submerges card-draw triggers). */
function applyFloodToBoardState(board, floor, x, y) {
  return {
    ...board,
    [floor]: (board[floor] || []).map((t) =>
      t.x === x && t.y === y ? { ...t, doors: ["N", "S", "E", "W"], cardType: null } : t
    ),
  };
}

/* [LOOKUP] Returns true if this is a starting tile that cannot be Flooded. */
function isTileLanding(tileId) {
  return STARTING_TILE_IDS.has(tileId);
}

/* [FLOODING] Returns the list of non-flooded, non-landing tiles that are
   adjacent (by grid position, any floor) to an already-flooded tile.
   Adjacency here is grid-only (flood spreads to neighbours by x/y offset). */
function getFloodCandidatesAdjacentToFlooded(board, floodedTiles) {
  if (floodedTiles.length === 0) return [];

  const floodedSet = new Set(floodedTiles.map((t) => `${t.floor}:${t.x}:${t.y}`));
  const candidates = [];

  for (const flooded of floodedTiles) {
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ]) {
      const nx = flooded.x + dx;
      const ny = flooded.y + dy;
      // Check same floor only for adjacency (flood spreads on same floor)
      const neighborKey = `${flooded.floor}:${nx}:${ny}`;
      if (floodedSet.has(neighborKey)) continue;
      const neighborTile = (board[flooded.floor] || []).find((t) => t.x === nx && t.y === ny);
      if (!neighborTile) continue;
      if (isTileLanding(neighborTile.id)) continue;
      // Avoid duplicates
      if (!candidates.some((c) => c.floor === flooded.floor && c.x === nx && c.y === ny)) {
        candidates.push({ floor: flooded.floor, x: nx, y: ny, name: neighborTile.name, id: neighborTile.id });
      }
    }
  }
  return candidates;
}

/* [FLOODING] Returns non-landing tiles adjacent (grid) to any starting tile,
   as fallback when no normal adjacency to flooded tiles exists. */
function getFloodCandidatesAdjacentToLandings(board) {
  const candidates = [];
  for (const [floor, tiles] of Object.entries(board)) {
    for (const tile of tiles || []) {
      if (isTileLanding(tile.id)) {
        for (const [dx, dy] of [
          [0, -1],
          [0, 1],
          [-1, 0],
          [1, 0],
        ]) {
          const nx = tile.x + dx;
          const ny = tile.y + dy;
          const neighbor = (board[floor] || []).find((t) => t.x === nx && t.y === ny);
          if (!neighbor) continue;
          if (isTileLanding(neighbor.id)) continue;
          if (!candidates.some((c) => c.floor === floor && c.x === nx && c.y === ny)) {
            candidates.push({ floor, x: nx, y: ny, name: neighbor.name, id: neighbor.id });
          }
        }
      }
    }
  }
  return candidates;
}

/* [FLOODING] Returns true if every non-landing, placed tile on the board is flooded. */
function areAllTilesFlooded(board, floodedTiles) {
  const floodedSet = new Set(floodedTiles.map((t) => `${t.floor}:${t.x}:${t.y}`));
  for (const [floor, tiles] of Object.entries(board)) {
    for (const tile of tiles || []) {
      if (isTileLanding(tile.id)) continue;
      if (!floodedSet.has(`${floor}:${tile.x}:${tile.y}`)) return false;
    }
  }
  return true;
}

/* [EXPLOSIVE] Returns the number of explosive tokens held by a player (stored in scenarioState). */
function getExplosiveCount(game, playerIndex) {
  const scenarioState = getScenarioState(game.hauntState);
  return scenarioState.playerExplosives?.[playerIndex] || 0;
}

/* [EXPLOSIVE] Returns true if the player has at least one Explosive token. */
function playerHasExplosive(game, playerIndex) {
  return getExplosiveCount(game, playerIndex) > 0;
}

/* [EXPLOSIVE] Returns true if the player holds the Dynamite item card. */
function playerHasDynamite(game, playerIndex) {
  const player = game.players[playerIndex];
  if (!player) return false;
  return (player.inventory || []).some((card) => card.id === "dynamite");
}

/* [HAUNT-ACTION] [DICE-ROLL] Builds the hauntActionRoll awaiting-roll state for a haunt action. */
function buildPendingActionRoll(game, actionId, stat, options = {}) {
  const currentPlayer = getCurrentPlayer(game);
  if (!currentPlayer) return game;

  const usageKey = options.usageKey || createUsageKey(game, actionId);
  const baseStatIndex = currentPlayer.statIndex?.[stat] ?? 0;
  const baseDiceCount = Number.isInteger(options.baseDiceCount)
    ? options.baseDiceCount
    : (currentPlayer.character?.[stat]?.[baseStatIndex] ?? 0);
  const bonus = Number.isFinite(options.bonus) ? options.bonus : 0;
  const threshold = Number.isFinite(options.threshold) ? options.threshold : 0;

  return {
    ...game,
    hauntActionRoll: {
      actionId,
      actorIndex: game.currentPlayerIndex,
      usageKey,
      stat,
      label: STAT_LABELS[stat] || "Trait",
      baseDiceCount,
      threshold,
      bonus,
      forcedTotal: null,
      status: "awaiting-roll",
      lastRoll: {
        label: STAT_LABELS[stat] || "Trait",
        stat,
        dice: [],
        total: null,
        modifier: null,
        outcomes: [],
      },
    },
  };
}

/* [HAUNT-ACTION] Returns the current hauntActionRoll, or null. */
function getActionRoll(game) {
  return game.hauntActionRoll || null;
}

/* [HAUNT-ACTION] Computes { actionId, rollTotal, bonus, effectiveTotal, threshold, success } from settled roll. */
function getActionRollResult(game) {
  const rollState = getActionRoll(game);
  const rollTotal = Number(rollState?.lastRoll?.total);
  if (!rollState || !Number.isFinite(rollTotal)) return null;
  const bonus = Number(rollState.bonus) || 0;
  const effectiveTotal = rollTotal + bonus;
  return {
    actionId: rollState.actionId,
    stat: rollState.stat,
    rollTotal,
    bonus,
    effectiveTotal,
    threshold: Number(rollState.threshold) || 0,
    success: effectiveTotal >= (Number(rollState.threshold) || 0),
  };
}

/* [HAUNT-ACTION] Removes hauntActionRoll from game state. */
function clearHauntActionRoll(game) {
  if (!game.hauntActionRoll) return game;
  return { ...game, hauntActionRoll: null };
}

// ---------------------------------------------------------------------------
// Exported hook: getCombatActorProxyState
// The shark acts as a combat proxy for the traitor (who is dead).
// Returning the shark's position enables hero/shark mutual combat and mutual obstacles.
// ---------------------------------------------------------------------------

/* [COMBAT] Returns the shark as a proxy combat actor for the traitor, enabling hero attacks and obstacles. */
export function getCombatActorProxyState(game, actorIndex) {
  if (game.activeHauntId !== "haunt_28" || !game.hauntState) return null;
  if (actorIndex !== game.hauntState.traitorPlayerIndex) return null;
  const scenarioState = getScenarioState(game.hauntState);
  const shark = scenarioState.ghostShark;
  if (!shark?.active || shark.floor == null) return null;
  const monsterDef = game.hauntState?.monsters?.find((m) => m.id === "ghost-shark");
  const stats = monsterDef?.stats || { might: 8, speed: 2, sanity: 4 };
  return {
    name: "Great White Ghost Shark",
    floor: shark.floor,
    x: shark.x,
    y: shark.y,
    statDiceCounts: { might: stats.might, speed: stats.speed, sanity: stats.sanity },
  };
}

// ---------------------------------------------------------------------------
// Exported hook: getSpecialMoveOptionsState
// The shark (traitor) moves like a monster: only to existing placed tiles,
// never discovering new ones. This override filters out "explore" moves.
// ---------------------------------------------------------------------------

/* [MOVEMENT] Haunt 28 shark movement: only existing tiles, no exploration. */
export function getSpecialMoveOptionsState({ game, currentPlayer, DIR, getTileAt, backtrackPos }) {
  if (game.activeHauntId !== "haunt_28" || game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || !game.hauntState) {
    return null;
  }
  const traitorIndex = game.hauntState.traitorPlayerIndex;
  if (game.currentPlayerIndex !== traitorIndex) return null;
  const scenarioState = getScenarioState(game.hauntState);
  if (!scenarioState.ghostShark?.active) return null;

  // Monsters can only move to existing placed tiles — never discover new ones.
  const OPPOSITE_DIR = { N: "S", S: "N", E: "W", W: "E" };
  const tile = getTileAt(currentPlayer.x, currentPlayer.y, currentPlayer.floor);
  if (!tile) return [];

  const movesLeft = Number(currentPlayer?.movesLeft) || 0;
  const isFirstMove = !game.hasMovedThisTurn;
  const hasObstacleToken = Array.isArray(tile?.tokens) && tile.tokens.some((token) => token?.type === "obstacle");
  const tileLeaveCost = tile?.obstacle || hasObstacleToken ? 2 : 1;
  const heroIndexes = game.hauntState.teams?.heroes?.playerIndexes || [];
  const heroesOnTile = heroIndexes.filter((hi) => {
    const h = game.players[hi];
    return h?.isAlive && h.floor === currentPlayer.floor && h.x === currentPlayer.x && h.y === currentPlayer.y;
  }).length;
  const moveCost = tileLeaveCost + heroesOnTile;
  const canAffordMove = movesLeft >= moveCost || (isFirstMove && movesLeft > 0);

  const moves = [];
  for (const dir of tile.doors) {
    const { dx, dy } = DIR[dir];
    const nx = currentPlayer.x + dx;
    const ny = currentPlayer.y + dy;
    const neighbor = getTileAt(nx, ny, currentPlayer.floor);
    if (!neighbor) continue; // No tile here — monsters never explore
    if (!neighbor.doors.includes(OPPOSITE_DIR[dir])) continue;
    const isBacktrack =
      backtrackPos && backtrackPos.x === nx && backtrackPos.y === ny && backtrackPos.floor === currentPlayer.floor;
    if (isBacktrack) {
      moves.push({ dir, x: nx, y: ny, type: "backtrack" });
    } else if (canAffordMove) {
      moves.push({ dir, x: nx, y: ny, type: "move", cost: moveCost });
    }
  }
  return moves;
}

// ---------------------------------------------------------------------------
// Exported hook: getTileTokenLabelsState
// ---------------------------------------------------------------------------

/* [BOARD-LAYOUT] Returns token labels for haunt 28: flooded tile indicator only. The shark is rendered directly by BoardCanvas. */
export function getTileTokenLabelsState(game, { floor, x, y }) {
  if (game.activeHauntId !== "haunt_28" || !game.hauntState) return [];

  const scenarioState = getScenarioState(game.hauntState);
  const labels = [];

  if (isTileFlooded(scenarioState.floodedTiles, floor, x, y)) {
    labels.push({ label: "Flooded", variant: "flooded" });
  }

  return labels;
}

// ---------------------------------------------------------------------------
// Exported hook: getKnowledgeTokenHoldersState
// ---------------------------------------------------------------------------

/* [HAUNT-COMBAT] Haunt 28 has no knowledge tokens. */
export function getKnowledgeTokenHoldersState() {
  return [];
}

// ---------------------------------------------------------------------------
// Exported hook: canDeadPlayerTakeTurn
// ---------------------------------------------------------------------------

/* [PLAYER-STATE] Haunt 28: the traitor is dead (became the shark) but still takes turns controlling it. */
export function canDeadPlayerTakeTurn(game, playerIndex) {
  if (game.activeHauntId !== "haunt_28" || !game.hauntState) return false;
  const traitorIndex = game.hauntState.traitorPlayerIndex;
  if (playerIndex !== traitorIndex) return false;
  const shark = getScenarioState(game.hauntState).ghostShark;
  return !!shark?.active;
}

// ---------------------------------------------------------------------------
// Exported hook: getActionAvailabilityState
// ---------------------------------------------------------------------------

/* [HAUNT-ACTION] [VALIDATION] Returns which haunt action buttons are available for the current player. */
export function getActionAvailabilityState(game, { hauntActionLocked }) {
  if (game.activeHauntId !== "haunt_28" || game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || !game.hauntState) {
    return { searchForExplosives: false, forceExplosives: false, cueOminousMusic: false };
  }

  const traitorIndex = game.hauntState.traitorPlayerIndex;
  const isTraitorTurn = traitorIndex === game.currentPlayerIndex;
  const currentPlayer = getCurrentPlayer(game);
  const currentTile = getCurrentTile(game);
  const scenarioState = getScenarioState(game.hauntState);

  if (scenarioState.pendingChoice) {
    return { searchForExplosives: false, forceExplosives: false, cueOminousMusic: false };
  }

  const shark = scenarioState.ghostShark;
  const canUseHeroAction = !isTraitorTurn && !!currentPlayer?.isAlive && !hauntActionLocked;

  // Search for Explosives: hero, on an item-cardType tile that is not flooded, hasn't used this turn
  const currentTileIsFlooded =
    !!currentTile && isTileFlooded(scenarioState.floodedTiles, currentPlayer?.floor, currentTile.x, currentTile.y);
  const onItemTile = !!currentTile && currentTile.cardType === "item" && !currentTileIsFlooded;
  const totalExplosives = Object.values(scenarioState.playerExplosives || {}).reduce((s, n) => s + n, 0);
  const searchUsageKey = createUsageKey(game, "search-for-explosives");
  const searchAlreadyUsed = !!game.hauntState.oncePerTurnUsage?.[searchUsageKey];
  const canSearch = canUseHeroAction && onItemTile && !searchAlreadyUsed && totalExplosives < MAX_EXPLOSIVES;

  // Force Explosives: hero, on same tile as shark, has at least one explosive, hasn't used this turn
  const onSharkTile =
    !!currentPlayer &&
    !!shark?.active &&
    currentPlayer.floor === shark.floor &&
    currentPlayer.x === shark.x &&
    currentPlayer.y === shark.y;
  const forceUsageKey = createUsageKey(game, "force-explosives");
  const forceAlreadyUsed = !!game.hauntState.oncePerTurnUsage?.[forceUsageKey];
  const hasExplosive = playerHasExplosive(game, game.currentPlayerIndex);
  const hasDynamiteNow = playerHasDynamite(game, game.currentPlayerIndex);
  const canForce = canUseHeroAction && onSharkTile && (hasExplosive || hasDynamiteNow) && !forceAlreadyUsed;

  // Cue Ominous Music: traitor, shark active, flooded tiles exist, hasn't used this turn
  const cueUsageKey = createUsageKey(game, "cue-ominous-music");
  const cueAlreadyUsed = !!game.hauntState.oncePerTurnUsage?.[cueUsageKey];
  const canCue =
    isTraitorTurn && !!shark?.active && scenarioState.floodedTiles.length > 0 && !cueAlreadyUsed && !hauntActionLocked;

  return { searchForExplosives: canSearch, forceExplosives: canForce, cueOminousMusic: canCue };
}

// ---------------------------------------------------------------------------
// Exported hook: getActionButtonsState
// ---------------------------------------------------------------------------

/* [HAUNT-ACTION] [OVERLAY] Returns the list of action buttons for the haunt panel. */
export function getActionButtonsState(game, context) {
  if (game.activeHauntId !== "haunt_28" || !game.hauntState) return [];

  const scenarioState = getScenarioState(game.hauntState);
  const pendingChoice = scenarioState.pendingChoice;

  // Setup flood selection: handled via board tile highlighting, not buttons
  if (pendingChoice?.type === "setup-flood-selection") {
    return [];
  }

  // Flood tile selection: handled via board tile highlighting, not buttons
  if (pendingChoice?.type === "flood-tile-selection") {
    return [];
  }

  // Cue Ominous Music tile selection: handled via board tile highlighting, not buttons
  if (pendingChoice?.type === "cue-ominous-music-placement") {
    return [];
  }

  // Force-explosives count selection: handled by the ForceExplosivesOverlay popup
  if (pendingChoice?.type === "force-explosives-count") {
    return [];
  }

  const availability = getActionAvailabilityState(game, context);
  const buttons = [];

  if (availability.searchForExplosives) {
    const count = getExplosiveCount(game, game.currentPlayerIndex);
    buttons.push({
      id: "search-for-explosives",
      label: `Search for Explosives (have ${count})`,
      tone: "secondary",
      enabled: true,
    });
  }

  if (availability.forceExplosives) {
    const count = getExplosiveCount(game, game.currentPlayerIndex);
    const hasDynamite = playerHasDynamite(game, game.currentPlayerIndex);
    buttons.push({
      id: "force-explosives",
      label: `Force Explosives down Throat (${count} explosive${count !== 1 ? "s" : ""}${hasDynamite ? " + Dynamite" : ""})`,
      tone: "danger",
      enabled: true,
    });
  }

  if (availability.cueOminousMusic) {
    buttons.push({
      id: "cue-ominous-music",
      label: "Cue Ominous Music (Move Shark)",
      tone: "stairs",
      enabled: true,
    });
  }

  return buttons;
}

// ---------------------------------------------------------------------------
// Exported hook: getActionRollPreviewState
// ---------------------------------------------------------------------------

/* [HAUNT-ACTION] [OVERLAY] Returns the roll-preview summary for the haunt action roll overlay. */
export function getActionRollPreviewState(game) {
  if (game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || game.activeHauntId !== "haunt_28") return null;

  const rollResult = getActionRollResult(game);
  if (!rollResult) return null;

  if (rollResult.actionId === "search-for-explosives") {
    return {
      title: "Search for Explosives",
      thresholdLabel: "Need 4+ Speed",
      outcomeLabel: rollResult.success ? "Found Explosives!" : "Nothing found",
      outcomeDescription: rollResult.success ? "Take an Explosive token." : "Nothing happens.",
      totalLabel: `${rollResult.rollTotal}`,
    };
  }

  if (rollResult.actionId === "force-explosives") {
    return {
      title: "Force Explosives down the Shark's Throat",
      thresholdLabel: "Need 10+ Might",
      outcomeLabel: rollResult.success ? "BOOM! Heroes win!" : "Failed",
      outcomeDescription: rollResult.success ? "The shark explodes!" : "Take 2 Physical damage and your turn ends.",
      totalLabel:
        rollResult.bonus > 0
          ? `${rollResult.rollTotal} + ${rollResult.bonus} = ${rollResult.effectiveTotal}`
          : `${rollResult.rollTotal}`,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Exported hook: resolveActionState
// ---------------------------------------------------------------------------

/* [HAUNT-ACTION] Main action dispatcher for haunt 28. */
export function resolveActionState(game, { actionId }) {
  if (typeof actionId === "string" && actionId.startsWith("pending-select-cue-ominous-music:")) {
    const optionId = actionId.replace("pending-select-cue-ominous-music:", "");
    return resolveSelectCueOminousMusicOptionState(game, optionId);
  }
  if (actionId === "confirm-cue-ominous-music") return resolvePendingCueOminousMusicState(game);
  if (actionId === "force-explosives-count-decrement") return resolveForceExplosivesCountChangeState(game, -1);
  if (actionId === "force-explosives-count-increment") return resolveForceExplosivesCountChangeState(game, +1);
  if (actionId === "force-explosives-count-confirm") return resolveForceExplosivesCountConfirmState(game);
  if (typeof actionId === "string" && actionId.startsWith("pending-flood-tile:")) {
    const optionId = actionId.replace("pending-flood-tile:", "");
    const pendingType = getScenarioState(game.hauntState).pendingChoice?.type;
    if (pendingType === "setup-flood-selection") return resolveSetupFloodTileSelectionState(game, optionId);
    return resolveFloodTileSelectionState(game, optionId);
  }

  if (actionId === "search-for-explosives") return resolveSearchForExplosivesState(game);
  if (actionId === "force-explosives") return resolveForceExplosivesState(game);
  if (actionId === "cue-ominous-music") return resolveCueOminousMusicState(game);

  return game;
}

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

/* [HAUNT-ACTION] [DICE-ROLL] Sets up the Search for Explosives roll (Speed, threshold 4). */
function resolveSearchForExplosivesState(game) {
  if (game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || game.activeHauntId !== "haunt_28" || !game.hauntState) {
    return game;
  }

  if (!isHero(game, game.currentPlayerIndex)) {
    return { ...game, message: "Only heroes can Search for Explosives." };
  }

  const currentPlayer = getCurrentPlayer(game);
  if (!currentPlayer?.isAlive) {
    return { ...game, message: "Dead heroes cannot Search for Explosives." };
  }

  const currentTile = getCurrentTile(game);
  if (!currentTile || currentTile.cardType !== "item") {
    return { ...game, message: "Search for Explosives can only be used on an Item tile." };
  }
  const scenarioStateForFlood = getScenarioState(game.hauntState);
  if (isTileFlooded(scenarioStateForFlood.floodedTiles, currentPlayer?.floor, currentTile.x, currentTile.y)) {
    return { ...game, message: "Search for Explosives cannot be used on a Flooded tile." };
  }

  const scenarioState = getScenarioState(game.hauntState);
  const totalExplosives = Object.values(scenarioState.playerExplosives || {}).reduce((s, n) => s + n, 0);
  if (totalExplosives >= MAX_EXPLOSIVES) {
    return { ...game, message: "All 5 Explosive tokens are already in play." };
  }

  const usageKey = createUsageKey(game, "search-for-explosives");
  if (game.hauntState.oncePerTurnUsage?.[usageKey]) {
    return { ...game, message: "Search for Explosives has already been used this turn." };
  }

  return {
    ...buildPendingActionRoll(game, "search-for-explosives", "speed", { usageKey, threshold: 4 }),
    message: `${currentPlayer.name} searches for Explosives. Roll Speed to resolve.`,
  };
}

/* [HAUNT-ACTION] [DICE-ROLL] Sets up the Force Explosives roll (Might, threshold 10, with discard bonus selection). */
function resolveForceExplosivesState(game) {
  if (game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || game.activeHauntId !== "haunt_28" || !game.hauntState) {
    return game;
  }

  if (!isHero(game, game.currentPlayerIndex)) {
    return { ...game, message: "Only heroes can Force Explosives down the Shark's Throat." };
  }

  const currentPlayer = getCurrentPlayer(game);
  if (!currentPlayer?.isAlive) {
    return { ...game, message: "Dead heroes cannot Force Explosives down the Shark's Throat." };
  }

  const scenarioState = getScenarioState(game.hauntState);
  const shark = scenarioState.ghostShark;
  const onSharkTile =
    !!shark?.active &&
    currentPlayer.floor === shark.floor &&
    currentPlayer.x === shark.x &&
    currentPlayer.y === shark.y;
  if (!onSharkTile) {
    return { ...game, message: "You must be on the Shark's tile to Force Explosives down its Throat." };
  }

  const usageKey = createUsageKey(game, "force-explosives");
  if (game.hauntState.oncePerTurnUsage?.[usageKey]) {
    return { ...game, message: "Force Explosives has already been used this turn." };
  }

  const explosiveCount = getExplosiveCount(game, game.currentPlayerIndex);
  const hasDynamite = playerHasDynamite(game, game.currentPlayerIndex);
  const maxCount = explosiveCount + (hasDynamite ? 1 : 0);

  if (maxCount === 0) {
    return { ...game, message: "You need at least one Explosive or Dynamite to use this action." };
  }

  return {
    ...game,
    hauntState: {
      ...game.hauntState,
      scenarioState: {
        ...scenarioState,
        pendingChoice: {
          type: "force-explosives-count",
          actorIndex: game.currentPlayerIndex,
          usageKey,
          currentCount: 0,
          maxCount,
          explosiveCount,
          hasDynamite,
        },
      },
    },
    message: `${currentPlayer.name} prepares to force items down the Shark's Throat. Choose how many to use (max ${maxCount}).`,
  };
}

/* [HAUNT-ACTION] Adjusts the Force Explosives stepper count up or down by delta. */
function resolveForceExplosivesCountChangeState(game, delta) {
  if (game.activeHauntId !== "haunt_28" || !game.hauntState) return game;
  const scenarioState = getScenarioState(game.hauntState);
  const pendingChoice = scenarioState.pendingChoice;
  if (pendingChoice?.type !== "force-explosives-count") return game;

  const newCount = Math.max(0, Math.min(pendingChoice.maxCount, pendingChoice.currentCount + delta));
  if (newCount === pendingChoice.currentCount) return game;

  return {
    ...game,
    hauntState: {
      ...game.hauntState,
      scenarioState: {
        ...scenarioState,
        pendingChoice: { ...pendingChoice, currentCount: newCount },
      },
    },
  };
}

/* [HAUNT-ACTION] [DICE-ROLL] Confirms the Force Explosives count and starts the Might roll. */
function resolveForceExplosivesCountConfirmState(game) {
  if (game.activeHauntId !== "haunt_28" || !game.hauntState) return game;
  const scenarioState = getScenarioState(game.hauntState);
  const pendingChoice = scenarioState.pendingChoice;
  if (pendingChoice?.type !== "force-explosives-count") return game;
  if (pendingChoice.actorIndex !== game.currentPlayerIndex) return game;

  const { currentCount, explosiveCount, hasDynamite, usageKey } = pendingChoice;
  const explosivesUsed = Math.min(currentCount, explosiveCount);
  const dynamiteUsed = hasDynamite && currentCount > explosiveCount;
  const bonus = currentCount * 2;

  // Remove used explosives from scenarioState
  const nextExplosives = {
    ...(scenarioState.playerExplosives || {}),
    [game.currentPlayerIndex]: Math.max(0, explosiveCount - explosivesUsed),
  };

  // Remove Dynamite from inventory if used
  let nextPlayers = game.players;
  if (dynamiteUsed) {
    nextPlayers = game.players.map((player, index) => {
      if (index !== game.currentPlayerIndex) return player;
      const dynamiteIdx = (player.inventory || []).findIndex((card) => card.id === "dynamite");
      if (dynamiteIdx === -1) return player;
      return {
        ...player,
        inventory: [...player.inventory.slice(0, dynamiteIdx), ...player.inventory.slice(dynamiteIdx + 1)],
      };
    });
  }

  const currentPlayer = game.players[game.currentPlayerIndex];
  const usedParts = [];
  if (explosivesUsed > 0) usedParts.push(`${explosivesUsed} Explosive${explosivesUsed !== 1 ? "s" : ""}`);
  if (dynamiteUsed) usedParts.push("Dynamite");
  const itemDesc = usedParts.length > 0 ? usedParts.join(" + ") : "nothing";

  return {
    ...buildPendingActionRoll(
      {
        ...game,
        players: nextPlayers,
        hauntState: {
          ...game.hauntState,
          scenarioState: {
            ...scenarioState,
            pendingChoice: null,
            playerExplosives: nextExplosives,
          },
        },
      },
      "force-explosives",
      "might",
      { usageKey, threshold: 10, bonus }
    ),
    message:
      bonus > 0
        ? `${currentPlayer?.name} uses ${itemDesc} for +${bonus} bonus. Roll Might (need 10+) to resolve.`
        : `${currentPlayer?.name} rolls Might with no bonus (need 10+).`,
  };
}

/* [HAUNT-ACTION] Sets up Cue Ominous Music: shows all flooded tiles as move destinations. */
function resolveCueOminousMusicState(game) {
  if (game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || game.activeHauntId !== "haunt_28" || !game.hauntState) {
    return game;
  }

  const traitorIndex = game.hauntState.traitorPlayerIndex;
  if (game.currentPlayerIndex !== traitorIndex) {
    return { ...game, message: "Only the traitor can Cue Ominous Music." };
  }

  const usageKey = createUsageKey(game, "cue-ominous-music");
  if (game.hauntState.oncePerTurnUsage?.[usageKey]) {
    return { ...game, message: "Cue Ominous Music has already been used this turn." };
  }

  const scenarioState = getScenarioState(game.hauntState);
  const floodedTiles = scenarioState.floodedTiles;

  if (floodedTiles.length === 0) {
    return { ...game, message: "There are no Flooded tiles to move the Shark to." };
  }

  const options = floodedTiles.map((t) => {
    const boardTile = (game.board[t.floor] || []).find((bt) => bt.x === t.x && bt.y === t.y);
    const label = boardTile?.name ? `${boardTile.name} (${t.floor})` : `(${t.x}, ${t.y}) ${t.floor}`;
    return { id: `${t.floor}:${t.x}:${t.y}`, floor: t.floor, x: t.x, y: t.y, label };
  });

  return {
    ...game,
    hauntState: {
      ...game.hauntState,
      scenarioState: {
        ...scenarioState,
        pendingChoice: {
          type: "cue-ominous-music-placement",
          actorIndex: traitorIndex,
          usageKey,
          options,
        },
      },
    },
    message: "Choose a Flooded tile to move the Great White Ghost Shark to.",
  };
}

/* [HAUNT-ACTION] Previews the Cue Ominous Music tile selection by storing the selectedOptionId on the pendingChoice. */
function resolveSelectCueOminousMusicOptionState(game, optionId) {
  if (game.activeHauntId !== "haunt_28" || !game.hauntState) return game;
  const scenarioState = getScenarioState(game.hauntState);
  const pendingChoice = scenarioState.pendingChoice;
  if (pendingChoice?.type !== "cue-ominous-music-placement") return game;

  const selectedOption = (pendingChoice.options || []).find((opt) => opt.id === optionId);
  if (!selectedOption) return game;

  return {
    ...game,
    hauntState: {
      ...game.hauntState,
      scenarioState: {
        ...scenarioState,
        pendingChoice: {
          ...pendingChoice,
          selectedOptionId: optionId,
        },
      },
    },
    message: `Select Confirm Placement to move the Shark to ${selectedOption.label}.`,
  };
}

/* [HAUNT-ACTION] Moves the Ghost Shark to the selected Flooded tile. */
function resolvePendingCueOminousMusicState(game) {
  if (game.activeHauntId !== "haunt_28" || !game.hauntState) return game;
  const scenarioState = getScenarioState(game.hauntState);
  const pendingChoice = scenarioState.pendingChoice;
  if (pendingChoice?.type !== "cue-ominous-music-placement") return game;
  if (pendingChoice.actorIndex !== game.currentPlayerIndex) return game;

  const selectedOption = (pendingChoice.options || []).find((opt) => opt.id === pendingChoice.selectedOptionId);
  if (!selectedOption) {
    return { ...game, message: "Choose a highlighted tile before confirming." };
  }

  const nextShark = {
    ...scenarioState.ghostShark,
    floor: selectedOption.floor,
    x: selectedOption.x,
    y: selectedOption.y,
  };

  const traitorIndex = game.hauntState.traitorPlayerIndex;
  const nextPlayers = game.players.map((player, index) =>
    index === traitorIndex
      ? { ...player, floor: selectedOption.floor, x: selectedOption.x, y: selectedOption.y }
      : player
  );

  const nextHauntState = markHauntActionUsed(game.hauntState, pendingChoice.usageKey);

  return {
    ...game,
    players: nextPlayers,
    movePath: [{ x: selectedOption.x, y: selectedOption.y, floor: selectedOption.floor, cost: 0 }],
    hauntState: {
      ...nextHauntState,
      scenarioState: {
        ...scenarioState,
        pendingChoice: null,
        ghostShark: nextShark,
      },
    },
    message: `Great White Ghost Shark moves to ${selectedOption.label}.`,
  };
}

// ---------------------------------------------------------------------------
// Exported hook: resolveActionRollContinueState
// ---------------------------------------------------------------------------

/* [HAUNT-ACTION] Processes Continue after a Search for Explosives or Force Explosives roll. */
export function resolveActionRollContinueState(game, { createDamageChoice }) {
  if (game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || game.activeHauntId !== "haunt_28" || !game.hauntState) {
    return game;
  }

  const actionRoll = getActionRoll(game);
  const rollResult = getActionRollResult(game);
  if (!actionRoll || !rollResult || actionRoll.status !== "rolled-pending-continue") {
    return game;
  }

  const actor = game.players[actionRoll.actorIndex] || getCurrentPlayer(game);
  const actorName = actor?.name || "Explorer";
  const scenarioState = getScenarioState(game.hauntState);
  const nextHauntState = markHauntActionUsed(game.hauntState, actionRoll.usageKey);

  // --- Search for Explosives ---
  if (rollResult.actionId === "search-for-explosives") {
    if (!rollResult.success) {
      return {
        ...clearHauntActionRoll(game),
        hauntState: nextHauntState,
        message: `${actorName} rolled ${rollResult.rollTotal}. Nothing found.`,
      };
    }

    const currentExplosives = scenarioState.playerExplosives || {};
    const totalInPlay = Object.values(currentExplosives).reduce((s, n) => s + n, 0);
    if (totalInPlay >= MAX_EXPLOSIVES) {
      return {
        ...clearHauntActionRoll(game),
        hauntState: nextHauntState,
        message: `${actorName} rolled ${rollResult.rollTotal}, but all Explosive tokens are already in play.`,
      };
    }

    const nextExplosives = {
      ...currentExplosives,
      [actionRoll.actorIndex]: (currentExplosives[actionRoll.actorIndex] || 0) + 1,
    };

    return {
      ...clearHauntActionRoll(game),
      hauntState: {
        ...nextHauntState,
        scenarioState: {
          ...scenarioState,
          playerExplosives: nextExplosives,
        },
      },
      message: `${actorName} rolled ${rollResult.rollTotal}. Found an Explosive token!`,
    };
  }

  // --- Force Explosives down the Shark's Throat ---
  if (rollResult.actionId === "force-explosives") {
    if (rollResult.success) {
      return {
        ...clearHauntActionRoll(game),
        hauntState: {
          ...nextHauntState,
          scenarioState: {
            ...scenarioState,
            ghostShark: { ...scenarioState.ghostShark, active: false },
          },
        },
        gamePhase: GAME_PHASES.GAME_OVER,
        turnPhase: "game-over",
        winnerTeam: HAUNT_TEAMS.HEROES,
        message: `${actorName} rolled ${rollResult.rollTotal}${rollResult.bonus > 0 ? ` + ${rollResult.bonus} = ${rollResult.effectiveTotal}` : ""}. The shark explodes! Heroes win!`,
      };
    }

    // Failure: 2 physical damage and end turn
    const damageChoice = createDamageChoice(
      { damage: 2, damageType: "physical", sourceName: "Force Explosives — Shark Bites Back" },
      actor
    );

    return {
      ...clearHauntActionRoll(game),
      hauntState: nextHauntState,
      damageChoice,
      message: `${actorName} rolled ${rollResult.rollTotal}${rollResult.bonus > 0 ? ` + ${rollResult.bonus} = ${rollResult.effectiveTotal}` : ""}. The Shark bites back! Take 2 Physical damage. Turn ends.`,
    };
  }

  return clearHauntActionRoll(game);
}

// ---------------------------------------------------------------------------
// Exported hook: resolveAfterDamageState
// Checks hero death → all-dead win condition.
// Also chains any pendingForceExplosivesQueue (no queue in this haunt but kept for symmetry).
// ---------------------------------------------------------------------------

/* [HAUNT-COMBAT] [DAMAGE] Checks win conditions after any damage in haunt 28. */
export function resolveAfterDamageState(previousGame, nextGame) {
  if (nextGame.activeHauntId !== "haunt_28" || !nextGame.hauntState) return nextGame;
  if (nextGame.gamePhase === GAME_PHASES.GAME_OVER) return nextGame;

  // All heroes dead → traitor wins
  const livingHeroes = getLivingHeroIndexes(nextGame);
  if (livingHeroes.length === 0) {
    return {
      ...nextGame,
      gamePhase: GAME_PHASES.GAME_OVER,
      turnPhase: "game-over",
      winnerTeam: HAUNT_TEAMS.TRAITOR,
      message: "All heroes are dead. The Great White Ghost Shark wins!",
    };
  }

  return nextGame;
}

// ---------------------------------------------------------------------------
// Exported hook: resolveAfterMovementState
// After any movement, check if shark is now on a tile with heroes (cosmetic only;
// actual attacks happen via the normal combat flow).
// ---------------------------------------------------------------------------

/* [MOVEMENT] After traitor moves, sync the ghost shark position to the traitor's new position. */
export function resolveAfterMovementState(_previousGame, nextGame) {
  if (!nextGame.hauntState || nextGame.activeHauntId !== "haunt_28") return nextGame;
  const traitorIndex = nextGame.hauntState.traitorPlayerIndex;
  if (nextGame.currentPlayerIndex !== traitorIndex) return nextGame;
  const traitor = nextGame.players[traitorIndex];
  if (!traitor) return nextGame;
  const scenarioState = getScenarioState(nextGame.hauntState);
  if (!scenarioState.ghostShark?.active) return nextGame;
  return {
    ...nextGame,
    hauntState: {
      ...nextGame.hauntState,
      scenarioState: {
        ...scenarioState,
        ghostShark: {
          ...scenarioState.ghostShark,
          floor: traitor.floor,
          x: traitor.x,
          y: traitor.y,
        },
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Exported hook: resolveTurnStartState
// At the start of the TRAITOR's turn: roll shark speed.
// At the start of each HERO's turn: the haunt revealer floods a tile.
// ---------------------------------------------------------------------------

/* [HAUNT-SETUP] [DICE-ROLL] At start of traitor turn: roll shark speed. At start of hero turn: prompt flood. */
export function resolveTurnStartState(game, { rollDice }) {
  if (game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || game.activeHauntId !== "haunt_28" || !game.hauntState) {
    return { game, diceAnimation: null };
  }

  const traitorIndex = game.hauntState.traitorPlayerIndex;
  const scenarioState = getScenarioState(game.hauntState);
  const shark = scenarioState.ghostShark;

  // ---- Traitor turn: check win condition then roll shark speed ----
  if (game.currentPlayerIndex === traitorIndex) {
    if (!shark?.active) return { game, diceAnimation: null };

    // During setup, the traitor is flooding tiles — don't roll speed yet.
    if (scenarioState.pendingChoice?.type === "setup-flood-selection") {
      return { game, diceAnimation: null };
    }

    // Win check: all tiles flooded at the start of the shark's turn → traitor wins
    if (areAllTilesFlooded(game.board, scenarioState.floodedTiles)) {
      return {
        game: {
          ...game,
          gamePhase: GAME_PHASES.GAME_OVER,
          turnPhase: "game-over",
          winnerTeam: HAUNT_TEAMS.TRAITOR,
          message: "Every tile in the house is now Flooded. The Shark wins!",
        },
        diceAnimation: null,
      };
    }

    const dice = rollDice(GHOST_SHARK_SPEED_DICE);
    const total = dice.reduce((s, v) => s + v, 0);
    const moves = Math.max(1, total);

    const nextPlayers = game.players.map((player, index) =>
      index === traitorIndex ? { ...player, floor: shark.floor, x: shark.x, y: shark.y, movesLeft: moves } : player
    );

    return {
      game: {
        ...game,
        players: nextPlayers,
        movePath: [{ x: shark.x, y: shark.y, floor: shark.floor, cost: 0 }],
        message: "The Great White Ghost Shark is rolling for movement...",
      },
      diceAnimation: {
        purpose: "monster-speed-roll",
        final: [...dice],
        display: Array.from({ length: dice.length }, () => Math.floor(Math.random() * 3)),
        settled: false,
        label: "Movement",
        total,
        monsterName: "Great White Ghost Shark",
      },
    };
  }

  // ---- Hero turn: traitor floods a tile ----
  if (isHero(game, game.currentPlayerIndex)) {
    // Safety: never overwrite an in-progress setup flood
    if (scenarioState.pendingChoice?.type === "setup-flood-selection") {
      return { game, diceAnimation: null };
    }
    const floodedTiles = scenarioState.floodedTiles;

    // Determine flood candidates
    let candidates = getFloodCandidatesAdjacentToFlooded(game.board, floodedTiles);
    // Filter out already-flooded tiles
    candidates = candidates.filter((c) => !isTileFlooded(floodedTiles, c.floor, c.x, c.y));

    if (candidates.length === 0) {
      // Fallback: adjacent to any landing
      const fallback = getFloodCandidatesAdjacentToLandings(game.board);
      candidates = fallback.filter((c) => !isTileFlooded(floodedTiles, c.floor, c.x, c.y));
    }

    if (candidates.length === 0) {
      // Nothing left to flood
      return { game, diceAnimation: null };
    }

    const options = candidates.map((c) => ({
      id: `${c.floor}:${c.x}:${c.y}`,
      floor: c.floor,
      x: c.x,
      y: c.y,
      label: `${c.name} (${c.floor})`,
    }));

    return {
      game: {
        ...game,
        hauntState: {
          ...game.hauntState,
          scenarioState: {
            ...scenarioState,
            pendingChoice: {
              type: "flood-tile-selection",
              actorIndex: traitorIndex,
              options,
            },
          },
        },
        message: `The tide rises! The traitor must flood one tile.`,
      },
      diceAnimation: null,
    };
  }

  return { game, diceAnimation: null };
}

// ---------------------------------------------------------------------------
// Exported hook: resolveMonsterSpeedRollState
// ---------------------------------------------------------------------------

/* [HAUNT-COMBAT] [DICE-ANIMATION] Applies the settled shark speed roll, setting movesLeft. */
export function resolveMonsterSpeedRollState(game, { dice, total, monsterName }) {
  if (game.activeHauntId !== "haunt_28" || !game.hauntState) return game;

  const scenarioState = getScenarioState(game.hauntState);
  const shark = scenarioState.ghostShark;
  if (!shark?.active) return game;

  const moves = Math.max(1, total);
  const traitorIndex = game.hauntState.traitorPlayerIndex;
  const nextPlayers = game.players.map((player, index) =>
    index === traitorIndex ? { ...player, floor: shark.floor, x: shark.x, y: shark.y, movesLeft: moves } : player
  );

  return {
    ...game,
    players: nextPlayers,
    movePath: [{ x: shark.x, y: shark.y, floor: shark.floor, cost: 0 }],
    hauntState: {
      ...game.hauntState,
      scenarioState: {
        ...scenarioState,
        ghostShark: { ...shark, movesLeft: moves, speedRoll: [...dice], speedTotal: total },
      },
    },
    message: `${monsterName || "Great White Ghost Shark"} rolls ${dice.join(", ")} (${total}) and may move ${moves} tile${moves !== 1 ? "s" : ""} this turn.`,
  };
}

// ---------------------------------------------------------------------------
// Exported hook: getCombatBonus
// The shark takes no damage on loss, but heroes get no special combat bonus.
// ---------------------------------------------------------------------------

/* [HAUNT-COMBAT] Haunt 28 has no combat roll bonuses. */
export function getCombatBonus() {
  return 0;
}

/* [SIDEBAR] Haunt 28: traitor's character card cannot be expanded (they are the shark now). */
export function getPlayerCardFlagsState(game, playerIndex) {
  if (game.activeHauntId !== "haunt_28" || !game.hauntState) return null;
  const traitorIndex = game.hauntState.traitorPlayerIndex;
  if (playerIndex === traitorIndex) return { expandable: false };
  return null;
}

/* [SIDEBAR] Returns haunt-specific token chips for a given player index (e.g. Explosive tokens). */
export function getPlayerHauntTokensState(game, playerIndex) {
  if (game.activeHauntId !== "haunt_28" || !game.hauntState) return [];
  const scenarioState = getScenarioState(game.hauntState);
  const count = scenarioState.playerExplosives?.[playerIndex] || 0;
  return Array.from({ length: count }, () => ({ label: "Explosive", variant: "token" }));
}

// ---------------------------------------------------------------------------
// Exported hook: getHauntTradeableTokensState
// Returns the label and per-player explosive counts for the trade UI.
// ---------------------------------------------------------------------------

/* [TRADE] Returns explosive counts for both trade participants, enabling explosive trading. */
export function getHauntTradeableTokensState(game, ownerIndex, targetIndex) {
  if (game.activeHauntId !== "haunt_28" || !game.hauntState) return null;
  const scenarioState = getScenarioState(game.hauntState);
  const ownerHas = scenarioState.playerExplosives?.[ownerIndex] || 0;
  const targetHas = scenarioState.playerExplosives?.[targetIndex] || 0;
  if (ownerHas === 0 && targetHas === 0) return null;
  return { label: "Explosive", ownerHas, targetHas };
}

// ---------------------------------------------------------------------------
// Exported hook: resolveHauntTradeConfirmState
// Called after the normal item/omen transfer to move explosives.
// ---------------------------------------------------------------------------

/* [TRADE] Transfers explosives between players according to ownerGiveExplosiveCount / targetGiveExplosiveCount. */
export function resolveHauntTradeConfirmState(game, tradeState) {
  if (game.activeHauntId !== "haunt_28" || !game.hauntState) return game;
  const ownerGive = Math.max(0, tradeState.ownerGiveExplosiveCount || 0);
  const targetGive = Math.max(0, tradeState.targetGiveExplosiveCount || 0);
  if (ownerGive === 0 && targetGive === 0) return game;

  const scenarioState = getScenarioState(game.hauntState);
  const ownerHas = scenarioState.playerExplosives?.[tradeState.ownerIndex] || 0;
  const targetHas = scenarioState.playerExplosives?.[tradeState.targetPlayerIndex] || 0;

  const safeOwnerGive = Math.min(ownerGive, ownerHas);
  const safeTargetGive = Math.min(targetGive, targetHas);

  const nextExplosives = {
    ...(scenarioState.playerExplosives || {}),
    [tradeState.ownerIndex]: ownerHas - safeOwnerGive + safeTargetGive,
    [tradeState.targetPlayerIndex]: targetHas - safeTargetGive + safeOwnerGive,
  };

  return {
    ...game,
    hauntState: {
      ...game.hauntState,
      scenarioState: {
        ...scenarioState,
        playerExplosives: nextExplosives,
      },
    },
  };
}

/* [SIDEBAR] Returns monster card display data for the Great White Ghost Shark when active, or null. */
export function getMonsterCardState(game) {
  if (game.activeHauntId !== "haunt_28" || !game.hauntState) return null;
  const scenarioState = getScenarioState(game.hauntState);
  const shark = scenarioState.ghostShark;
  if (!shark?.active) return null;
  const traitorIndex = game.hauntState.traitorPlayerIndex;
  const monsterDef = game.hauntState.monsters?.find((m) => m.id === "ghost-shark");
  const stats = monsterDef?.stats || { might: 8, speed: 2, sanity: 4, knowledge: 4 };
  const speedRollLabel =
    Array.isArray(shark.speedRoll) && shark.speedRoll.length > 0
      ? `${shark.speedRoll.join(", ")} (${shark.speedTotal ?? shark.movesLeft ?? 0})`
      : "-";
  return {
    name: "Great White Ghost Shark",
    emoji: "🦈",
    stats,
    movesLeft: shark.movesLeft ?? 0,
    speedRollLabel,
    isCurrentTurn: game.currentPlayerIndex === traitorIndex,
  };
}

/* [BOARD-RENDER] Returns flooded tiles and the active monster token position for board rendering. Called by BoardCanvas via hauntDomain. */
export function getBoardRenderState(game) {
  if (game.activeHauntId !== "haunt_28" || !game.hauntState) {
    return { floodedTiles: [], monsterToken: null };
  }
  const scenarioState = getScenarioState(game.hauntState);
  const shark = scenarioState.ghostShark;
  return {
    floodedTiles: scenarioState.floodedTiles || [],
    monsterToken: shark?.active
      ? { floor: shark.floor, x: shark.x, y: shark.y, label: "Great White Ghost Shark", emoji: "🦈" }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Setup flood tile selection — called from resolveActionState during haunt
// setup when extra tiles need to be flooded (4+ players).
// ---------------------------------------------------------------------------

/* [HAUNT-SETUP] [FLOODING] Resolves one setup-flood tile pick. Decrements remaining; clears choice when done. */
function resolveSetupFloodTileSelectionState(game, optionId) {
  if (game.activeHauntId !== "haunt_28" || !game.hauntState) return game;
  const scenarioState = getScenarioState(game.hauntState);
  const pendingChoice = scenarioState.pendingChoice;
  if (pendingChoice?.type !== "setup-flood-selection") return game;

  const selectedOption = (pendingChoice.options || []).find((opt) => opt.id === optionId);
  if (!selectedOption) return game;

  const newFloodedTile = { floor: selectedOption.floor, x: selectedOption.x, y: selectedOption.y };
  const nextFloodedTiles = [...scenarioState.floodedTiles, newFloodedTile];
  const nextBoard = applyFloodToBoardState(game.board, selectedOption.floor, selectedOption.x, selectedOption.y);

  const remaining = pendingChoice.remaining - 1;
  // Rebuild options excluding the just-picked tile and any now-flooded tiles
  const floodedSet = new Set(nextFloodedTiles.map((t) => `${t.floor}:${t.x}:${t.y}`));
  const nextOptions = (pendingChoice.options || []).filter(
    (opt) => opt.id !== optionId && !floodedSet.has(`${opt.floor}:${opt.x}:${opt.y}`)
  );

  const nextPendingChoice =
    remaining > 0 && nextOptions.length > 0 ? { ...pendingChoice, remaining, options: nextOptions } : null;

  return {
    ...game,
    currentPlayerIndex:
      nextPendingChoice === null
        ? (game.hauntState.firstPlayerAfterSetup ?? game.currentPlayerIndex)
        : game.currentPlayerIndex,
    board: nextBoard,
    hauntState: {
      ...game.hauntState,
      scenarioState: {
        ...scenarioState,
        floodedTiles: nextFloodedTiles,
        pendingChoice: nextPendingChoice,
      },
    },
    message: nextPendingChoice
      ? `${selectedOption.label} is Flooded. ${remaining} more tile${remaining !== 1 ? "s" : ""} to flood for setup.`
      : `${selectedOption.label} is Flooded. Setup complete — the tide begins to rise!`,
  };
}

// ---------------------------------------------------------------------------
// Flood tile selection — called from resolveActionState when the pending
// choice type is "flood-tile-selection" and the traitor picks a tile.
// Win check is deferred to the START of the shark's next turn.
// ---------------------------------------------------------------------------

/* [FLOODING] Resolves the traitor's flood tile selection. Exported so resolveActionState can dispatch it. */
export function resolveFloodTileSelectionState(game, optionId) {
  if (game.activeHauntId !== "haunt_28" || !game.hauntState) return game;
  const scenarioState = getScenarioState(game.hauntState);
  const pendingChoice = scenarioState.pendingChoice;
  if (pendingChoice?.type !== "flood-tile-selection") return game;

  const selectedOption = (pendingChoice.options || []).find((opt) => opt.id === optionId);
  if (!selectedOption) return game;

  // Mark the tile as flooded and open all 4 doors + clear card type on the board tile
  const newFloodedTile = { floor: selectedOption.floor, x: selectedOption.x, y: selectedOption.y };
  const nextFloodedTiles = [...scenarioState.floodedTiles, newFloodedTile];
  const nextBoard = applyFloodToBoardState(game.board, selectedOption.floor, selectedOption.x, selectedOption.y);

  // Win check is deferred: the shark only wins at the START of its own turn.
  return {
    ...game,
    board: nextBoard,
    hauntState: {
      ...game.hauntState,
      scenarioState: {
        ...scenarioState,
        pendingChoice: null,
        floodedTiles: nextFloodedTiles,
      },
    },
    message: `${selectedOption.label} is now Flooded.`,
  };
}
