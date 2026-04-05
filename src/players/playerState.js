export function applyStatChangeState(players, playerIndex, stat, amount) {
  if (!amount) return players;

  return players.map((pl, i) => {
    if (i !== playerIndex) return pl;

    const maxIndex = pl.character[stat].length - 1;
    const nextIndex = Math.max(0, Math.min(maxIndex, pl.statIndex[stat] + amount));
    const newStatIndex = { ...pl.statIndex, [stat]: nextIndex };
    const isAlive = Object.values(newStatIndex).every((value) => value > 0);

    return { ...pl, statIndex: newStatIndex, isAlive };
  });
}

export function applyDamageAllocationState(players, playerIndex, allocation, adjustmentMode = "decrease") {
  return players.map((pl, i) => {
    if (i !== playerIndex) return pl;

    const newStatIndex = { ...pl.statIndex };
    for (const [stat, amount] of Object.entries(allocation)) {
      if (!amount) continue;
      const maxIndex = pl.character[stat].length - 1;
      newStatIndex[stat] =
        adjustmentMode === "increase"
          ? Math.min(maxIndex, newStatIndex[stat] + amount)
          : Math.max(0, newStatIndex[stat] - amount);
    }

    const isAlive = Object.values(newStatIndex).every((value) => value > 0);
    return { ...pl, statIndex: newStatIndex, isAlive };
  });
}

import { getHauntCanDeadPlayerTakeTurnState } from "../haunts/hauntDomain";

function isLethalDamageAllocation(player, choice) {
  if (!player || !choice || choice.adjustmentMode === "increase") return false;

  const previewStatIndex = { ...player.statIndex };
  for (const [stat, amount] of Object.entries(choice.allocation || {})) {
    if (!amount || !Object.prototype.hasOwnProperty.call(previewStatIndex, stat)) continue;
    previewStatIndex[stat] = Math.max(0, previewStatIndex[stat] - amount);
  }

  return Object.values(previewStatIndex).some((value) => value <= 0);
}

function playerHasSkull(player) {
  return [...(player?.omens ?? []), ...(player?.inventory ?? [])].some((card) => card.id === "skull");
}

export function passTurnCoreState(g) {
  const shouldTakeExtraTurn = !!g.extraTurnAfterCurrent && !!g.players[g.currentPlayerIndex]?.isAlive;
  let next = shouldTakeExtraTurn ? g.currentPlayerIndex : (g.currentPlayerIndex + 1) % g.players.length;

  if (!shouldTakeExtraTurn) {
    let attempts = 0;
    let canUseDeadTurn = getHauntCanDeadPlayerTakeTurnState(g, next);
    while (!g.players[next].isAlive && !canUseDeadTurn && attempts < g.players.length) {
      next = (next + 1) % g.players.length;
      attempts++;
      canUseDeadTurn = getHauntCanDeadPlayerTakeTurnState(g, next);
    }
  }

  const nextPlayer = g.players[next];
  const speed = nextPlayer.character.speed[nextPlayer.statIndex.speed];
  const nextPlayerTile = g.board[nextPlayer.floor]?.find((tile) => tile.x === nextPlayer.x && tile.y === nextPlayer.y);
  const canReadyMysticElevator = nextPlayerTile?.id === "mystic-elevator";
  const updatedPlayers = g.players.map((pl, i) => (i === next ? { ...pl, movesLeft: speed } : pl));

  return {
    game: {
      ...g,
      players: updatedPlayers,
      currentPlayerIndex: next,
      turnPhase: "move",
      movePath: [{ x: nextPlayer.x, y: nextPlayer.y, floor: nextPlayer.floor, cost: 0 }],
      pendingExplore: null,
      pendingSpecialPlacement: null,
      mysticElevatorReady: canReadyMysticElevator,
      mysticElevatorUsed: false,
      hasAttackedThisTurn: false,
      combatState: null,
      tileEffect: null,
      damageChoice: null,
      rabbitFootPendingReroll: null,
      skeletonKeyArmed: false,
      eventState: null,
      extraTurnAfterCurrent: false,
      turnNumber: shouldTakeExtraTurn ? g.turnNumber : g.turnNumber + (next === 0 ? 1 : 0),
      message: shouldTakeExtraTurn
        ? `${nextPlayer.name}'s extra turn - ${speed} moves`
        : `${nextPlayer.name}'s turn - ${speed} moves`,
    },
    nextPlayerFloor: nextPlayer.floor,
  };
}

