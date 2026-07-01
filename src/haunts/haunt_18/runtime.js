import { GAME_PHASES, HAUNT_TEAMS } from "../core/hauntPhases";
import { STAT_LABELS } from "../../game/gameState";

// Illusion count = total number of players (heroes + traitor).
function getIllusionCount(game) {
  return game.players.length;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

/* [HAUNT-SETUP] Creates the clean starting scenario state for Haunt 18 (A Nice Ring to It). */
export function createInitialScenarioState() {
  return {
    // Illusion tokens currently on the board: [{ id: 1..N, floor, x, y }]
    // Token #1 is always the "real" traitor. All start face-down from the heroes' perspective.
    illusions: [],
    // Which illusion ID is the traitor's real body. Set by the traitor after placement.
    realIllusionId: null,
    // Whether the traitor is currently hidden among illusions (isAlive=false on player record).
    isHidden: false,
    // Which illusion the traitor is actively controlling this turn.
    activeIllusionId: null,
    // Illusion IDs that have already taken their sub-turn this traitor turn.
    illusionsMovedThisTurn: [],
    // Max illusion count. Decreases by 1 each time the REAL traitor (#1) is found.
    maxIllusionId: 0,
    pendingChoice: null,
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

/* [HAUNT-ACTION] Creates a "turnNumber:playerIndex:actionId" key for once-per-turn gating. */
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
    illusions: s.illusions || defaults.illusions,
    realIllusionId: s.realIllusionId ?? defaults.realIllusionId,
    isHidden: s.isHidden ?? defaults.isHidden,
    activeIllusionId: s.activeIllusionId ?? defaults.activeIllusionId,
    illusionsMovedThisTurn: s.illusionsMovedThisTurn || [],
    maxIllusionId: s.maxIllusionId ?? defaults.maxIllusionId,
    pendingChoice: s.pendingChoice || null,
  };
}

/* [LOOKUP] Returns all non-traitor player indexes. */
function getHeroIndexes(game) {
  if (!game.hauntState) return [];
  const traitorIndex = game.hauntState.traitorPlayerIndex;
  return game.players.map((_, i) => i).filter((i) => i !== traitorIndex);
}

/* [LOOKUP] Returns living hero player indexes. */
function getLivingHeroIndexes(game) {
  return getHeroIndexes(game).filter((i) => game.players[i]?.isAlive);
}

/* [VALIDATION] Returns true if the given player index is a hero (not the traitor). */
function isHero(game, playerIndex) {
  return getHeroIndexes(game).includes(playerIndex);
}

/* [LOOKUP] Returns true if there is an illusion token at the given board position. */
function hasTileIllusion(illusions, floor, x, y) {
  return illusions.some((ill) => ill.floor === floor && ill.x === x && ill.y === y);
}

/* [LOOKUP] Returns the illusion at the given board position, or null. */
function getIllusionAtPosition(illusions, floor, x, y) {
  return illusions.find((ill) => ill.floor === floor && ill.x === x && ill.y === y) || null;
}

/* [HAUNT-SETUP] [STAT-CHANGE] Resets a player's stats to their starting index values and marks them alive. */
function healAllTraits(player) {
  const statIndex = {};
  for (const stat of ["might", "speed", "sanity", "knowledge"]) {
    statIndex[stat] = Math.max(
      player.statIndex[stat] ?? 0,
      player.character?.startIndex?.[stat] ?? player.statIndex[stat] ?? 0
    );
  }
  return { ...player, statIndex, isAlive: true };
}

/* [LOOKUP] Returns a player's current Speed stat value (number of dice / moves). */
function getSpeedStatValue(player) {
  const speedIdx = player.statIndex?.speed ?? 0;
  return player.character?.speed?.[speedIdx] ?? 0;
}

/* [LOOKUP] Returns the number of omen cards a player holds. */
function getOmenCount(player) {
  return (player?.omens || []).length;
}

/* [LOOKUP] Returns true if the player has the Mirror item in their inventory. */
function playerHasMirror(player) {
  return (player?.inventory || []).some((card) => card.id === "mirror");
}

/* [HAUNT-SETUP] Multi-floor BFS from (startFloor, startX, startY) up to `range` moves.
   Follows door connections on the same floor AND stair/connectsTo links between floors.
   Returns an array of { tile, dist, floor } sorted by distance, excluding the starting tile. */
function bfsTilesInRange(board, startFloor, startX, startY, range) {
  const DIR_VECTORS = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
  const OPPOSITE_DIR = { N: "S", S: "N", E: "W", W: "E" };
  const FLOORS = ["ground", "upper", "basement"];

  /* Quick lookup: floor → Map("x:y" → tile) */
  const tileMapByFloor = {};
  for (const fl of FLOORS) {
    tileMapByFloor[fl] = new Map();
    for (const t of board[fl] || []) tileMapByFloor[fl].set(`${t.x}:${t.y}`, t);
  }

  const visited = new Set();
  const results = [];
  const startTile = tileMapByFloor[startFloor]?.get(`${startX}:${startY}`);
  if (!startTile) return [];

  const queue = [{ floor: startFloor, x: startX, y: startY, dist: 0 }];
  visited.add(`${startFloor}:${startX}:${startY}`);

  while (queue.length > 0) {
    const { floor, x, y, dist } = queue.shift();
    const tile = tileMapByFloor[floor]?.get(`${x}:${y}`);
    if (!tile) continue;

    if (dist > 0) results.push({ tile, dist, floor });
    if (dist >= range) continue;

    // --- Same-floor door neighbours ---
    for (const dir of tile.doors || []) {
      const [dx, dy] = DIR_VECTORS[dir];
      const nx = x + dx;
      const ny = y + dy;
      const nKey = `${floor}:${nx}:${ny}`;
      if (visited.has(nKey)) continue;
      const neighbor = tileMapByFloor[floor]?.get(`${nx}:${ny}`);
      if (!neighbor) continue;
      if (!(neighbor.doors || []).includes(OPPOSITE_DIR[dir])) continue;
      visited.add(nKey);
      queue.push({ floor, x: nx, y: ny, dist: dist + 1 });
    }

    // --- Cross-floor stair connections (connectsTo) ---
    if (tile.connectsTo) {
      for (const fl of FLOORS) {
        const connected = (board[fl] || []).find((t) => t.id === tile.connectsTo);
        if (!connected) continue;
        const cKey = `${fl}:${connected.x}:${connected.y}`;
        if (visited.has(cKey)) continue;
        visited.add(cKey);
        queue.push({ floor: fl, x: connected.x, y: connected.y, dist: dist + 1 });
      }
    }
    // Also check tiles on other floors that connect back to this tile.
    for (const fl of FLOORS) {
      if (fl === floor) continue;
      for (const otherTile of board[fl] || []) {
        if (otherTile.connectsTo !== tile.id) continue;
        const cKey = `${fl}:${otherTile.x}:${otherTile.y}`;
        if (visited.has(cKey)) continue;
        visited.add(cKey);
        queue.push({ floor: fl, x: otherTile.x, y: otherTile.y, dist: dist + 1 });
      }
    }
  }

  return results.sort((a, b) => a.dist - b.dist);
}

/* [HAUNT-ACTION] Removes hauntActionRoll from game state. */
function clearHauntActionRoll(game) {
  if (!game.hauntActionRoll) return game;
  return { ...game, hauntActionRoll: null };
}

/* [HAUNT-ACTION] Returns the current hauntActionRoll, or null. */
function getActionRoll(game) {
  return game.hauntActionRoll || null;
}

/* [HAUNT-ACTION] Computes roll result fields from a settled roll. */
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
    extra: rollState.extra || {},
  };
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
      extra: options.extra || {},
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

