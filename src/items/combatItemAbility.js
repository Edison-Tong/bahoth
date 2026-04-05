import { GAME_PHASES, getHauntCombatActorProxyState } from "../haunts/hauntDomain";
import { DIR, OPPOSITE } from "../game/gameState";
import { applyStatChangeState } from "../players/playerDomain";

// Actions handled by the shared combat engine (trigger: "attack").
export const SUPPORTED_COMBAT_ITEM_ACTIONS = new Set([
  "attack-bonus-die",
  "attack-bonus-total",
  "optional-speed-loss-for-attack-dice",
  "ranged-attack-speed",
  "sanity-combat",
]);

export function getPlayerSpeedDiceCount(player) {
  return player.character.speed[player.statIndex.speed] || 0;
}

// Standard targeting: all valid enemies on the attacker's current tile.
export function getCombatTargetsOnCurrentTile(game) {
  if (game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE) return [];
  if (!game.hauntState) return [];
  if (game.hasAttackedThisTurn) return [];

  const attackerIndex = game.currentPlayerIndex;
  const attacker = game.players[attackerIndex];
  const traitorIndex = game.hauntState.traitorPlayerIndex;
  const attackerProxy = getHauntCombatActorProxyState(game, attackerIndex);
  if (!attacker?.isAlive && !attackerProxy) return [];

  const attackerFloor = attackerProxy?.floor ?? attacker.floor;
  const attackerX = attackerProxy?.x ?? attacker.x;
  const attackerY = attackerProxy?.y ?? attacker.y;
  const onSameTile = (player) =>
    player.floor === attackerFloor && player.x === attackerX && player.y === attackerY && player.isAlive;

  if (attackerIndex === traitorIndex) {
    return game.players
      .map((player, playerIndex) => ({ player, playerIndex }))
      .filter(
        ({ player, playerIndex }) => playerIndex !== attackerIndex && playerIndex !== traitorIndex && onSameTile(player)
      );
  }

  const traitor = game.players[traitorIndex];
  const traitorProxy = getHauntCombatActorProxyState(game, traitorIndex);
  const traitorOnSameTile = !!traitor && onSameTile(traitor);
  const spiritOnSameTile =
    !!traitorProxy &&
    attacker.floor === traitorProxy.floor &&
    attacker.x === traitorProxy.x &&
    attacker.y === traitorProxy.y;
  if ((!traitor || !traitorOnSameTile) && !spiritOnSameTile) return [];
  return [{ player: traitor, playerIndex: traitorIndex }];
}

// Ranged targeting: same tile OR any door-adjacent tile (Crossbow).
export function getCrossboxTargets(game, getTileAtPos) {
  if (game.gamePhase !== GAME_PHASES.HAUNT_ACTIVE) return [];
  if (!game.hauntState) return [];
  if (game.hasAttackedThisTurn) return [];

  const attackerIndex = game.currentPlayerIndex;
  const attacker = game.players[attackerIndex];
  if (!attacker?.isAlive) return [];

  const traitorIndex = game.hauntState.traitorPlayerIndex;

  // Build set of reachable positions: same tile + door-adjacent tiles
  const reachable = new Set();
  reachable.add(`${attacker.floor}:${attacker.x}:${attacker.y}`);
  const attackerTile = getTileAtPos(game.board, attacker.x, attacker.y, attacker.floor);
  if (attackerTile) {
    for (const dir of attackerTile.doors || []) {
      const offset = DIR[dir];
      if (!offset) continue;
      const nx = attacker.x + offset.dx;
      const ny = attacker.y + offset.dy;
      const neighbor = getTileAtPos(game.board, nx, ny, attacker.floor);
      if (!neighbor) continue;
      if (!(neighbor.doors || []).includes(OPPOSITE[dir])) continue;
      reachable.add(`${attacker.floor}:${nx}:${ny}`);
    }
  }

  const isValidTarget = (player, playerIndex) => {
    if (playerIndex === attackerIndex || !player.isAlive) return false;
    const key = `${player.floor}:${player.x}:${player.y}`;
    if (!reachable.has(key)) return false;
    if (!Number.isInteger(traitorIndex)) return false;
    const attackerIsTraitor = attackerIndex === traitorIndex;
    const targetIsTraitor = playerIndex === traitorIndex;
    return attackerIsTraitor ? !targetIsTraitor : targetIsTraitor;
  };

  return game.players
    .map((player, playerIndex) => ({ player, playerIndex }))
    .filter(({ player, playerIndex }) => isValidTarget(player, playerIndex));
}

