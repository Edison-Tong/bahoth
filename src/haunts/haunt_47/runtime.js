import { GAME_PHASES, HAUNT_TEAMS } from "../core/hauntPhases";
import { STAT_LABELS } from "../../game/gameState";

// Number of portal tokens placed based on player count (one per hero).
const PORTALS_BY_PLAYER_COUNT = { 3: 2, 4: 3, 5: 4, 6: 5 };

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

/* [HAUNT-SETUP] Creates the clean starting scenario state for Haunt 47 (A Knight to Remember). */
export function createInitialScenarioState() {
  return {
    portalTokens: [], // [{ floor, x, y }] — active portal tokens on the board
    trappedHeroes: [], // player indexes currently holding their Hero token (Trapped)
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

/* [HAUNT-ACTION] Creates a "turnNumber:playerIndex:actionId" key used for once-per-turn gating. */
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

/* [HAUNT-SETUP] Merges hauntState.scenarioState with defaults to ensure all expected fields are present. */
function getScenarioState(hauntState) {
  const s = hauntState?.scenarioState || {};
  const defaults = createInitialScenarioState();
  return {
    ...defaults,
    ...s,
    portalTokens: s.portalTokens || defaults.portalTokens,
    trappedHeroes: s.trappedHeroes || defaults.trappedHeroes,
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

/* [VALIDATION] Returns true if the given player is currently Trapped. */
function isTrapped(game, playerIndex) {
  const scenarioState = getScenarioState(game.hauntState);
  return scenarioState.trappedHeroes.includes(playerIndex);
}

/* [LOOKUP] Returns true if there is an active portal token at the given board position. */
function hasTilePortal(portalTokens, floor, x, y) {
  return portalTokens.some((t) => t.floor === floor && t.x === x && t.y === y);
}

/* [HAUNT-SETUP] BFS across placed tiles on a given floor to find the tile requiring the most moves from (startX, startY).
   Respects doorway connections. Skips tiles already holding a portal (alreadyPlaced). */
function bfsFarthestTile(board, floor, startX, startY, alreadyPlaced) {
  const floorTiles = board[floor] || [];
  if (floorTiles.length === 0) return null;

  // Build a quick lookup: "x:y" → tile
  const tileMap = {};
  for (const t of floorTiles) tileMap[`${t.x}:${t.y}`] = t;

  const placedSet = new Set((alreadyPlaced || []).filter((p) => p.floor === floor).map((p) => `${p.x}:${p.y}`));

  const DIR_VECTORS = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
  const OPPOSITE_DIR = { N: "S", S: "N", E: "W", W: "E" };

  const visited = new Set();
  const queue = [{ x: startX, y: startY, dist: 0 }];
  visited.add(`${startX}:${startY}`);

  let farthestTile = null;
  let farthestDist = -1;

  while (queue.length > 0) {
    const { x, y, dist } = queue.shift();
    const tile = tileMap[`${x}:${y}`];
    if (!tile) continue;

    const key = `${x}:${y}`;
    if (dist > 0 && !placedSet.has(key) && dist > farthestDist) {
      farthestDist = dist;
      farthestTile = tile;
    }

    for (const dir of tile.doors || []) {
      const [dx, dy] = DIR_VECTORS[dir];
      const nx = x + dx;
      const ny = y + dy;
      const nKey = `${nx}:${ny}`;
      if (visited.has(nKey)) continue;
      const neighbor = tileMap[nKey];
      if (!neighbor) continue;
      if (!(neighbor.doors || []).includes(OPPOSITE_DIR[dir])) continue;
      visited.add(nKey);
      queue.push({ x: nx, y: ny, dist: dist + 1 });
    }
  }

  return farthestTile;
}

/* [HAUNT-SETUP] [STAT-CHANGE] Heals a player back to their starting stat index values. Mirrors the pattern in hauntRuntime.js. */
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

// ---------------------------------------------------------------------------
// Exported hook: onHauntBegin
// Heals the traitor, auto-places Portal tokens (farthest tile per hero on their floor),
// and marks all heroes as Trapped.
// ---------------------------------------------------------------------------

/* [HAUNT-SETUP] Called once when the haunt begins: heals traitor, places portal tokens, traps all heroes. */
export function onHauntBegin(game) {
  const traitorIndex = game.hauntState.traitorPlayerIndex;
  const heroIndexes = getHeroIndexes(game);
  const portalCount = PORTALS_BY_PLAYER_COUNT[game.players.length] ?? heroIndexes.length;

  // 1. Heal the traitor's traits.
  const nextPlayers = game.players.map((player, index) => (index === traitorIndex ? healAllTraits(player) : player));

  // 2. For each hero, find the farthest reachable tile on their floor by BFS move-distance,
  //    then place a portal there. "Farthest" = most moves required, not physical distance.
  const portalTokens = [];
  for (let i = 0; i < Math.min(heroIndexes.length, portalCount); i++) {
    const heroIndex = heroIndexes[i];
    const hero = nextPlayers[heroIndex];
    if (!hero) continue;

    const farthestTile = bfsFarthestTile(game.board, hero.floor, hero.x, hero.y, portalTokens);
    if (farthestTile) {
      portalTokens.push({ floor: hero.floor, x: farthestTile.x, y: farthestTile.y });
    }
  }

  // 3. All heroes start Trapped (they have their Hero token).
  const trappedHeroes = [...heroIndexes];

  return {
    ...game,
    players: nextPlayers,
    hauntState: {
      ...game.hauntState,
      scenarioState: {
        ...getScenarioState(game.hauntState),
        portalTokens,
        trappedHeroes,
      },
    },
    message: `A dimensional portal has opened! All heroes are Trapped. ${portalTokens.length} Portal token${portalTokens.length !== 1 ? "s" : ""} placed across the house.`,
  };
}

// ---------------------------------------------------------------------------
// Exported hook: resolveAfterDamageState
// Knight invincibility: if the traitor would die, heal all traits instead.
// Traitor win: if all heroes are dead.
// ---------------------------------------------------------------------------

/* [HAUNT-COMBAT] [DAMAGE] Enforces knight invincibility and checks traitor-wins-all-dead condition. */
export function resolveAfterDamageState(previousGame, nextGame) {
  if (nextGame.activeHauntId !== "haunt_47" || !nextGame.hauntState) return nextGame;
  if (nextGame.gamePhase === GAME_PHASES.GAME_OVER) return nextGame;

  const traitorIndex = nextGame.hauntState.traitorPlayerIndex;

  // Knight invincibility: traitor cannot die — heal all traits instead.
  if (previousGame.players[traitorIndex]?.isAlive === true && nextGame.players[traitorIndex]?.isAlive === false) {
    const healedTraitor = healAllTraits(nextGame.players[traitorIndex]);
    const nextPlayers = nextGame.players.map((p, i) => (i === traitorIndex ? healedTraitor : p));
    return {
      ...nextGame,
      players: nextPlayers,
      message: "The cruel knight is invincible! All traits are healed.",
    };
  }

  // All living heroes dead → traitor wins.
  const livingHeroes = getLivingHeroIndexes(nextGame);
  if (livingHeroes.length === 0) {
    return {
      ...nextGame,
      gamePhase: GAME_PHASES.GAME_OVER,
      turnPhase: "game-over",
      winnerTeam: HAUNT_TEAMS.TRAITOR,
      message: "All heroes are dead. The cruel knight wins!",
    };
  }

  return nextGame;
}

// ---------------------------------------------------------------------------
// Exported hook: getActionAvailabilityState
// ---------------------------------------------------------------------------

/* [HAUNT-ACTION] [VALIDATION] Returns which haunt action buttons are available for the current player. */
export function getActionAvailabilityState(game, { hauntActionLocked }) {
  if (game.activeHauntId !== "haunt_47" || game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || !game.hauntState) {
    return { escapePortal: false, closePortalKnowledge: false, closePortalSanity: false };
  }

  const scenarioState = getScenarioState(game.hauntState);

  if (scenarioState.pendingChoice) {
    return { escapePortal: false, closePortalKnowledge: false, closePortalSanity: false };
  }

  const canUseHeroAction =
    isHero(game, game.currentPlayerIndex) && !!getCurrentPlayer(game)?.isAlive && !hauntActionLocked;

  if (!canUseHeroAction) {
    return { escapePortal: false, closePortalKnowledge: false, closePortalSanity: false };
  }

  const currentPlayer = getCurrentPlayer(game);
  const currentTile = getCurrentTile(game);
  const onPortalTile =
    !!currentTile && hasTilePortal(scenarioState.portalTokens, currentPlayer.floor, currentTile.x, currentTile.y);
  const trapped = isTrapped(game, game.currentPlayerIndex);

  // Escape the Portal: must be Trapped, on a portal tile, not used this turn.
  const escapeUsageKey = createUsageKey(game, "escape-portal");
  const canEscape = onPortalTile && trapped && !game.hauntState.oncePerTurnUsage?.[escapeUsageKey];

  // Close the Portal: must NOT be Trapped, on a portal tile, not used this turn.
  const closeUsageKey = createUsageKey(game, "close-portal");
  const canClose = onPortalTile && !trapped && !game.hauntState.oncePerTurnUsage?.[closeUsageKey];

  return {
    escapePortal: canEscape,
    closePortalKnowledge: canClose,
    closePortalSanity: canClose,
  };
}

// ---------------------------------------------------------------------------
// Exported hook: getActionButtonsState
// ---------------------------------------------------------------------------

/* [HAUNT-ACTION] [OVERLAY] Returns the list of action buttons for the haunt panel. */
export function getActionButtonsState(game, context) {
  if (game.activeHauntId !== "haunt_47" || !game.hauntState) return [];

  const availability = getActionAvailabilityState(game, context);
  const buttons = [];

  if (availability.escapePortal) {
    const scenarioState = getScenarioState(game.hauntState);
    const currentPlayer = getCurrentPlayer(game);
    // Check whether a non-Trapped hero is on the same tile (grants +2 bonus).
    const nonTrappedAllyOnTile = getHeroIndexes(game).some((hi) => {
      if (hi === game.currentPlayerIndex) return false;
      if (scenarioState.trappedHeroes.includes(hi)) return false;
      const h = game.players[hi];
      return h?.isAlive && h.floor === currentPlayer?.floor && h.x === currentPlayer?.x && h.y === currentPlayer?.y;
    });
    buttons.push({
      id: "escape-portal",
      label: `Escape the Portal (Knowledge${nonTrappedAllyOnTile ? " +2" : ""})`,
      tone: "secondary",
      enabled: true,
    });
  }

  if (availability.closePortalKnowledge) {
    buttons.push({
      id: "close-portal-knowledge",
      label: "Close the Portal (Knowledge)",
      tone: "danger",
      enabled: true,
    });
  }

  if (availability.closePortalSanity) {
    buttons.push({
      id: "close-portal-sanity",
      label: "Close the Portal (Sanity)",
      tone: "danger",
      enabled: true,
    });
  }

  return buttons;
}

// ---------------------------------------------------------------------------
// Shared roll infrastructure (same pattern as haunt_28)
// ---------------------------------------------------------------------------

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

/* [HAUNT-ACTION] Computes { actionId, rollTotal, bonus, effectiveTotal, threshold, success } from a settled roll. */
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
// Exported hook: getActionRollPreviewState
// ---------------------------------------------------------------------------

/* [HAUNT-ACTION] [OVERLAY] Returns the roll-preview summary for the haunt action roll overlay. */
export function getActionRollPreviewState(game) {
  if (game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || game.activeHauntId !== "haunt_47") return null;

  const rollResult = getActionRollResult(game);
  if (!rollResult) return null;

  if (rollResult.actionId === "escape-portal") {
    return {
      title: "Escape the Portal",
      thresholdLabel: "Need 6+ Knowledge",
      outcomeLabel: rollResult.success ? "Escaped!" : "Failed — gained Knowledge",
      outcomeDescription: rollResult.success
        ? "Give your Hero token to the traitor. You are no longer Trapped."
        : "Gain 1 Knowledge. Not quite, but you gained some insight...",
      totalLabel:
        rollResult.bonus > 0
          ? `${rollResult.rollTotal} + ${rollResult.bonus} = ${rollResult.effectiveTotal}`
          : `${rollResult.rollTotal}`,
    };
  }

  if (rollResult.actionId === "close-portal") {
    const statLabel = STAT_LABELS[rollResult.stat] || "Trait";
    return {
      title: "Close the Portal",
      thresholdLabel: `Need 4+ ${statLabel}`,
      outcomeLabel: rollResult.success ? "Portal Closed!" : "Failed",
      outcomeDescription: rollResult.success
        ? "Remove the Portal token. If this was the last Portal, you win!"
        : "Take one die of Mental damage.",
      totalLabel: `${rollResult.rollTotal}`,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Exported hook: resolveActionState
// ---------------------------------------------------------------------------

/* [HAUNT-ACTION] Main action dispatcher for haunt 47. */
export function resolveActionState(game, { actionId }) {
  if (actionId === "escape-portal") return resolveEscapePortalState(game);
  if (actionId === "close-portal-knowledge") return resolveClosePortalState(game, "knowledge");
  if (actionId === "close-portal-sanity") return resolveClosePortalState(game, "sanity");
  return game;
}

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

/* [HAUNT-ACTION] [DICE-ROLL] Sets up the Escape the Portal roll (Knowledge, threshold 6, +2 if ally on tile). */
function resolveEscapePortalState(game) {
  if (game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || game.activeHauntId !== "haunt_47" || !game.hauntState) {
    return game;
  }
  if (!isHero(game, game.currentPlayerIndex)) return game;

  const currentPlayer = getCurrentPlayer(game);
  if (!currentPlayer?.isAlive) return game;

  const scenarioState = getScenarioState(game.hauntState);
  if (!scenarioState.trappedHeroes.includes(game.currentPlayerIndex)) {
    return { ...game, message: "You are not Trapped. Use Close the Portal instead." };
  }

  const currentTile = getCurrentTile(game);
  if (!currentTile || !hasTilePortal(scenarioState.portalTokens, currentPlayer.floor, currentTile.x, currentTile.y)) {
    return { ...game, message: "You must be on a Portal tile to Escape the Portal." };
  }

  const usageKey = createUsageKey(game, "escape-portal");
  if (game.hauntState.oncePerTurnUsage?.[usageKey]) {
    return { ...game, message: "Escape the Portal has already been used this turn." };
  }

  // +2 bonus if a non-Trapped hero is on the same tile.
  const nonTrappedAllyOnTile = getHeroIndexes(game).some((hi) => {
    if (hi === game.currentPlayerIndex) return false;
    if (scenarioState.trappedHeroes.includes(hi)) return false;
    const h = game.players[hi];
    return h?.isAlive && h.floor === currentPlayer.floor && h.x === currentPlayer.x && h.y === currentPlayer.y;
  });
  const bonus = nonTrappedAllyOnTile ? 2 : 0;

  return {
    ...buildPendingActionRoll(game, "escape-portal", "knowledge", { usageKey, threshold: 6, bonus }),
    message: `${currentPlayer.name} attempts to Escape the Portal. Roll Knowledge (need 6+)${bonus > 0 ? " — +2 bonus from non-Trapped ally" : ""}.`,
  };
}

/* [HAUNT-ACTION] [DICE-ROLL] Sets up the Close the Portal roll (Knowledge or Sanity, threshold 4). */
function resolveClosePortalState(game, stat) {
  if (game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || game.activeHauntId !== "haunt_47" || !game.hauntState) {
    return game;
  }
  if (!isHero(game, game.currentPlayerIndex)) return game;

  const currentPlayer = getCurrentPlayer(game);
  if (!currentPlayer?.isAlive) return game;

  const scenarioState = getScenarioState(game.hauntState);
  if (scenarioState.trappedHeroes.includes(game.currentPlayerIndex)) {
    return { ...game, message: "You are Trapped. Use Escape the Portal instead." };
  }

  const currentTile = getCurrentTile(game);
  if (!currentTile || !hasTilePortal(scenarioState.portalTokens, currentPlayer.floor, currentTile.x, currentTile.y)) {
    return { ...game, message: "You must be on a Portal tile to Close the Portal." };
  }

  const usageKey = createUsageKey(game, "close-portal");
  if (game.hauntState.oncePerTurnUsage?.[usageKey]) {
    return { ...game, message: "Close the Portal has already been used this turn." };
  }

  const statLabel = STAT_LABELS[stat] || stat;
  return {
    ...buildPendingActionRoll(game, "close-portal", stat, { usageKey, threshold: 4 }),
    message: `${currentPlayer.name} attempts to Close the Portal. Roll ${statLabel} (need 4+).`,
  };
}

// ---------------------------------------------------------------------------
// Exported hook: resolveActionRollContinueState
// ---------------------------------------------------------------------------

/* [HAUNT-ACTION] Processes Continue after an Escape the Portal or Close the Portal roll. */
export function resolveActionRollContinueState(game, { createDamageChoice, rollDice }) {
  if (game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || game.activeHauntId !== "haunt_47" || !game.hauntState) {
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

  // --- Escape the Portal ---
  if (rollResult.actionId === "escape-portal") {
    if (rollResult.success) {
      // Hero escapes: remove from trappedHeroes.
      const nextTrappedHeroes = scenarioState.trappedHeroes.filter((i) => i !== actionRoll.actorIndex);
      return {
        ...clearHauntActionRoll(game),
        hauntState: {
          ...nextHauntState,
          scenarioState: { ...scenarioState, trappedHeroes: nextTrappedHeroes },
        },
        message: `${actorName} rolled${rollSuffix}. Escaped the Portal! No longer Trapped.`,
      };
    }

    // Fail: gain 1 Knowledge (increment statIndex.knowledge, capped at max).
    const nextPlayers = game.players.map((player, index) => {
      if (index !== actionRoll.actorIndex) return player;
      const maxIndex = (player.character?.knowledge?.length ?? 1) - 1;
      return {
        ...player,
        statIndex: {
          ...player.statIndex,
          knowledge: Math.min(maxIndex, (player.statIndex?.knowledge ?? 0) + 1),
        },
      };
    });
    return {
      ...clearHauntActionRoll({ ...game, players: nextPlayers }),
      hauntState: nextHauntState,
      message: `${actorName} rolled${rollSuffix}. Not enough — gained 1 Knowledge.`,
    };
  }

  // --- Close the Portal ---
  if (rollResult.actionId === "close-portal") {
    if (rollResult.success) {
      // Remove the portal at the actor's current position.
      const nextPortalTokens = scenarioState.portalTokens.filter(
        (p) => !(p.floor === actor?.floor && p.x === actor?.x && p.y === actor?.y)
      );

      if (nextPortalTokens.length === 0) {
        // Last portal closed — heroes win!
        return {
          ...clearHauntActionRoll(game),
          hauntState: {
            ...nextHauntState,
            scenarioState: { ...scenarioState, portalTokens: nextPortalTokens },
          },
          gamePhase: GAME_PHASES.GAME_OVER,
          turnPhase: "game-over",
          winnerTeam: HAUNT_TEAMS.HEROES,
          message: `${actorName} rolled${rollSuffix}. The last Portal is closed! Heroes win!`,
        };
      }

      return {
        ...clearHauntActionRoll(game),
        hauntState: {
          ...nextHauntState,
          scenarioState: { ...scenarioState, portalTokens: nextPortalTokens },
        },
        message: `${actorName} rolled${rollSuffix}. Portal closed! ${nextPortalTokens.length} portal${nextPortalTokens.length !== 1 ? "s" : ""} remaining.`,
      };
    }

    // Fail: take 1 die of Mental damage — roll the die now and use the result as flat damage.
    const damageDice = rollDice ? rollDice(1) : [1];
    const damageRolled = Math.max(
      1,
      damageDice.reduce((s, v) => s + v, 0)
    );
    const damageChoice = createDamageChoice(
      { damage: damageRolled, damageType: "mental", sourceName: "Portal — Dimensional Feedback" },
      actor
    );
    return {
      ...clearHauntActionRoll(game),
      hauntState: nextHauntState,
      damageChoice,
      message: `${actorName} rolled${rollSuffix}. Failed to close the Portal — rolled ${damageRolled} Mental damage.`,
    };
  }

  return clearHauntActionRoll(game);
}

// ---------------------------------------------------------------------------
// Exported hook: resolveTurnStartState
// At the start of a hero's turn, roll Speed to determine movement (minimum 1).
// The traitor takes a normal turn — no speed roll needed.
// ---------------------------------------------------------------------------

/* [HAUNT-ACTION] [DICE-ROLL] At start of each hero's turn: roll Speed to determine movement (min 1). */
export function resolveTurnStartState(game, { rollDice }) {
  if (game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE || game.activeHauntId !== "haunt_47" || !game.hauntState) {
    return { game, diceAnimation: null };
  }

  // Only applies to heroes — traitor takes a normal turn.
  if (!isHero(game, game.currentPlayerIndex)) {
    return { game, diceAnimation: null };
  }

  const currentPlayer = getCurrentPlayer(game);
  if (!currentPlayer?.isAlive) return { game, diceAnimation: null };

  const speedStatIndex = currentPlayer.statIndex?.speed ?? 0;
  const speedDiceCount = currentPlayer.character?.speed?.[speedStatIndex] ?? 0;
  const dice = rollDice(Math.max(1, speedDiceCount));
  const total = dice.reduce((s, v) => s + v, 0);
  const moves = Math.max(1, total);

  const nextPlayers = game.players.map((player, index) =>
    index === game.currentPlayerIndex ? { ...player, movesLeft: moves } : player
  );

  return {
    game: {
      ...game,
      players: nextPlayers,
      message: `${currentPlayer.name} rolls Speed for movement...`,
    },
    diceAnimation: {
      purpose: "hero-speed-roll",
      final: [...dice],
      display: Array.from({ length: dice.length }, () => Math.floor(Math.random() * 3)),
      settled: false,
      label: "Speed",
      total,
      monsterName: null,
    },
  };
}

// ---------------------------------------------------------------------------
// Exported hook: getTileTokenLabelsState
// ---------------------------------------------------------------------------

/* [BOARD-LAYOUT] Returns a portal variant token on any tile that has an active Portal token.
   BoardCanvas renders the "portal" variant as an animated swirl overlay. */
export function getTileTokenLabelsState(game, { floor, x, y }) {
  if (game.activeHauntId !== "haunt_47" || !game.hauntState) return [];
  const scenarioState = getScenarioState(game.hauntState);
  if (hasTilePortal(scenarioState.portalTokens, floor, x, y)) {
    return [{ label: "Portal", variant: "portal" }];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Exported hook: getPlayerHauntTokensState
// ---------------------------------------------------------------------------

/* [SIDEBAR] Returns a Trapped token chip for any hero who currently holds their Hero token. */
export function getPlayerHauntTokensState(game, playerIndex) {
  if (game.activeHauntId !== "haunt_47" || !game.hauntState) return [];
  const scenarioState = getScenarioState(game.hauntState);
  if (scenarioState.trappedHeroes.includes(playerIndex)) {
    return [{ label: "Trapped", variant: "token" }];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Exported hook: getBoardRenderState
// ---------------------------------------------------------------------------

/* [BOARD-RENDER] Haunt 47 has no flooded tiles and no single monster token.
   Portal tokens are rendered per-tile via getTileTokenLabelsState.
   Trapped heroes are returned here so BoardCanvas can apply the visual style generically. */
export function getBoardRenderState(game) {
  if (game.activeHauntId !== "haunt_47" || !game.hauntState) {
    return { floodedTiles: [], monsterToken: null, trappedPlayerIndexes: [] };
  }
  const scenarioState = getScenarioState(game.hauntState);
  return {
    floodedTiles: [],
    monsterToken: null,
    trappedPlayerIndexes: scenarioState.trappedHeroes || [],
  };
}

// ---------------------------------------------------------------------------
// Exported hook: getCombatBonus
// +2 when traitor attacks a Trapped hero (per "What a Cruel Knight" Sanity attack rule).
//
// NOTE: Full "What a Cruel Knight" mechanics require core combat system enhancements:
//   - Sanity vs Might attack type selection based on target Trapped status
//   - Physical damage on Sanity attack win (vs normal Sanity combat damage)
//   - Give Hero token (Trap) on Might attack win instead of dealing damage
//   - Traitor takes no damage on loss when attacking a non-Trapped hero
// ---------------------------------------------------------------------------

/* [HAUNT-COMBAT] Returns +2 when the traitor attacks a Trapped hero. */
export function getCombatBonus(game, actorIndex, defenderIndex, role) {
  if (game.activeHauntId !== "haunt_47" || !game.hauntState) return 0;
  if (role !== "attacker") return 0;
  const traitorIndex = game.hauntState.traitorPlayerIndex;
  if (actorIndex !== traitorIndex) return 0;
  // +2 bonus only when attacking a Trapped hero (Sanity attack rule).
  return isTrapped(game, defenderIndex) ? 2 : 0;
}

// ---------------------------------------------------------------------------
// Exported hook: getKnowledgeTokenHoldersState
// ---------------------------------------------------------------------------

/* [HAUNT-COMBAT] Haunt 47 has no knowledge tokens. */
export function getKnowledgeTokenHoldersState() {
  return [];
}