/* [HAUNT-MECHANIC] Core dispel logic. Removes an illusion from the board, recalls all others,
   decrements maxIllusionId, and reveals the traitor if the dispelled token was #1.
   Returns the updated game state. */
function applyDispelIllusion(game, illusionId) {
  const scenarioState = getScenarioState(game.hauntState);
  const traitorIndex = game.hauntState.traitorPlayerIndex;

  // Find where the dispelled illusion was (needed if it's the real one for traitor reveal).
  const dispelledIllusion = scenarioState.illusions.find((ill) => ill.id === illusionId);
  const realId = scenarioState.realIllusionId ?? 1;
  const isRealTraitor = illusionId === realId;

  if (isRealTraitor && dispelledIllusion) {
    // Real body found: ALL illusions recalled, traitor revealed at that tile, lose a token.
    const nextMaxIllusionId = Math.max(0, scenarioState.maxIllusionId - 1);
    const traitor = game.players[traitorIndex];
    const revivedTraitor = {
      ...traitor,
      isAlive: true,
      floor: dispelledIllusion.floor,
      x: dispelledIllusion.x,
      y: dispelledIllusion.y,
      movesLeft: 0,
    };
    const nextPlayers = game.players.map((p, i) => (i === traitorIndex ? revivedTraitor : p));
    const tokensLeft = nextMaxIllusionId;
    return {
      ...game,
      players: nextPlayers,
      hauntState: {
        ...game.hauntState,
        scenarioState: {
          ...scenarioState,
          illusions: [], // all recalled
          maxIllusionId: nextMaxIllusionId,
          realIllusionId: null,
          activeIllusionId: null,
          isHidden: false,
        },
      },
      message: `The real body was revealed! The traitor has been exposed. They appear at ${dispelledIllusion.floor} (${dispelledIllusion.x}, ${dispelledIllusion.y}). ${tokensLeft} Illusion token${tokensLeft !== 1 ? "s" : ""} remain.`,
    };
  }

  // Not the real body: remove ONLY this one illusion, others stay, no token lost.
  const remainingIllusions = scenarioState.illusions.filter((ill) => ill.id !== illusionId);
  const illusionsLeft = remainingIllusions.length;
  return {
    ...game,
    hauntState: {
      ...game.hauntState,
      scenarioState: {
        ...scenarioState,
        illusions: remainingIllusions,
        activeIllusionId: scenarioState.activeIllusionId === illusionId ? null : scenarioState.activeIllusionId,
        isHidden: true,
      },
    },
    message: `That Illusion was not the real body! It vanishes. ${illusionsLeft} Illusion${illusionsLeft !== 1 ? "s" : ""} still remain.`,
  };
}

// ---------------------------------------------------------------------------
// Exported hook: onHauntBegin
// Heals the traitor, places illusion tokens, and marks the traitor as hidden.
// ---------------------------------------------------------------------------

/* [HAUNT-SETUP] Computes available placement options for the traitor: all tiles reachable from
   illusion #1's position within Speed range, excluding tiles that already have an illusion. */
function computePlaceIllusionOptions(game, traitorIndex, placedKeys) {
  const traitor = game.players[traitorIndex];
  const illusion1 = game.hauntState?.scenarioState?.illusions?.find((ill) => ill.id === 1);
  const origin = illusion1 || { floor: traitor.floor, x: traitor.x, y: traitor.y };
  const speed = getSpeedStatValue(traitor);
  const tilesInRange = bfsTilesInRange(game.board, origin.floor, origin.x, origin.y, Math.max(speed, 1));
  const keySet = new Set(Array.isArray(placedKeys) ? placedKeys : []);
  return tilesInRange
    .filter((t) => !keySet.has(`${t.floor}:${t.tile.x}:${t.tile.y}`))
    .map((t) => ({
      id: `place-illusion-tile:${t.floor}:${t.tile.x}:${t.tile.y}`,
      label: `Place Illusion (${t.tile.x}, ${t.tile.y})`,
      floor: t.floor,
      x: t.tile.x,
      y: t.tile.y,
    }));
}

/* [HAUNT-SETUP] Called once when the haunt begins: heals traitor, places illusion #1 on traitor's
   tile, then prompts the traitor to manually place the remaining illusions. */
export function onHauntBegin(game) {
  const traitorIndex = game.hauntState.traitorPlayerIndex;
  const illusionCount = getIllusionCount(game);

  // 1. Heal the traitor's traits.
  const healedTraitor = healAllTraits(game.players[traitorIndex]);
  const speed = getSpeedStatValue(healedTraitor);

  // 2. Illusion #1 is always placed on the traitor's starting tile (it is the "real" traitor).
  const traitorPos = { floor: healedTraitor.floor, x: healedTraitor.x, y: healedTraitor.y };
  const firstIllusion = { id: 1, ...traitorPos };
  const firstKey = `${traitorPos.floor}:${traitorPos.x}:${traitorPos.y}`;

  // 3. Hide the traitor figure, but keep them alive for turn-order logic.
  const hiddenTraitor = { ...healedTraitor, isAlive: true, movesLeft: 0 };
  const nextPlayers = game.players.map((p, i) => (i === traitorIndex ? hiddenTraitor : p));
  const gameWithPlayers = { ...game, players: nextPlayers };

  const remaining = illusionCount - 1;

  // 4. Edge case: only 1 illusion total — only one possible real body, auto-set it.
  if (remaining <= 0) {
    return {
      ...gameWithPlayers,
      hauntState: {
        ...game.hauntState,
        scenarioState: {
          ...getScenarioState(game.hauntState),
          illusions: [firstIllusion],
          realIllusionId: 1,
          isHidden: true,
          activeIllusionId: null,
          illusionsMovedThisTurn: [],
          maxIllusionId: illusionCount,
          pendingChoice: null,
        },
      },
      message: `The traitor has become an Illusion! Heroes must find the real one.`,
    };
  }

  // 5. Give the turn to the traitor so they can manually place the remaining illusions.
  const firstHeroPlayerIndex = game.currentPlayerIndex;
  const tempGame = {
    ...gameWithPlayers,
    hauntState: {
      ...game.hauntState,
      scenarioState: { ...getScenarioState(game.hauntState), illusions: [firstIllusion] },
    },
  };
  const options = computePlaceIllusionOptions(tempGame, traitorIndex, [firstKey]);

  return {
    ...gameWithPlayers,
    currentPlayerIndex: traitorIndex,
    movePath: [{ x: traitorPos.x, y: traitorPos.y, floor: traitorPos.floor, cost: 0 }],
    hauntState: {
      ...game.hauntState,
      scenarioState: {
        ...getScenarioState(game.hauntState),
        illusions: [firstIllusion],
        isHidden: true,
        activeIllusionId: null,
        illusionsMovedThisTurn: [],
        maxIllusionId: illusionCount,
        pendingChoice: {
          type: "place-illusion",
          source: "setup",
          remaining,
          firstHeroPlayerIndex,
          placedKeys: [firstKey],
          options,
        },
      },
    },
    message: `Illusion #1 placed on your tile. Place ${remaining} more Illusion${remaining !== 1 ? "s" : ""} within ${speed} tile${speed !== 1 ? "s" : ""} — click highlighted tiles on the board.`,
  };
}

