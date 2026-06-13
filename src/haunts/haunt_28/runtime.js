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

/* [HAUNT-SETUP] Called once when the haunt begins: floods the traitor's starting tile. */
export function onHauntBegin(game) {
  const scenarioState = getScenarioState(game.hauntState);
  const traitorIndex = game.hauntState.traitorPlayerIndex;
  const traitor = game.players[traitorIndex];
  if (!traitor) return scenarioState;
  const { floor, x, y } = traitor;
  if (isTileFlooded(scenarioState.floodedTiles, floor, x, y)) return scenarioState;
  return {
    ...scenarioState,
    floodedTiles: [...scenarioState.floodedTiles, { floor, x, y }],
  };
}

/* [LOOKUP] Returns true if { floor, x, y } is a Flooded tile. */
function isTileFlooded(floodedTiles, floor, x, y) {
  return floodedTiles.some((t) => t.floor === floor && t.x === x && t.y === y);
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
// The shark is NOT a dead player proxy — it's always on the board independently.
// Heroes/traitor are never proxied for haunt 28. Return null always.
// ---------------------------------------------------------------------------

/* [COMBAT] [VALIDATION] Haunt 28 has no combat actor proxy (shark is not a player). */
export function getCombatActorProxyState() {
  return null;
}

// ---------------------------------------------------------------------------
// Exported hook: getSpecialMoveOptionsState
// The shark's "Cue Ominous Music" teleport is handled via haunt action buttons,
// not the movement grid. So no special move overrides for any player.
// ---------------------------------------------------------------------------

/* [MOVEMENT] Haunt 28 has no special movement overrides (shark moves via action button). */
export function getSpecialMoveOptionsState() {
  return null;
}

// ---------------------------------------------------------------------------
// Exported hook: getTileTokenLabelsState
// ---------------------------------------------------------------------------

/* [BOARD-LAYOUT] Returns token labels for haunt 28: flooded tiles and Ghost Shark position. */
export function getTileTokenLabelsState(game, { floor, x, y }) {
  if (game.activeHauntId !== "haunt_28" || !game.hauntState) return [];

  const scenarioState = getScenarioState(game.hauntState);
  const labels = [];

  if (isTileFlooded(scenarioState.floodedTiles, floor, x, y)) {
    labels.push({ label: "Flooded", variant: "flooded" });
  }

  const shark = scenarioState.ghostShark;
  if (shark?.active && shark.floor === floor && shark.x === x && shark.y === y) {
    labels.push({ label: "Great White Ghost Shark", variant: "monster" });
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

/* [PLAYER-STATE] Haunt 28: no dead-player-takes-turn mechanic (shark is not a dead player). */
export function canDeadPlayerTakeTurn() {
  return false;
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

  // Search for Explosives: hero, on an item-cardType tile, hasn't used this turn
  const onItemTile = !!currentTile && currentTile.cardType === "item";
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
  const canForce = canUseHeroAction && onSharkTile && hasExplosive && !forceAlreadyUsed;

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

  // Flood tile selection: handled via board tile highlighting, not buttons
  if (pendingChoice?.type === "flood-tile-selection") {
    return [];
  }

  // Pending tile selection for Cue Ominous Music
  if (pendingChoice?.type === "cue-ominous-music-placement") {
    return (pendingChoice.options || []).map((option) => ({
      id: `pending-cue-ominous-music:${option.id}`,
      label: `Move Shark to ${option.label}`,
      tone: "secondary",
      enabled: true,
    }));
  }

  // Pending explosive count selection for Force Explosives
  if (pendingChoice?.type === "force-explosives-discard") {
    return (pendingChoice.options || []).map((option) => ({
      id: `pending-force-explosives-discard:${option.value}`,
      label: option.label,
      tone: option.value === 0 ? "secondary" : "danger",
      enabled: true,
    }));
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
  if (typeof actionId === "string" && actionId.startsWith("pending-cue-ominous-music:")) {
    const optionId = actionId.replace("pending-cue-ominous-music:", "");
    return resolvePendingCueOminousMusicState(game, optionId);
  }
  if (typeof actionId === "string" && actionId.startsWith("pending-force-explosives-discard:")) {
    const value = Number(actionId.replace("pending-force-explosives-discard:", ""));
    return resolvePendingForceExplosivesDiscardState(game, value);
  }
  if (typeof actionId === "string" && actionId.startsWith("pending-flood-tile:")) {
    const optionId = actionId.replace("pending-flood-tile:", "");
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
  if (explosiveCount === 0) {
    return { ...game, message: "You need at least one Explosive to use this action." };
  }

  // Build discard options: 0 to explosiveCount tokens
  const options = Array.from({ length: explosiveCount + 1 }, (_, i) => ({
    value: i,
    label:
      i === 0 ? "Discard 0 Explosives (no bonus)" : `Discard ${i} Explosive${i !== 1 ? "s" : ""} (+${i * 2} to roll)`,
  }));

  return {
    ...game,
    hauntState: {
      ...game.hauntState,
      scenarioState: {
        ...scenarioState,
        pendingChoice: {
          type: "force-explosives-discard",
          actorIndex: game.currentPlayerIndex,
          usageKey,
          options,
        },
      },
    },
    message: `${currentPlayer.name} prepares to Force Explosives down the Shark's Throat. Choose how many to discard.`,
  };
}

/* [HAUNT-ACTION] [DICE-ROLL] Applies discard selection and starts the Might roll. */
function resolvePendingForceExplosivesDiscardState(game, discardCount) {
  if (game.activeHauntId !== "haunt_28" || !game.hauntState) return game;
  const scenarioState = getScenarioState(game.hauntState);
  const pendingChoice = scenarioState.pendingChoice;
  if (pendingChoice?.type !== "force-explosives-discard") return game;
  if (pendingChoice.actorIndex !== game.currentPlayerIndex) return game;

  const explosiveCount = getExplosiveCount(game, game.currentPlayerIndex);
  const safeDiscard = Math.min(discardCount, explosiveCount);
  const hasDynamite = playerHasDynamite(game, game.currentPlayerIndex);
  const bonus = safeDiscard * 2 + (hasDynamite ? 2 : 0);

  // Remove discarded explosives
  const nextExplosives = {
    ...(scenarioState.playerExplosives || {}),
    [game.currentPlayerIndex]: Math.max(0, explosiveCount - safeDiscard),
  };

  const currentPlayer = getCurrentPlayer(game);
  const usageKey = pendingChoice.usageKey;

  return {
    ...buildPendingActionRoll(
      {
        ...game,
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
      safeDiscard > 0
        ? `${currentPlayer?.name} discards ${safeDiscard} Explosive${safeDiscard !== 1 ? "s" : ""} for +${safeDiscard * 2} bonus${hasDynamite ? " + Dynamite +2" : ""}. Roll Might to resolve.`
        : `${currentPlayer?.name} rolls Might (no explosives discarded${hasDynamite ? ", Dynamite +2" : ""}). Roll Might to resolve.`,
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

/* [HAUNT-ACTION] Moves the Ghost Shark to the selected Flooded tile. */
function resolvePendingCueOminousMusicState(game, optionId) {
  if (game.activeHauntId !== "haunt_28" || !game.hauntState) return game;
  const scenarioState = getScenarioState(game.hauntState);
  const pendingChoice = scenarioState.pendingChoice;
  if (pendingChoice?.type !== "cue-ominous-music-placement") return game;
  if (pendingChoice.actorIndex !== game.currentPlayerIndex) return game;

  const selectedOption = (pendingChoice.options || []).find((opt) => opt.id === optionId);
  if (!selectedOption) return game;

  const nextShark = {
    ...scenarioState.ghostShark,
    floor: selectedOption.floor,
    x: selectedOption.x,
    y: selectedOption.y,
  };

  const nextHauntState = markHauntActionUsed(game.hauntState, pendingChoice.usageKey);

  return {
    ...game,
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

/* [MOVEMENT] No special post-movement hooks needed for haunt 28. */
export function resolveAfterMovementState(_previousGame, nextGame) {
  return nextGame;
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

  // ---- Traitor turn: roll shark speed ----
  if (game.currentPlayerIndex === traitorIndex) {
    if (!shark?.active) return { game, diceAnimation: null };

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

// ---------------------------------------------------------------------------
// Flood tile selection — called from resolveActionState when the pending
// choice type is "flood-tile-selection" and the traitor picks a tile.
// Also handles the all-tiles-flooded win check.
// ---------------------------------------------------------------------------

/* [FLOODING] Resolves the traitor's flood tile selection. Exported so resolveActionState can dispatch it. */
export function resolveFloodTileSelectionState(game, optionId) {
  if (game.activeHauntId !== "haunt_28" || !game.hauntState) return game;
  const scenarioState = getScenarioState(game.hauntState);
  const pendingChoice = scenarioState.pendingChoice;
  if (pendingChoice?.type !== "flood-tile-selection") return game;

  const selectedOption = (pendingChoice.options || []).find((opt) => opt.id === optionId);
  if (!selectedOption) return game;

  // Mark the tile as flooded
  const newFloodedTile = { floor: selectedOption.floor, x: selectedOption.x, y: selectedOption.y };
  const nextFloodedTiles = [...scenarioState.floodedTiles, newFloodedTile];

  // Check traitor win: all non-landing tiles flooded
  const allFlooded = areAllTilesFlooded(game.board, nextFloodedTiles);
  if (allFlooded) {
    return {
      ...game,
      hauntState: {
        ...game.hauntState,
        scenarioState: {
          ...scenarioState,
          pendingChoice: null,
          floodedTiles: nextFloodedTiles,
        },
      },
      gamePhase: GAME_PHASES.GAME_OVER,
      turnPhase: "game-over",
      winnerTeam: HAUNT_TEAMS.TRAITOR,
      message: `${selectedOption.label} is Flooded. Every tile in the house is now Flooded. The Shark wins!`,
    };
  }

  return {
    ...game,
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