// Dispatcher: picks the right target function based on the item action.
export function getCombatItemTargets(game, action, getTileAtPos) {
  if (action === "ranged-attack-speed") return getCrossboxTargets(game, getTileAtPos);
  return getCombatTargetsOnCurrentTile(game);
}

/**
 * Applies per-item combat modifiers at the start of combat.
 * Returns all derived combat setup values so callers don't need to branch on action.
 *
 * @param {object|null} sourceRule  — activeAbilityRule from the source card
 * @param {object|null} sourceCard  — the item card being used
 * @param {number}      attackerIndex
 * @param {Array}       currentPlayers
 * @returns {{ rollStat, combatDamageType, attackerNoDamageOnLoss,
 *             preRollBonusDice, preRollFlatBonus, preRollItemMessages,
 *             usedItemKeys, nextPlayers }}
 */
export function applyCombatItemSource(sourceRule, sourceCard, attackerIndex, currentPlayers) {
  let rollStat = "might";
  let combatDamageType = "physical";
  let attackerNoDamageOnLoss = false;
  let preRollBonusDice = 0;
  let preRollFlatBonus = 0;
  const preRollItemMessages = [];
  const usedItemKeys = [];
  let nextPlayers = currentPlayers;

  if (!sourceRule || sourceRule.trigger !== "attack") {
    return {
      rollStat,
      combatDamageType,
      attackerNoDamageOnLoss,
      preRollBonusDice,
      preRollFlatBonus,
      preRollItemMessages,
      usedItemKeys,
      nextPlayers,
    };
  }

  const trackUsed = () => {
    if (sourceCard?.ownerCollection != null && sourceCard?.ownerCardIndex != null) {
      usedItemKeys.push(`${sourceCard.ownerCollection}:${sourceCard.ownerCardIndex}:${sourceCard.id}`);
    }
  };

  if (sourceRule.action === "optional-speed-loss-for-attack-dice") {
    const costAmount = sourceRule.costAmount || 1;
    const bonusDice = sourceRule.bonusDice || 2;
    const attacker = currentPlayers[attackerIndex];
    if ((attacker.statIndex.speed || 0) >= costAmount) {
      nextPlayers = applyStatChangeState(currentPlayers, attackerIndex, "speed", -costAmount);
      preRollBonusDice += bonusDice;
      preRollItemMessages.push(`${sourceCard.name}: paid ${costAmount} Speed for +${bonusDice} attack dice`);
      trackUsed();
    }
  } else if (sourceRule.action === "attack-bonus-die") {
    preRollBonusDice += 1;
    preRollItemMessages.push(`${sourceCard.name}: +1 attack die`);
    trackUsed();
  } else if (sourceRule.action === "attack-bonus-total") {
    preRollFlatBonus += 1;
    preRollItemMessages.push(`${sourceCard.name}: +1 to roll total`);
    trackUsed();
  } else if (sourceRule.action === "sanity-combat") {
    rollStat = "sanity";
    combatDamageType = "mental";
    trackUsed();
  } else if (sourceRule.action === "ranged-attack-speed") {
    rollStat = "speed";
    preRollBonusDice += 1;
    attackerNoDamageOnLoss = true;
    preRollItemMessages.push(`${sourceCard.name}: +1 attack die`);
    trackUsed();
  }

  return {
    rollStat,
    combatDamageType,
    attackerNoDamageOnLoss,
    preRollBonusDice,
    preRollFlatBonus,
    preRollItemMessages,
    usedItemKeys,
    nextPlayers,
  };
}