// ---------------------------------------------------------------------------
// Exported hook: resolveAfterDamageState
// Heroes win: when traitor (revealed) dies.
// Traitor wins: when all heroes are dead.
// ---------------------------------------------------------------------------

/* [HAUNT-DAMAGE] Checks win conditions after damage is applied. */
export function resolveAfterDamageState(previousGame, nextGame) {
  if (nextGame.activeHauntId !== "haunt_18" || !nextGame.hauntState) return nextGame;
  if (nextGame.gamePhase === GAME_PHASES.GAME_OVER) return nextGame;

  const traitorIndex = nextGame.hauntState.traitorPlayerIndex;
  const scenarioState = getScenarioState(nextGame.hauntState);

  // Heroes win: traitor is revealed (!isHidden) and their player record is now dead.
  if (
    !scenarioState.isHidden &&
    previousGame.players[traitorIndex]?.isAlive === true &&
    nextGame.players[traitorIndex]?.isAlive === false
  ) {
    return {
      ...nextGame,
      gamePhase: GAME_PHASES.GAME_OVER,
      turnPhase: "game-over",
      winnerTeam: HAUNT_TEAMS.HEROES,
      message: "The traitor has been slain! Heroes win!",
    };
  }

  // Traitor wins: all living heroes are dead.
  const livingHeroes = getLivingHeroIndexes(nextGame);
  if (livingHeroes.length === 0) {
    return {
      ...nextGame,
      gamePhase: GAME_PHASES.GAME_OVER,
      turnPhase: "game-over",
      winnerTeam: HAUNT_TEAMS.TRAITOR,
      message: "All heroes are dead. The traitor wins!",
    };
  }

  return nextGame;
}

// ---------------------------------------------------------------------------
// Exported hook: canDeadPlayerTakeTurn
// When the traitor is hidden (isAlive=false, isHidden=true), they still take turns
// to move their Illusions — same pattern as haunt_28 ghost shark.
// ---------------------------------------------------------------------------

/* [PLAYER-STATE] Hidden traitor still gets turns to move their Illusions. */
export function canDeadPlayerTakeTurn(game, playerIndex) {
  if (game.activeHauntId !== "haunt_18" || !game.hauntState) return false;
  if (playerIndex !== game.hauntState.traitorPlayerIndex) return false;
  const scenarioState = getScenarioState(game.hauntState);
  return scenarioState.isHidden === true;
}

// ---------------------------------------------------------------------------
// Exported hook: resolveTurnStartState
// At the start of the hidden traitor's turn, position them at their first available
// illusion and grant Speed moves. Heroes have a normal turn start.
// ---------------------------------------------------------------------------

/* [HAUNT-ACTION] At start of the traitor's turn:
   - If hidden (illusions active): reset illusionsMovedThisTurn so all illusions can move again.
   - Traitor must use "Move Illusion #N" buttons to pick which illusion moves first.
   - If not hidden (revealed, no illusions): take a normal turn — nothing special needed. */
export function resolveTurnStartState(game) {
  if (game.activeHauntId !== "haunt_18" || game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || !game.hauntState) {
    return { game, diceAnimation: null };
  }

  const traitorIndex = game.hauntState.traitorPlayerIndex;
  if (game.currentPlayerIndex !== traitorIndex) {
    return { game, diceAnimation: null };
  }

  const scenarioState = getScenarioState(game.hauntState);

  // During manual illusion placement or real-body selection, skip the normal turn-start logic.
  const pendingType = scenarioState.pendingChoice?.type;
  if (pendingType === "place-illusion" || pendingType === "select-real-body") {
    return { game, diceAnimation: null };
  }

  if (!scenarioState.isHidden || scenarioState.illusions.length === 0) {
    return { game, diceAnimation: null };
  }

  // Reset per-turn illusion tracking so all illusions may move this turn.
  return {
    game: {
      ...game,
      hauntState: {
        ...game.hauntState,
        scenarioState: {
          ...scenarioState,
          illusionsMovedThisTurn: [],
          activeIllusionId: null,
        },
      },
      message: `The traitor's turn. Choose an Illusion to move (${scenarioState.illusions.length} remaining).`,
    },
    diceAnimation: null,
  };
}

// ---------------------------------------------------------------------------
// Exported hook: resolveAfterMovementState
// Syncs the traitor's player position back to the active illusion in scenarioState.
// ---------------------------------------------------------------------------

/* [MOVEMENT] After each traitor move step, sync active illusion position to player position. */
export function resolveAfterMovementState(previousGame, nextGame) {
  if (nextGame.activeHauntId !== "haunt_18" || !nextGame.hauntState) return nextGame;

  const traitorIndex = nextGame.hauntState.traitorPlayerIndex;
  if (nextGame.currentPlayerIndex !== traitorIndex) return nextGame;

  const scenarioState = getScenarioState(nextGame.hauntState);
  if (!scenarioState.isHidden || scenarioState.activeIllusionId == null) return nextGame;

  const traitorPos = nextGame.players[traitorIndex];
  if (!traitorPos) return nextGame;

  const nextIllusions = scenarioState.illusions.map((ill) =>
    ill.id === scenarioState.activeIllusionId
      ? { ...ill, floor: traitorPos.floor, x: traitorPos.x, y: traitorPos.y }
      : ill
  );

  return {
    ...nextGame,
    hauntState: {
      ...nextGame.hauntState,
      scenarioState: { ...scenarioState, illusions: nextIllusions },
    },
  };
}

// ---------------------------------------------------------------------------
// Exported hook: getSpecialMoveOptionsState
// Illusions move like monsters: only existing placed tiles, no exploration.
// ---------------------------------------------------------------------------