export function passTurnWithEndTurnItemsState(g, { resolveEndTurnItemPassiveState, passTurnCore, statLabels }) {
  const currentPlayer = g.players[g.currentPlayerIndex];
  const endTurnItemResolution = resolveEndTurnItemPassiveState(g);

  if (endTurnItemResolution.type === "choice") {
    return {
      ...g,
      tileEffect: endTurnItemResolution.tileEffect,
    };
  }

  if (endTurnItemResolution.type === "auto-apply") {
    const nextState = passTurnCore({
      ...g,
      players: endTurnItemResolution.players,
    });

    return {
      ...nextState,
      message: `${currentPlayer.name} gains 1 ${statLabels[endTurnItemResolution.gainedStat]} with ${
        endTurnItemResolution.sourceName || "Necklace of Teeth"
      }. ${nextState.message}`,
    };
  }

  return passTurnCore(g);
}

export function adjustDamageAllocationChoiceState(g, stat, delta, { getPostDamageEffectsForChoice }) {
  const choice = g.damageChoice;
  if (!choice || !choice.allowedStats.includes(stat)) return g;

  const choicePlayerIndex = Number.isInteger(choice.playerIndex) ? choice.playerIndex : g.currentPlayerIndex;
  const currentPlayerState = g.players[choicePlayerIndex];
  if (!currentPlayerState) return g;
  const currentAmount = choice.allocation[stat] || 0;
  const selectedTotal = Object.values(choice.allocation).reduce((sum, value) => sum + value, 0);
  const maxForStat =
    choice.adjustmentMode === "increase"
      ? currentPlayerState.character[stat].length - 1 - currentPlayerState.statIndex[stat]
      : currentPlayerState.statIndex[stat];

  if (delta > 0) {
    if (selectedTotal >= choice.amount) return g;
    if (currentAmount >= maxForStat) return g;
  }

  if (delta < 0 && currentAmount <= 0) return g;

  const nextChoice = {
    ...choice,
    allocation: {
      ...choice.allocation,
      [stat]: Math.max(0, currentAmount + delta),
    },
  };

  return {
    ...g,
    damageChoice: {
      ...nextChoice,
      postDamageEffects: getPostDamageEffectsForChoice(currentPlayerState, nextChoice),
    },
  };
}

export function toggleDamageConversionChoiceState(g, { updateDamageChoiceType }) {
  const choice = g.damageChoice;
  if (!choice?.canConvertToGeneral) return g;

  const nextDamageType = choice.damageType === "general" ? choice.originalDamageType : "general";
  return {
    ...g,
    damageChoice: updateDamageChoiceType(choice, g.players[g.currentPlayerIndex], nextDamageType),
  };
}

export function applyPostDamagePassiveEffectsState(players, playerIndex, choice, { applyStatChange, statLabels }) {
  if (!choice || choice.amount <= 0 || !choice.postDamageEffects?.length) {
    return { players, message: "" };
  }

  let updatedPlayers = players;
  const playerName = players[playerIndex]?.name || "Player";
  const messages = [];

  for (const effect of choice.postDamageEffects) {
    const beforeIndex = updatedPlayers[playerIndex].statIndex[effect.stat];
    updatedPlayers = applyStatChange(updatedPlayers, playerIndex, effect.stat, effect.amount);
    const afterIndex = updatedPlayers[playerIndex].statIndex[effect.stat];
    const appliedAmount = afterIndex - beforeIndex;

    if (appliedAmount > 0) {
      messages.push(`${playerName} gains ${appliedAmount} ${statLabels[effect.stat]} from ${effect.sourceName}.`);
    }
  }

  return {
    players: updatedPlayers,
    message: messages.join(" "),
  };
}

