import { getHauntCanDeadPlayerTakeTurnState } from "../haunts/hauntDomain";
import { isLethalDamageAllocation } from "../shared/playerHelpers";

/* [PLAYER-STATE] [FORMAT] Returns the name of the player who will act after the current turn. Accounts for extra turns, dead players, and monster turns during haunts. */
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

/* [DAMAGE] [VALIDATION] Returns { damageAllocated, damageRemaining, canConfirmDamageChoice } for the active damage choice. Used by DamageChoiceOverlay to control the Confirm button. */
export function getDamageChoiceSummary(damageChoice, currentPlayer = null) {
  const damageAllocated = damageChoice
    ? Object.values(damageChoice.allocation).reduce((sum, value) => sum + value, 0)
    : 0;
  const damageRemaining = damageChoice ? damageChoice.amount - damageAllocated : 0;
  const canConfirmDamageChoice = damageChoice
    ? damageChoice.allowPartial
      ? damageAllocated <= damageChoice.amount
      : damageAllocated > damageChoice.amount
        ? false
        : damageRemaining === 0 || isLethalDamageAllocation(currentPlayer, damageChoice)
    : false;

  return {
    damageAllocated,
    damageRemaining,
    canConfirmDamageChoice,
  };
}

/* [PLAYER-STATE] [LOOKUP] Returns all living players on a specific floor. Used to populate per-floor player displays. */
export function getPlayersOnFloor(players, floor) {
  return players.filter((player) => player.floor === floor && player.isAlive);
}
