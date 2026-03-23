export function getEndTurnPreviewPlayerName(game, currentPlayer) {
  if (game.extraTurnAfterCurrent && currentPlayer.isAlive) {
    return `${currentPlayer.name} (extra turn)`;
  }

  let next = (game.currentPlayerIndex + 1) % game.players.length;
  let attempts = 0;
  while (!game.players[next].isAlive && attempts < game.players.length) {
    next = (next + 1) % game.players.length;
    attempts++;
  }

  return game.players[next]?.name || currentPlayer.name;
}

export function getDamageChoiceSummary(damageChoice) {
  const damageAllocated = damageChoice
    ? Object.values(damageChoice.allocation).reduce((sum, value) => sum + value, 0)
    : 0;
  const damageRemaining = damageChoice ? damageChoice.amount - damageAllocated : 0;
  const canConfirmDamageChoice = damageChoice
    ? damageChoice.allowPartial
      ? damageAllocated <= damageChoice.amount
      : damageRemaining === 0
    : false;

  return {
    damageAllocated,
    damageRemaining,
    canConfirmDamageChoice,
  };
}

export function getPlayersOnFloor(players, floor) {
  return players.filter((player) => player.floor === floor && player.isAlive);
}