export function confirmDamageChoiceState(
  g,
  {
    applyDamageAllocation,
    applyPostDamagePassiveEffects,
    applyTileEffectConsequences,
    resolveEventDamageChoiceState,
    runAdvanceEventResolution,
    passTurn,
  }
) {
  const choice = g.damageChoice;
  if (!choice) return { game: g, cameraFloor: null, clearDiceAnimation: false };
  const choicePlayerIndex = Number.isInteger(choice.playerIndex) ? choice.playerIndex : g.currentPlayerIndex;
  const choicePlayer = g.players[choicePlayerIndex];

  const selectedTotal = Object.values(choice.allocation).reduce((sum, value) => sum + value, 0);
  if (choice.allowPartial) {
    if (selectedTotal > choice.amount) return { game: g, cameraFloor: null, clearDiceAnimation: false };
  } else if (selectedTotal !== choice.amount) {
    if (!isLethalDamageAllocation(choicePlayer, choice)) {
      return { game: g, cameraFloor: null, clearDiceAnimation: false };
    }
  }

  if (!choice.allowPartial && selectedTotal > choice.amount) {
    return { game: g, cameraFloor: null, clearDiceAnimation: false };
  }

  const damagedPlayers = applyDamageAllocation(g.players, choicePlayerIndex, choice.allocation, choice.adjustmentMode);
  const postDamageResult = applyPostDamagePassiveEffects(damagedPlayers, choicePlayerIndex, choice);
  const resolvedPlayers = applyTileEffectConsequences(g, postDamageResult.players, choice.effect);
  const baseState = {
    ...g,
    players: resolvedPlayers,
    tileEffect: null,
    damageChoice: null,
  };

  const damagedCheckPlayer = resolvedPlayers[choicePlayerIndex];
  if (!damagedCheckPlayer.isAlive && !choice.skullChallengeResolved && playerHasSkull(damagedCheckPlayer)) {
    return {
      game: {
        ...g,
        combatState: null,
        damageChoice: null,
        skullChallenge: {
          playerIndex: choicePlayerIndex,
          damageChoice: { ...choice, skullChallengeResolved: true },
          roll: null,
          total: null,
        },
      },
      cameraFloor: null,
      clearDiceAnimation: false,
    };
  }

  if (choice.source === "combat") {
    const combatMessage = choice.combatSummaryMessage || "";
    const postDamageMessage = postDamageResult.message || "";
    const combinedMessage = [combatMessage, postDamageMessage].filter(Boolean).join(" ");
    const damagedPlayer = resolvedPlayers[choicePlayerIndex];
    const activePlayerDied = choicePlayerIndex === g.currentPlayerIndex && damagedPlayer && !damagedPlayer.isAlive;

    if (activePlayerDied) {
      const passedState = passTurn({
        ...baseState,
        combatState: null,
        message: combinedMessage || g.message,
      });

      return {
        game: {
          ...passedState,
          message: combinedMessage ? `${combinedMessage} ${passedState.message}` : passedState.message,
        },
        cameraFloor: null,
        clearDiceAnimation: true,
      };
    }

    return {
      game: {
        ...baseState,
        combatState: null,
        message: combinedMessage || g.message,
      },
      cameraFloor: null,
      clearDiceAnimation: true,
    };
  }

  if (choice.source === "haunt-exorcise-failure") {
    return {
      game: {
        ...baseState,
        message: postDamageResult.message || g.message,
      },
      cameraFloor: null,
      clearDiceAnimation: true,
    };
  }

  if (choice.source === "dynamite") {
    const damagedPlayer = resolvedPlayers[choicePlayerIndex];
    const remainingQueue = g.dynamiteState?.queue?.length || 0;
    const nextDynamiteState = remainingQueue === 0 ? null : g.dynamiteState;
    // If the current player died (e.g. threw dynamite at own tile and was caught), pass their turn
    if (!damagedPlayer.isAlive && choicePlayerIndex === g.currentPlayerIndex) {
      const passedState = passTurn({ ...baseState, dynamiteState: nextDynamiteState });
      return {
        game: {
          ...passedState,
          message: postDamageResult.message || g.message,
        },
        cameraFloor: null,
        clearDiceAnimation: false,
      };
    }
    return {
      game: {
        ...baseState,
        dynamiteState: nextDynamiteState,
        message: postDamageResult.message || g.message,
      },
      cameraFloor: null,
      clearDiceAnimation: false,
    };
  }

  const eventDamageResult = resolveEventDamageChoiceState(g, choice, baseState, postDamageResult.message, {
    runAdvanceEventResolution,
  });
  if (eventDamageResult) {
    return {
      game: eventDamageResult.game,
      cameraFloor: eventDamageResult.cameraFloor,
      clearDiceAnimation: true,
    };
  }

  const nextState = passTurn(baseState);
  return {
    game: postDamageResult.message
      ? {
          ...nextState,
          message: `${postDamageResult.message} ${nextState.message}`,
        }
      : nextState,
    cameraFloor: null,
    clearDiceAnimation: true,
  };
}

export function getDamagePreviewState(player, choice) {
  const preview = { ...player.statIndex };
  if (!choice) return preview;

  for (const [stat, amount] of Object.entries(choice.allocation)) {
    if (choice.adjustmentMode === "increase") {
      const maxIndex = player.character[stat].length - 1;
      preview[stat] = Math.min(maxIndex, preview[stat] + amount);
    } else {
      preview[stat] = Math.max(0, preview[stat] - amount);
    }
  }
  return preview;
}

export function getStatTrackCellClassState(index, currentIndex, previewIndex, adjustmentMode = "decrease") {
  if (index === currentIndex && index === previewIndex) {
    return "stat-track-cell stat-track-cell-current";
  }
  if (index === currentIndex) return "stat-track-cell stat-track-cell-current";
  if (index === previewIndex) {
    return `stat-track-cell ${
      adjustmentMode === "increase" ? "stat-track-cell-preview-gain" : "stat-track-cell-preview-loss"
    }`;
  }
  if (index < previewIndex) return "stat-track-cell stat-track-cell-spent";
  return "stat-track-cell";
}
