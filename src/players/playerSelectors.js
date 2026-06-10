import { getHauntCanDeadPlayerTakeTurnState } from "../haunts/hauntDomain";

// Returns the name of the player who will act after the current turn (shown in the End Turn button).
// Accounts for extra turns, dead players, and monster turns during haunts.
export function getEndTurnPreviewPlayerName(game, currentPlayer) {
  if (game.extraTurnAfterCurrent && currentPlayer.isAlive) {
    return `${currentPlayer.name} (extra turn)`;
  }

  let next = (game.currentPlayerIndex + 1) % game.players.length;
  let attempts = 0;
  let canUseDeadTurn = getHauntCanDeadPlayerTakeTurnState(game, next);
  while (!game.players[next].isAlive && !canUseDeadTurn && attempts < game.players.length) {
    next = (next + 1) % game.players.length;
    attempts++;
    canUseDeadTurn = getHauntCanDeadPlayerTakeTurnState(game, next);
  }

  if (!game.players[next]?.isAlive && canUseDeadTurn) {
    return "Monster";
  }

  return game.players[next]?.name || currentPlayer.name;
}

// Returns { damageAllocated, damageRemaining, canConfirmDamageChoice } for the active damage choice.
// Used by DamageChoiceOverlay to control the Confirm button state.
export function getDamageChoiceSummary(damageChoice, currentPlayer = null) {
  const isLethalAllocation = (player, choice) => {
    if (!player || !choice || choice.adjustmentMode === "increase") return false;

    const previewStatIndex = { ...player.statIndex };
    for (const [stat, amount] of Object.entries(choice.allocation || {})) {
      if (!amount || !Object.prototype.hasOwnProperty.call(previewStatIndex, stat)) continue;
      previewStatIndex[stat] = Math.max(0, previewStatIndex[stat] - amount);
    }

    return Object.values(previewStatIndex).some((value) => value <= 0);
  };

  const damageAllocated = damageChoice
    ? Object.values(damageChoice.allocation).reduce((sum, value) => sum + value, 0)
    : 0;
  const damageRemaining = damageChoice ? damageChoice.amount - damageAllocated : 0;
  const canConfirmDamageChoice = damageChoice
    ? damageChoice.allowPartial
      ? damageAllocated <= damageChoice.amount
      : damageAllocated > damageChoice.amount
        ? false
        : damageRemaining === 0 || isLethalAllocation(currentPlayer, damageChoice)
    : false;

  return {
    damageAllocated,
    damageRemaining,
    canConfirmDamageChoice,
  };
}

// Returns all living players on a specific floor. Used to populate per-floor player displays.
export function getPlayersOnFloor(players, floor) {
  return players.filter((player) => player.floor === floor && player.isAlive);
}