/* [MOVEMENT] Illusions can only move to placed tiles — no exploration. */
export function getSpecialMoveOptionsState({ game, currentPlayer, DIR, getTileAt, backtrackPos }) {
  if (game.activeHauntId !== "haunt_18" || game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || !game.hauntState) {
    return null;
  }

  const traitorIndex = game.hauntState.traitorPlayerIndex;
  if (game.currentPlayerIndex !== traitorIndex) return null;

  const scenarioState = getScenarioState(game.hauntState);
  if (!scenarioState.isHidden) return null;

  // Monster movement: only placed tiles, no exploration.
  const OPPOSITE_DIR = { N: "S", S: "N", E: "W", W: "E" };
  const tile = getTileAt(currentPlayer.x, currentPlayer.y, currentPlayer.floor);
  if (!tile) return [];

  const movesLeft = Number(currentPlayer?.movesLeft) || 0;
  const isFirstMove = !game.hasMovedThisTurn;

  const hasObstacleToken = Array.isArray(tile?.tokens) && tile.tokens.some((token) => token?.type === "obstacle");
  const tileLeaveCost = tile?.obstacle || hasObstacleToken ? 2 : 1;

  // Heroes on the same tile add to leave cost.
  const heroesOnTile = getHeroIndexes(game).filter((hi) => {
    const h = game.players[hi];
    return h?.isAlive && h.floor === currentPlayer.floor && h.x === currentPlayer.x && h.y === currentPlayer.y;
  }).length;

  const moveCost = tileLeaveCost + heroesOnTile;
  const canAffordMove = movesLeft >= moveCost || (isFirstMove && movesLeft > 0);

  const moves = [];
  for (const dir of tile.doors || []) {
    const { dx, dy } = DIR[dir];
    const nx = currentPlayer.x + dx;
    const ny = currentPlayer.y + dy;
    const neighbor = getTileAt(nx, ny, currentPlayer.floor);
    if (!neighbor) continue; // No tile here — illusions never explore.
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
// Exported hook: getCombatActorProxyState
// When the traitor is hidden, they fight as the Illusion token on the attacking
// hero's tile. Returns the proxy with the traitor's current stat dice counts.
// ---------------------------------------------------------------------------

/* [COMBAT] Returns an Illusion on the hero's tile as the traitor's combat proxy. */
export function getCombatActorProxyState(game, actorIndex) {
  if (game.activeHauntId !== "haunt_18" || !game.hauntState) return null;

  const traitorIndex = game.hauntState.traitorPlayerIndex;
  if (actorIndex !== traitorIndex) return null;

  const scenarioState = getScenarioState(game.hauntState);
  if (!scenarioState.isHidden || scenarioState.illusions.length === 0) return null;

  // The current player is the hero who is about to attack.
  // Find the illusion on the hero's tile.
  const hero = game.players[game.currentPlayerIndex];
  if (!hero?.isAlive) return null;

  const illusion = getIllusionAtPosition(scenarioState.illusions, hero.floor, hero.x, hero.y);
  if (!illusion) return null;

  const traitor = game.players[traitorIndex];
  const mightIdx = traitor.statIndex?.might ?? 0;
  const speedIdx = traitor.statIndex?.speed ?? 0;
  const sanityIdx = traitor.statIndex?.sanity ?? 0;
  const knowledgeIdx = traitor.statIndex?.knowledge ?? 0;

  return {
    name: "Illusion",
    floor: illusion.floor,
    x: illusion.x,
    y: illusion.y,
    illusionId: illusion.id,
    statDiceCounts: {
      might: traitor.character?.might?.[mightIdx] ?? 0,
      speed: traitor.character?.speed?.[speedIdx] ?? 0,
      sanity: traitor.character?.sanity?.[sanityIdx] ?? 0,
      knowledge: traitor.character?.knowledge?.[knowledgeIdx] ?? 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Exported hook: resolveCombatOutcomeState
// When a hero wins combat against a hidden traitor (illusion proxy), dispel the illusion.
// If that illusion reveals the traitor (#1), no damage is dealt.
// ---------------------------------------------------------------------------

/* [HAUNT-COMBAT] Dispels the illusion when a hero wins combat. No damage if traitor is revealed. */
export function resolveCombatOutcomeState(game, outcome, combatState) {
  if (game.activeHauntId !== "haunt_18" || !game.hauntState) return null;

  const traitorIndex = game.hauntState.traitorPlayerIndex;
  const scenarioState = getScenarioState(game.hauntState);

  // Only intercept when the traitor was the defender and is hidden.
  if (combatState.defenderIndex !== traitorIndex) return null;
  if (!scenarioState.isHidden) return null;

  // Tie or zero damage: let default handle it.
  if (outcome.tie || outcome.loserIndex == null) return null;

  if (outcome.winnerIndex === combatState.attackerIndex) {
    // Hero wins: dispel the illusion on the hero's tile.
    const attacker = game.players[combatState.attackerIndex];
    const illusion = getIllusionAtPosition(scenarioState.illusions, attacker.floor, attacker.x, attacker.y);

    if (!illusion) return null;

    const dispelResult = applyDispelIllusion(game, illusion.id);
    const realId = scenarioState.realIllusionId ?? 1;
    const isRevealedNow = illusion.id === realId;

    return {
      ...dispelResult,
      combatState: null,
      // "If an attack reveals the traitor, that attack does no damage."
      damageChoice: isRevealedNow ? null : dispelResult.damageChoice,
      message: isRevealedNow
        ? `${outcome.winnerName} strikes the Illusion — it's the real body! The traitor is revealed! No damage (the attack was against an illusion). ${dispelResult.message}`
        : `${outcome.winnerName} strikes the Illusion! ${dispelResult.message}`,
    };
  }

  // Traitor (illusion) wins: hero takes damage via default logic.
  return null;
}

// ---------------------------------------------------------------------------
// Exported hook: getActionAvailabilityState
// ---------------------------------------------------------------------------

/* [HAUNT-ACTION] [VALIDATION] Returns which haunt action buttons are available. */
export function getActionAvailabilityState(game, { hauntActionLocked }) {
  if (game.activeHauntId !== "haunt_18" || game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || !game.hauntState) {
    return {};
  }

  const scenarioState = getScenarioState(game.hauntState);
  const traitorIndex = game.hauntState.traitorPlayerIndex;
  const currentPlayer = getCurrentPlayer(game);

  if (scenarioState.pendingChoice) return {};

  // ---- Traitor actions ----
  if (game.currentPlayerIndex === traitorIndex) {
    if (scenarioState.isHidden) {
      // One "Move Illusion #N" button per illusion that hasn't moved yet and isn't the active one.
      const switchAvailability = {};
      const moved = scenarioState.illusionsMovedThisTurn || [];
      for (const ill of scenarioState.illusions) {
        const alreadyMoved = moved.includes(ill.id);
        const isActive = ill.id === scenarioState.activeIllusionId;
        switchAvailability[`selectIllusion${ill.id}`] = !alreadyMoved && !isActive && !hauntActionLocked;
      }
      return switchAvailability;
    }

    // Traitor is revealed — can summon illusions (once per turn, needs tokens remaining).
    const summonUsageKey = createUsageKey(game, "summon-illusions");
    const canSummon =
      !hauntActionLocked && scenarioState.maxIllusionId > 0 && !game.hauntState.oncePerTurnUsage?.[summonUsageKey];
    return { summonIllusions: canSummon };
  }

  // ---- Hero actions ----
  if (!isHero(game, game.currentPlayerIndex)) return {};
  if (!currentPlayer?.isAlive || hauntActionLocked) return {};

  const currentTile = getCurrentTile(game);
  const onIllusionTile =
    !!currentTile && hasTileIllusion(scenarioState.illusions, currentPlayer.floor, currentTile.x, currentTile.y);
  const onVaultTile = currentTile?.id === "vault";

  const confrontKey = createUsageKey(game, "confront-illusion");
  const callKey = createUsageKey(game, "call-to-ring");

  return {
    confrontIllusion: onIllusionTile && !game.hauntState.oncePerTurnUsage?.[confrontKey],
    callToRing: onVaultTile && !game.hauntState.oncePerTurnUsage?.[callKey],
  };
}

// ---------------------------------------------------------------------------
// Exported hook: getActionButtonsState
// ---------------------------------------------------------------------------

/* [HAUNT-ACTION] [OVERLAY] Returns the list of action buttons for the haunt panel. */
export function getActionButtonsState(game, context) {
  if (game.activeHauntId !== "haunt_18" || !game.hauntState) return [];

  const availability = getActionAvailabilityState(game, context);
  const buttons = [];
  const scenarioState = getScenarioState(game.hauntState);
  const traitorIndex = game.hauntState.traitorPlayerIndex;

  if (game.currentPlayerIndex === traitorIndex) {
    if (scenarioState.isHidden) {
      const moved = scenarioState.illusionsMovedThisTurn || [];
      for (const ill of scenarioState.illusions.slice().sort((a, b) => a.id - b.id)) {
        const key = `selectIllusion${ill.id}`;
        const isActive = ill.id === scenarioState.activeIllusionId;
        const hasMoved = moved.includes(ill.id);
        if (hasMoved) {
          buttons.push({
            id: `select-illusion-${ill.id}`,
            label: `Illusion #${ill.id} ✓ (done)`,
            tone: "secondary",
            enabled: false,
          });
        } else if (isActive) {
          buttons.push({
            id: `select-illusion-${ill.id}`,
            label: `Illusion #${ill.id} (moving now)`,
            tone: "secondary",
            enabled: false,
          });
        } else if (availability[key]) {
          buttons.push({
            id: `select-illusion-${ill.id}`,
            label: `Move Illusion #${ill.id}`,
            tone: "secondary",
            enabled: true,
          });
        }
      }
    } else if (availability.summonIllusions) {
      buttons.push({
        id: "summon-illusions",
        label: `Summon Illusions (${scenarioState.maxIllusionId} token${scenarioState.maxIllusionId !== 1 ? "s" : ""})`,
        tone: "secondary",
        enabled: true,
      });
    }
    return buttons;
  }

  if (availability.confrontIllusion) {
    const hero = getCurrentPlayer(game);
    const bonus = playerHasMirror(hero) ? 2 : 0;
    buttons.push({
      id: "confront-illusion",
      label: `Confront an Illusion (Knowledge${bonus > 0 ? " +2" : ""})`,
      tone: "secondary",
      enabled: true,
    });
  }

  if (availability.callToRing) {
    const hero = getCurrentPlayer(game);
    const omenCount = getOmenCount(hero);
    const bonus = omenCount > 0 ? omenCount : 0;
    buttons.push({
      id: "call-to-ring",
      label: `Call to the Ring (Sanity${bonus > 0 ? ` +${bonus}` : ""})`,
      tone: "secondary",
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
  if (game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || game.activeHauntId !== "haunt_18") return null;

  const rollResult = getActionRollResult(game);
  if (!rollResult) return null;
  const statLabel = STAT_LABELS[rollResult.stat] || "Trait";

  if (rollResult.actionId === "confront-illusion") {
    return {
      title: "Confront an Illusion",
      thresholdLabel: "Need 5+ Knowledge",
      outcomeLabel: rollResult.success ? "Illusion Dispelled!" : "Failed",
      outcomeDescription: rollResult.success
        ? "The Illusion is dispelled. If it was #1, the traitor has been revealed!"
        : "Take one die of Mental damage.",
      totalLabel:
        rollResult.bonus > 0
          ? `${rollResult.rollTotal} + ${rollResult.bonus} = ${rollResult.effectiveTotal}`
          : `${rollResult.rollTotal}`,
    };
  }

  if (rollResult.actionId === "call-to-ring") {
    return {
      title: "Call to the Ring",
      thresholdLabel: `Need 8+ ${statLabel}`,
      outcomeLabel: rollResult.success ? "The ring responds!" : "Silence",
      outcomeDescription: rollResult.success
        ? "Deal one die of Mental damage to the traitor (if revealed), or dispel any Illusion."
        : "End your turn.",
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

/* [HAUNT-ACTION] Main action dispatcher for haunt 18. */
export function resolveActionState(game, { actionId }) {
  if (actionId === "confront-illusion") return resolveConfrontIllusionState(game);
  if (actionId === "call-to-ring") return resolveCallToRingState(game);
  if (actionId === "summon-illusions") return resolveSummonIllusionsState(game);
  if (actionId?.startsWith("select-illusion-")) {
    const id = parseInt(actionId.replace("select-illusion-", ""), 10);
    if (Number.isFinite(id)) return resolveSelectIllusionState(game, id);
  }
  if (actionId?.startsWith("dispel-illusion-choice-")) {
    const id = parseInt(actionId.replace("dispel-illusion-choice-", ""), 10);
    if (Number.isFinite(id)) return resolveDispelIllusionChoiceState(game, id);
  }
  if (actionId?.startsWith("place-illusion-tile:")) return resolvePlaceIllusionTileState(game, actionId);
  if (actionId?.startsWith("select-real-body-")) {
    const id = parseInt(actionId.replace("select-real-body-", ""), 10);
    if (Number.isFinite(id)) return resolveSelectRealBodyState(game, id);
  }
  return game;
}

/* [HAUNT-ACTION] Traitor picks which placed illusion is their real body. */
function resolveSelectRealBodyState(game, illusionId) {
  if (game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || game.activeHauntId !== "haunt_18" || !game.hauntState) return game;

  const traitorIndex = game.hauntState.traitorPlayerIndex;
  if (game.currentPlayerIndex !== traitorIndex) return game;

  const scenarioState = getScenarioState(game.hauntState);
  if (scenarioState.pendingChoice?.type !== "select-real-body") return game;

  const illusion = scenarioState.illusions.find((ill) => ill.id === illusionId);
  if (!illusion) return game;

  const { source, firstHeroPlayerIndex } = scenarioState.pendingChoice;

  const baseScenario = {
    ...scenarioState,
    realIllusionId: illusionId,
    pendingChoice: null,
  };

  if (source === "summon") {
    return {
      ...game,
      hauntState: { ...game.hauntState, scenarioState: baseScenario },
      turnPhase: "endTurn",
      message: `Real body chosen. The traitor vanishes! Turn ends.`,
    };
  }

  // Setup: hand control back to the first hero.
  const firstHero = game.players[firstHeroPlayerIndex];
  return {
    ...game,
    currentPlayerIndex: firstHeroPlayerIndex,
    movePath: [{ x: firstHero.x, y: firstHero.y, floor: firstHero.floor, cost: 0 }],
    hauntState: { ...game.hauntState, scenarioState: baseScenario },
    message: `Real body chosen. The haunt begins! ${firstHero.name} goes first.`,
  };
}

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

/* [HAUNT-ACTION] [DICE-ROLL] Sets up the Confront an Illusion roll (Knowledge, threshold 5, +2 if Mirror). */
function resolveConfrontIllusionState(game) {
  if (game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || game.activeHauntId !== "haunt_18" || !game.hauntState) return game;
  if (!isHero(game, game.currentPlayerIndex)) return game;

  const currentPlayer = getCurrentPlayer(game);
  if (!currentPlayer?.isAlive) return game;

  const scenarioState = getScenarioState(game.hauntState);
  const currentTile = getCurrentTile(game);
  if (!currentTile || !hasTileIllusion(scenarioState.illusions, currentPlayer.floor, currentTile.x, currentTile.y)) {
    return { ...game, message: "You must be on a tile with an Illusion to confront it." };
  }

  const usageKey = createUsageKey(game, "confront-illusion");
  if (game.hauntState.oncePerTurnUsage?.[usageKey]) {
    return { ...game, message: "Confront an Illusion has already been used this turn." };
  }

  const bonus = playerHasMirror(currentPlayer) ? 2 : 0;
  const bonusNote = bonus > 0 ? " — +2 bonus from Mirror" : "";

  return {
    ...buildPendingActionRoll(game, "confront-illusion", "knowledge", { usageKey, threshold: 5, bonus }),
    message: `${currentPlayer.name} confronts the Illusion. Roll Knowledge (need 5+)${bonusNote}.`,
  };
}

/* [HAUNT-ACTION] [DICE-ROLL] Sets up the Call to the Ring roll (Sanity + 1 per Omen, threshold 8). */
function resolveCallToRingState(game) {
  if (game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || game.activeHauntId !== "haunt_18" || !game.hauntState) return game;
  if (!isHero(game, game.currentPlayerIndex)) return game;

  const currentPlayer = getCurrentPlayer(game);
  if (!currentPlayer?.isAlive) return game;

  const currentTile = getCurrentTile(game);
  if (currentTile?.id !== "vault") {
    return { ...game, message: "You must be on the Vault tile to Call to the Ring." };
  }

  const usageKey = createUsageKey(game, "call-to-ring");
  if (game.hauntState.oncePerTurnUsage?.[usageKey]) {
    return { ...game, message: "Call to the Ring has already been used this turn." };
  }

  const omenBonus = getOmenCount(currentPlayer);
  const bonusNote = omenBonus > 0 ? ` — +${omenBonus} from ${omenBonus} Omen${omenBonus !== 1 ? "s" : ""}` : "";

  return {
    ...buildPendingActionRoll(game, "call-to-ring", "sanity", { usageKey, threshold: 8, bonus: omenBonus }),
    message: `${currentPlayer.name} calls to the Ring. Roll Sanity (need 8+)${bonusNote}.`,
  };
}

/* [HAUNT-ACTION] Traitor selects an illusion to move this turn.
   If switching away from a currently active illusion that has moved, mark that one as done.
   Each illusion gets one sub-turn (Speed moves) per traitor turn. */
function resolveSelectIllusionState(game, illusionId) {
  if (game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || game.activeHauntId !== "haunt_18" || !game.hauntState) return game;

  const traitorIndex = game.hauntState.traitorPlayerIndex;
  if (game.currentPlayerIndex !== traitorIndex) return game;

  const scenarioState = getScenarioState(game.hauntState);
  if (!scenarioState.isHidden) return game;

  const illusion = scenarioState.illusions.find((ill) => ill.id === illusionId);
  if (!illusion) return game;

  // Can't select an illusion that has already moved this turn.
  if ((scenarioState.illusionsMovedThisTurn || []).includes(illusionId)) {
    return { ...game, message: `Illusion #${illusionId} has already moved this turn.` };
  }

  // If another illusion is currently active and the traitor has moved, mark it as done.
  const previousActiveId = scenarioState.activeIllusionId;
  const moved = [...(scenarioState.illusionsMovedThisTurn || [])];
  if (previousActiveId != null && previousActiveId !== illusionId && !moved.includes(previousActiveId)) {
    moved.push(previousActiveId);
  }

  const traitor = game.players[traitorIndex];
  const speed = getSpeedStatValue(traitor);
  const moves = Math.max(1, speed);

  const nextPlayers = game.players.map((p, i) =>
    i === traitorIndex ? { ...p, floor: illusion.floor, x: illusion.x, y: illusion.y, movesLeft: moves } : p
  );

  const nextScenarioState = {
    ...scenarioState,
    activeIllusionId: illusionId,
    illusionsMovedThisTurn: moved,
  };

  return {
    ...game,
    players: nextPlayers,
    hauntState: { ...game.hauntState, scenarioState: nextScenarioState },
    hasMovedThisTurn: false,
    movePath: [{ x: illusion.x, y: illusion.y, floor: illusion.floor, cost: 0 }],
    message: `Now moving Illusion #${illusionId} (${moves} moves). ${scenarioState.illusions.length - moved.length - 1} other illusion${scenarioState.illusions.length - moved.length - 1 !== 1 ? "s" : ""} still to go.`,
  };
}

/* [HAUNT-ACTION] Traitor activates Summon Illusions: places all remaining tokens and hides.
   Available when: traitor is revealed (not hidden), has tokens remaining, hasn't summoned this turn. */
function resolveSummonIllusionsState(game) {
  if (game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || game.activeHauntId !== "haunt_18" || !game.hauntState) return game;

  const traitorIndex = game.hauntState.traitorPlayerIndex;
  if (game.currentPlayerIndex !== traitorIndex) return game;

  const scenarioState = getScenarioState(game.hauntState);
  if (scenarioState.isHidden) return game; // Already hidden.
  if (scenarioState.maxIllusionId <= 0) {
    return { ...game, message: "No Illusion tokens remain. You cannot summon Illusions." };
  }

  const usageKey = createUsageKey(game, "summon-illusions");
  if (game.hauntState.oncePerTurnUsage?.[usageKey]) {
    return { ...game, message: "Summon Illusions has already been used this turn." };
  }

  const traitor = game.players[traitorIndex];
  const illusionCount = scenarioState.maxIllusionId;
  const speed = getSpeedStatValue(traitor);

  // Illusion #1 is always placed on the traitor's current tile.
  const traitorPos = { floor: traitor.floor, x: traitor.x, y: traitor.y };
  const firstIllusion = { id: 1, ...traitorPos };
  const firstKey = `${traitorPos.floor}:${traitorPos.x}:${traitorPos.y}`;

  // Hide the traitor figure, but keep them alive for turn-order logic.
  const hiddenTraitor = { ...traitor, isAlive: true, movesLeft: 0 };
  const nextPlayers = game.players.map((p, i) => (i === traitorIndex ? hiddenTraitor : p));

  const remaining = illusionCount - 1;

  // Edge case: only 1 token — only one possible real body, auto-set and end turn.
  if (remaining <= 0) {
    const nextHauntState = markHauntActionUsed(
      {
        ...game.hauntState,
        scenarioState: {
          ...scenarioState,
          illusions: [firstIllusion],
          realIllusionId: 1,
          isHidden: true,
          activeIllusionId: null,
          illusionsMovedThisTurn: [],
          pendingChoice: null,
        },
      },
      usageKey
    );
    return {
      ...game,
      players: nextPlayers,
      hauntState: nextHauntState,
      turnPhase: "endTurn",
      message: `The traitor places 1 Illusion and vanishes! Turn ends.`,
    };
  }

  // Let the traitor manually place the remaining illusions within Speed range.
  const tempGame = {
    ...game,
    players: nextPlayers,
    hauntState: {
      ...game.hauntState,
      scenarioState: { ...scenarioState, illusions: [firstIllusion] },
    },
  };
  const options = computePlaceIllusionOptions(tempGame, traitorIndex, [firstKey]);

  const nextHauntState = markHauntActionUsed(
    {
      ...game.hauntState,
      scenarioState: {
        ...scenarioState,
        illusions: [firstIllusion],
        isHidden: true,
        activeIllusionId: null,
        illusionsMovedThisTurn: [],
        pendingChoice: {
          type: "place-illusion",
          source: "summon",
          remaining,
          placedKeys: [firstKey],
          options,
        },
      },
    },
    usageKey
  );

  return {
    ...game,
    players: nextPlayers,
    hauntState: nextHauntState,
    message: `Illusion #1 placed on your tile. Place ${remaining} more Illusion${remaining !== 1 ? "s" : ""} within ${speed} tile${speed !== 1 ? "s" : ""} — click highlighted tiles.`,
  };
}

/* [HAUNT-ACTION] Traitor places an illusion on a chosen tile during setup or Summon Illusions. */
function resolvePlaceIllusionTileState(game, actionId) {
  if (game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || game.activeHauntId !== "haunt_18" || !game.hauntState) return game;

  const traitorIndex = game.hauntState.traitorPlayerIndex;
  if (game.currentPlayerIndex !== traitorIndex) return game;

  const scenarioState = getScenarioState(game.hauntState);
  if (scenarioState.pendingChoice?.type !== "place-illusion") return game;

  const pendingChoice = scenarioState.pendingChoice;

  // Find the matching option by its full id (avoids manual string parsing).
  const matchedOption = (pendingChoice.options || []).find((o) => o.id === actionId);
  if (!matchedOption) return game;

  const { floor, x, y } = matchedOption;
  const optionKey = `${floor}:${x}:${y}`;

  // Assign the next illusion ID.
  const nextId = scenarioState.illusions.length + 1;
  const nextIllusions = [...scenarioState.illusions, { id: nextId, floor, x, y }];
  const nextRemaining = pendingChoice.remaining - 1;
  const nextPlacedKeys = [...(pendingChoice.placedKeys || []), optionKey];

  // Helper: transition to real-body selection after all illusions placed.
  const finalize = (finalIllusions) => {
    const selectOptions = finalIllusions.map((ill) => ({
      id: `select-real-body-${ill.id}`,
      floor: ill.floor,
      x: ill.x,
      y: ill.y,
      illusionId: ill.id,
    }));
    return {
      ...game,
      hauntState: {
        ...game.hauntState,
        scenarioState: {
          ...scenarioState,
          illusions: finalIllusions,
          pendingChoice: {
            type: "select-real-body",
            source: pendingChoice.source,
            firstHeroPlayerIndex: pendingChoice.firstHeroPlayerIndex,
            options: selectOptions,
          },
        },
      },
      message: `All ${finalIllusions.length} Illusion${finalIllusions.length !== 1 ? "s" : ""} placed! Now tap which one is your real body on the board. (Heroes — look away!)`,
    };
  };

  if (nextRemaining <= 0) {
    return finalize(nextIllusions);
  }

  // More to place — recompute available options excluding already-placed tiles.
  const tempGame = {
    ...game,
    hauntState: {
      ...game.hauntState,
      scenarioState: { ...scenarioState, illusions: nextIllusions },
    },
  };
  const options = computePlaceIllusionOptions(tempGame, traitorIndex, nextPlacedKeys);

  // If no valid tiles remain, finalize early.
  if (options.length === 0) {
    return finalize(nextIllusions);
  }

  return {
    ...game,
    hauntState: {
      ...game.hauntState,
      scenarioState: {
        ...scenarioState,
        illusions: nextIllusions,
        pendingChoice: { ...pendingChoice, remaining: nextRemaining, placedKeys: nextPlacedKeys, options },
      },
    },
    message: `Illusion #${nextId} placed. ${nextRemaining} more to place — click a highlighted tile.`,
  };
}

/* [HAUNT-ACTION] Hero selects a specific illusion to dispel after a successful Call to the Ring. */
function resolveDispelIllusionChoiceState(game, illusionId) {
  if (game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || game.activeHauntId !== "haunt_18" || !game.hauntState) return game;

  const scenarioState = getScenarioState(game.hauntState);
  if (scenarioState.pendingChoice?.type !== "dispel-illusion-choice") return game;

  const illusion = scenarioState.illusions.find((ill) => ill.id === illusionId);
  if (!illusion) return game;

  const actorName = scenarioState.pendingChoice.actorName || "Explorer";
  const baseGame = {
    ...game,
    hauntState: {
      ...game.hauntState,
      scenarioState: { ...scenarioState, pendingChoice: null },
    },
    turnPhase: "endTurn",
  };

  const dispelResult = applyDispelIllusion(baseGame, illusionId);
  return {
    ...dispelResult,
    message: `${actorName} chooses Illusion #${illusionId}. ${dispelResult.message}`,
  };
}

// ---------------------------------------------------------------------------
// Exported hook: resolveActionRollContinueState
// Applies the result of a Confront an Illusion or Call to the Ring roll.
// ---------------------------------------------------------------------------

/* [HAUNT-ACTION] Processes Continue after a Confront or Call roll. */
export function resolveActionRollContinueState(game, { rollDice }) {
  if (game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || game.activeHauntId !== "haunt_18" || !game.hauntState) {
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

  const rollSuffix =
    rollResult.bonus > 0
      ? ` ${rollResult.rollTotal} + ${rollResult.bonus} = ${rollResult.effectiveTotal}`
      : ` ${rollResult.rollTotal}`;

  // --- Confront an Illusion ---
  if (rollResult.actionId === "confront-illusion") {
    if (rollResult.success) {
      // Dispel the illusion on the hero's tile.
      const actorTile = (game.board[actor?.floor] || []).find((t) => t.x === actor?.x && t.y === actor?.y);
      const illusion = actorTile
        ? getIllusionAtPosition(scenarioState.illusions, actor.floor, actorTile.x, actorTile.y)
        : null;

      if (!illusion) {
        return {
          ...clearHauntActionRoll({ ...game, hauntState: nextHauntState }),
          message: `${actorName} rolled${rollSuffix}. Success — but there's no Illusion on this tile anymore.`,
        };
      }

      const dispelResult = applyDispelIllusion({ ...game, hauntState: nextHauntState }, illusion.id);
      return {
        ...clearHauntActionRoll(dispelResult),
        message: `${actorName} rolled${rollSuffix}. ${dispelResult.message}`,
      };
    }

    // Fail: take 1 die of Mental damage.
    const damageDice = rollDice ? rollDice(1) : [1];
    const pendingState = {
      ...clearHauntActionRoll({ ...game, hauntState: nextHauntState }),
      message: `${actorName} rolled${rollSuffix}. Failed to confront the Illusion — rolling for Mental damage...`,
    };
    return {
      game: pendingState,
      diceAnimation: {
        purpose: "confront-illusion-damage-roll",
        final: [...damageDice],
        display: Array.from({ length: damageDice.length }, () => Math.floor(Math.random() * 3)),
        settled: false,
        label: "Mental Damage",
        total: damageDice.reduce((s, v) => s + v, 0),
        playerIndex: actionRoll.actorIndex,
        actorName,
      },
    };
  }

  // --- Call to the Ring ---
  if (rollResult.actionId === "call-to-ring") {
    // Both success and fail end your turn.
    const baseState = {
      ...clearHauntActionRoll({ ...game, hauntState: nextHauntState }),
      turnPhase: "endTurn",
    };

    if (!rollResult.success) {
      return { ...baseState, message: `${actorName} rolled${rollSuffix}. The ring is silent. Turn ends.` };
    }

    // 8+: deal 1 die of Mental damage to the traitor (if revealed) OR dispel any Illusion.
    const traitorIndex = game.hauntState.traitorPlayerIndex;
    const traitor = game.players[traitorIndex];
    const traitorIsRevealed = !scenarioState.isHidden && traitor?.isAlive;

    if (traitorIsRevealed) {
      // Damage the traitor.
      const damageDice = rollDice ? rollDice(1) : [1];
      return {
        game: {
          ...baseState,
          message: `${actorName} rolled${rollSuffix}. The ring resonates — rolling Mental damage for the traitor...`,
        },
        diceAnimation: {
          purpose: "call-to-ring-traitor-damage",
          final: [...damageDice],
          display: Array.from({ length: damageDice.length }, () => Math.floor(Math.random() * 3)),
          settled: false,
          label: "Mental Damage",
          total: damageDice.reduce((s, v) => s + v, 0),
          playerIndex: traitorIndex,
          actorName,
          createDamageChoiceOnSettle: true,
        },
      };
    }

    if (scenarioState.illusions.length > 0) {
      // Hero picks which illusion to dispel via a pending choice.
      // The turn-end is deferred until after the choice is resolved.
      const options = scenarioState.illusions.map((ill) => ({
        id: `dispel-illusion-choice-${ill.id}`,
        label: `Illusion at (${ill.x}, ${ill.y}) on ${ill.floor} floor`,
        floor: ill.floor,
        x: ill.x,
        y: ill.y,
        illusionId: ill.id,
      }));
      return {
        ...clearHauntActionRoll({
          ...baseState,
          hauntState: {
            ...baseState.hauntState,
            scenarioState: {
              ...getScenarioState(baseState.hauntState),
              pendingChoice: { type: "dispel-illusion-choice", options, actorName },
            },
          },
        }),
        // Don't end turn yet — wait for dispel choice.
        turnPhase: game.turnPhase,
        message: `${actorName} rolled${rollSuffix}. The ring responds! Choose an Illusion to dispel.`,
      };
    }

    return {
      ...baseState,
      message: `${actorName} rolled${rollSuffix}. The ring resonates but there's nothing left to dispel.`,
    };
  }

  return clearHauntActionRoll(game);
}

// ---------------------------------------------------------------------------
// Exported hook: getTileTokenLabelsState
// ---------------------------------------------------------------------------

/* [BOARD-LAYOUT] Returns an "Illusion" variant token for any tile holding an active illusion.
   Includes hidden metadata so the traitor can privately highlight the real body. */
export function getTileTokenLabelsState(game, { floor, x, y }) {
  if (game.activeHauntId !== "haunt_18" || !game.hauntState) return [];
  const scenarioState = getScenarioState(game.hauntState);
  const illusion = getIllusionAtPosition(scenarioState.illusions, floor, x, y);
  if (illusion) {
    const realId = scenarioState.realIllusionId ?? null;
    return [{ label: "?", variant: "illusion", illusionId: illusion.id, isRealBody: realId === illusion.id }];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Exported hook: getPlayerHauntTokensState
// ---------------------------------------------------------------------------

/* [SIDEBAR] Shows the traitor's hidden/revealed status as a token chip. */
export function getPlayerHauntTokensState(game, playerIndex) {
  if (game.activeHauntId !== "haunt_18" || !game.hauntState) return [];
  const traitorIndex = game.hauntState.traitorPlayerIndex;
  if (playerIndex !== traitorIndex) return [];
  const scenarioState = getScenarioState(game.hauntState);
  if (scenarioState.isHidden) {
    return [{ label: `Hidden (${scenarioState.illusions.length} illusions)`, variant: "token" }];
  }
  return [{ label: "Revealed", variant: "token" }];
}

// ---------------------------------------------------------------------------
// Exported hook: getBoardRenderState
// ---------------------------------------------------------------------------

/* [BOARD-RENDER] No flooded tiles; no single monster token (illusions rendered per-tile via getTileTokenLabelsState).
   While hidden, the traitor is alive but their explorer token should not be rendered on the board. */
export function getBoardRenderState(game) {
  if (game.activeHauntId !== "haunt_18" || !game.hauntState) {
    return { floodedTiles: [], monsterToken: null, trappedPlayerIndexes: [], hiddenPlayerIndexes: [] };
  }
  const scenarioState = getScenarioState(game.hauntState);
  const traitorIndex = game.hauntState.traitorPlayerIndex;
  return {
    floodedTiles: [],
    monsterToken: null,
    trappedPlayerIndexes: [],
    hiddenPlayerIndexes: scenarioState.isHidden ? [traitorIndex] : [],
  };
}

// ---------------------------------------------------------------------------
// Exported hook: getMonsterCardState
// ---------------------------------------------------------------------------

/* [SIDEBAR] Returns the Illusion "monster card" shown while the traitor is hidden. */
export function getMonsterCardState(game) {
  if (game.activeHauntId !== "haunt_18" || !game.hauntState) return null;

  const scenarioState = getScenarioState(game.hauntState);
  if (!scenarioState.isHidden) return null;

  const traitorIndex = game.hauntState.traitorPlayerIndex;
  const traitor = game.players[traitorIndex];
  const speedIdx = traitor.statIndex?.speed ?? 0;
  const mightIdx = traitor.statIndex?.might ?? 0;
  const sanityIdx = traitor.statIndex?.sanity ?? 0;
  const knowledgeIdx = traitor.statIndex?.knowledge ?? 0;

  const speed = traitor.character?.speed?.[speedIdx] ?? 0;
  const might = traitor.character?.might?.[mightIdx] ?? 0;
  const sanity = traitor.character?.sanity?.[sanityIdx] ?? 0;
  const knowledge = traitor.character?.knowledge?.[knowledgeIdx] ?? 0;

  return {
    name: "Illusion",
    emoji: "🪞",
    stats: { might, speed, sanity, knowledge },
    movesLeft: game.currentPlayerIndex === traitorIndex ? (traitor.movesLeft ?? 0) : speed,
    speedRollLabel: `${speed} (fixed)`,
    isCurrentTurn: game.currentPlayerIndex === traitorIndex,
  };
}

// ---------------------------------------------------------------------------
// Exported hook: getCombatBonusLabel
// ---------------------------------------------------------------------------

/* [HAUNT-COMBAT] No special combat bonus label for haunt 18. */
export function getCombatBonusLabel() {
  return null;
}

// ---------------------------------------------------------------------------
// Exported hook: getHauntCanAttackTargetState
// ---------------------------------------------------------------------------

/* [HAUNT-COMBAT] Standard once-per-turn attack limit. The proxy check in combatItemAbility gates illusion attacks. */
export function getHauntCanAttackTargetState(game) {
  return !game.hasAttackedThisTurn;
}

// ---------------------------------------------------------------------------
// Exported hook: getKnowledgeTokenHoldersState
// ---------------------------------------------------------------------------

/* [HAUNT-COMBAT] Haunt 18 has no knowledge tokens. */
export function getKnowledgeTokenHoldersState() {
  return [];
}
