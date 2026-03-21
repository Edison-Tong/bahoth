import { advanceEventResolution, getMatchingOutcome } from "./eventEngine";
import { appendEventSummary, describeEventEffects, getEventRollButtonLabel } from "./eventUtils";

const DAMAGE_STATS = {
  physical: ["might", "speed"],
  mental: ["sanity", "knowledge"],
  general: ["might", "speed", "sanity", "knowledge"],
};

export function continueEventState(g, deps) {
  const { runAdvanceEventResolution, finalizeEventState } = deps;
  if (!g.eventState) return { game: g, cameraFloor: null };

  if (g.eventState.awaiting?.type === "trait-roll-sequence-complete") {
    const results = g.eventState.awaiting.results || [];
    const allSucceeded = results.every((entry) => !entry.failed);
    const rewardOutcome = allSucceeded
      ? (g.eventState.awaiting.outcomes || []).find((outcome) => outcome.when?.allRolls?.min !== undefined)
      : null;

    const resumed = runAdvanceEventResolution({
      ...g,
      eventState: {
        ...g.eventState,
        awaiting: null,
        summary: null,
        pendingEffects: [...(rewardOutcome?.effects || [])],
      },
    });
    return { game: resumed.game, cameraFloor: resumed.cameraFloor || null };
  }

  if (g.eventState.awaiting?.type === "event-damage-sequence-complete") {
    const resolvedEffects = g.eventState.awaiting.results || [];
    const hydratedState = {
      ...g,
      eventState: {
        ...g.eventState,
        awaiting: null,
        pendingEffects: [...resolvedEffects, ...(g.eventState.pendingEffects || [])],
      },
    };
    const resumed = runAdvanceEventResolution(hydratedState);
    return { game: resumed.game, cameraFloor: resumed.cameraFloor || null };
  }

  const result = runAdvanceEventResolution({
    ...g,
    eventState: {
      ...g.eventState,
      summary: null,
      lastRoll: null,
    },
  });
  const pendingEventState = result.game.eventState;
  if (
    pendingEventState &&
    !pendingEventState.awaiting &&
    (!pendingEventState.pendingEffects || pendingEventState.pendingEffects.length === 0) &&
    !pendingEventState.summary &&
    !pendingEventState.lastRoll
  ) {
    return {
      game: finalizeEventState(result.game, result.game.message || `${pendingEventState.card.name} resolved.`).game,
      cameraFloor: result.cameraFloor || null,
    };
  }

  return { game: result.game, cameraFloor: result.cameraFloor || null };
}

export function adjustEventRollTotalState(g, delta, deps) {
  const { getMatchingOutcome, describeEventEffects } = deps;
  const eventState = g.eventState;
  const lastRoll = eventState?.lastRoll;
  if (!eventState || !lastRoll || !Array.isArray(lastRoll.outcomes)) return g;

  const nextTotal = Math.max(0, (lastRoll.total || 0) + delta);
  const matchedOutcome = getMatchingOutcome(lastRoll.outcomes, nextTotal);
  const resolvedEffects = [...(matchedOutcome?.effects || [])];

  return {
    ...g,
    eventState: {
      ...eventState,
      lastRoll: {
        ...lastRoll,
        total: nextTotal,
      },
      summary: describeEventEffects(resolvedEffects),
      pendingEffects: resolvedEffects,
    },
    message: `${eventState.card.name}: roll adjusted to ${nextTotal}.`,
  };
}

export function eventAwaitingChoiceState(g, value, deps) {
  const { runAdvanceEventResolution, runApplyResolvedEventEffect, resolveRollReadyAwaiting, eventFlowDeps } = deps;

  const immediateAwaiting = g.eventState?.awaiting;
  if (immediateAwaiting?.type === "roll-ready") {
    const rollReady = resolveRollReadyAwaiting(g, immediateAwaiting, eventFlowDeps);
    return {
      game: rollReady.game,
      cameraFloor: null,
      diceAnimation: rollReady.animation || null,
    };
  }

  if (immediateAwaiting?.type === "trait-roll-sequence-ready") {
    return {
      game: {
        ...g,
        eventState: {
          ...g.eventState,
          awaiting: {
            ...g.eventState.awaiting,
            type: "trait-roll-sequence-rolling",
          },
        },
      },
      cameraFloor: null,
      diceAnimation: null,
    };
  }

  const awaiting = g.eventState?.awaiting;
  if (!awaiting) return { game: g, cameraFloor: null, diceAnimation: null };

  if (awaiting.type === "choice") {
    const nextState = {
      ...g,
      eventState: {
        ...g.eventState,
        awaiting: null,
        context: {
          ...g.eventState.context,
          choices: {
            ...g.eventState.context.choices,
            [awaiting.stepId]: value,
          },
        },
      },
    };
    const result = runAdvanceEventResolution(nextState);
    return { game: result.game, cameraFloor: result.cameraFloor || null, diceAnimation: null };
  }

  if (awaiting.type === "step-stat-choice") {
    const nextState = {
      ...g,
      eventState: {
        ...g.eventState,
        awaiting: null,
        context: {
          ...g.eventState.context,
          selectedStats: {
            ...g.eventState.context.selectedStats,
            [awaiting.stepKey]: value,
          },
        },
        stepIndex: Math.max(0, g.eventState.stepIndex - 1),
      },
    };
    let result = runAdvanceEventResolution(nextState);
    let nextDiceAnimation = null;
    if (result.game.eventState?.awaiting?.type === "roll-ready") {
      const rollReady = resolveRollReadyAwaiting(result.game, result.game.eventState.awaiting, eventFlowDeps);
      result = {
        ...result,
        game: rollReady.game,
      };
      nextDiceAnimation = rollReady.animation || null;
    }
    return { game: result.game, cameraFloor: result.cameraFloor || null, diceAnimation: nextDiceAnimation };
  }

  if (awaiting.type === "stat-choice") {
    const applied = runApplyResolvedEventEffect(g, awaiting.effect, value);
    const resumed = runAdvanceEventResolution({
      ...applied.game,
      eventState: {
        ...applied.game.eventState,
        awaiting: null,
      },
    });
    return {
      game: resumed.game,
      cameraFloor: applied.cameraFloor || resumed.cameraFloor || null,
      diceAnimation: null,
    };
  }

  if (awaiting.type === "item-choice") {
    const nextPlayers = g.players.map((player, index) =>
      index === g.currentPlayerIndex
        ? { ...player, inventory: player.inventory.filter((_, itemIndex) => itemIndex !== Number(value)) }
        : player
    );
    const resumed = runAdvanceEventResolution({
      ...g,
      players: nextPlayers,
      eventState: {
        ...g.eventState,
        awaiting: null,
      },
    });
    return { game: resumed.game, cameraFloor: resumed.cameraFloor || null, diceAnimation: null };
  }

  return { game: g, cameraFloor: null, diceAnimation: null };
}

export function eventTileChoiceState(g, option, deps) {
  const { getTileAtPosition } = deps;
  const awaiting = g.eventState?.awaiting;
  if (awaiting?.type !== "tile-choice") return { game: g, cameraFloor: null };

  if (awaiting.effect?.type === "move") {
    const tile = getTileAtPosition(g.board, option.x, option.y, option.floor);
    if (!tile) return { game: g, cameraFloor: null };

    return {
      game: {
        ...g,
        players: g.players.map((player, index) =>
          index === g.currentPlayerIndex ? { ...player, x: tile.x, y: tile.y, floor: option.floor } : player
        ),
        movePath: [{ x: tile.x, y: tile.y, floor: option.floor, cost: 0 }],
        eventState: {
          ...g.eventState,
          awaiting: {
            ...awaiting,
            selectedOptionId: option.id,
          },
        },
      },
      cameraFloor: option.floor,
    };
  }

  return {
    game: {
      ...g,
      eventState: {
        ...g.eventState,
        awaiting: {
          ...awaiting,
          selectedOptionId: option.id,
        },
      },
    },
    cameraFloor: option.floor,
  };
}

export function confirmEventTileChoiceState(g, deps) {
  const { getTileAtPosition, runAdvanceEventResolution } = deps;
  const awaiting = g.eventState?.awaiting;
  if (awaiting?.type !== "tile-choice") return { game: g, cameraFloor: null };

  const selectedOption =
    awaiting.options?.find((option) => option.id === awaiting.selectedOptionId) ||
    (awaiting.options?.length === 1 ? awaiting.options[0] : null);
  if (!selectedOption) return { game: g, cameraFloor: null };

  const tile = getTileAtPosition(g.board, selectedOption.x, selectedOption.y, selectedOption.floor);
  if (!tile) return { game: g, cameraFloor: null };

  if (awaiting.effect.type === "move") {
    const resumed = runAdvanceEventResolution({
      ...g,
      players: g.players.map((player, index) =>
        index === g.currentPlayerIndex ? { ...player, x: tile.x, y: tile.y, floor: selectedOption.floor } : player
      ),
      movePath: [{ x: tile.x, y: tile.y, floor: selectedOption.floor, cost: 0 }],
      eventState: {
        ...g.eventState,
        awaiting: null,
      },
    });
    return { game: resumed.game, cameraFloor: selectedOption.floor };
  }

  if (awaiting.effect.type === "place-token") {
    const nextBoard = {
      ...g.board,
      [selectedOption.floor]: g.board[selectedOption.floor].map((currentTile) =>
        currentTile.x === tile.x && currentTile.y === tile.y
          ? {
              ...currentTile,
              obstacle: awaiting.effect.token === "obstacle" ? true : currentTile.obstacle,
              tokens:
                awaiting.effect.token === "obstacle"
                  ? currentTile.tokens || []
                  : [...(currentTile.tokens || []), { type: awaiting.effect.token }],
            }
          : currentTile
      ),
    };
    const resumed = runAdvanceEventResolution({
      ...g,
      board: nextBoard,
      eventState: {
        ...g.eventState,
        awaiting: null,
      },
    });
    return { game: resumed.game, cameraFloor: selectedOption.floor };
  }

  return { game: g, cameraFloor: null };
}

export function startEventFromDrawnCardState(
  g,
  { card, initialEventChoice = null, autoRollIfReady = false, queuedAngelsFeatherTotal = null },
  deps
) {
  const { runAdvanceEventResolution, resolveRollReadyAwaiting, eventFlowDeps } = deps;

  const eventGame = {
    ...g,
    drawnCard: null,
    turnPhase: "event",
    eventState: {
      card,
      stepIndex: 0,
      context: {
        choices: {},
        selectedStats: {},
      },
      pendingEffects: [],
      awaiting: null,
      summary: null,
      lastRoll: null,
    },
    message: `${card.name} begins...`,
  };

  const result = runAdvanceEventResolution(eventGame);
  let nextState = result.game;
  let nextCameraFloor = result.cameraFloor || null;
  let nextDiceAnimation = null;
  let shouldClearQueuedAngelsFeather = false;

  if (initialEventChoice !== null && nextState.eventState?.awaiting?.type === "choice") {
    const choiceStepId = nextState.eventState.awaiting.stepId;
    const choiceApplied = {
      ...nextState,
      eventState: {
        ...nextState.eventState,
        awaiting: null,
        context: {
          ...nextState.eventState.context,
          choices: {
            ...nextState.eventState.context.choices,
            [choiceStepId]: initialEventChoice,
          },
        },
      },
    };
    const choiceResult = runAdvanceEventResolution(choiceApplied);
    nextState = choiceResult.game;
    nextCameraFloor = choiceResult.cameraFloor || nextCameraFloor;
  }

  if (queuedAngelsFeatherTotal !== null) {
    if (
      nextState.eventState?.awaiting?.type === "roll-ready" &&
      nextState.eventState.awaiting.rollKind === "trait-roll"
    ) {
      nextState = {
        ...nextState,
        eventState: {
          ...nextState.eventState,
          awaiting: {
            ...nextState.eventState.awaiting,
            overrideTotal: queuedAngelsFeatherTotal,
          },
        },
      };
    } else if (nextState.eventState?.awaiting?.type === "trait-roll-sequence-ready") {
      nextState = {
        ...nextState,
        eventState: {
          ...nextState.eventState,
          awaiting: {
            ...nextState.eventState.awaiting,
            overrideTotal: queuedAngelsFeatherTotal,
          },
        },
      };
    }

    shouldClearQueuedAngelsFeather = true;
  }

  if (autoRollIfReady && nextState.eventState?.awaiting?.type === "roll-ready") {
    const rollReady = resolveRollReadyAwaiting(nextState, nextState.eventState.awaiting, eventFlowDeps);
    nextState = rollReady.game;
    nextDiceAnimation = rollReady.animation;
  } else if (autoRollIfReady && nextState.eventState?.awaiting?.type === "trait-roll-sequence-ready") {
    nextState = {
      ...nextState,
      eventState: {
        ...nextState.eventState,
        awaiting: {
          ...nextState.eventState.awaiting,
          type: "trait-roll-sequence-rolling",
        },
      },
    };
  }

  return {
    game: nextState,
    cameraFloor: nextCameraFloor,
    diceAnimation: nextDiceAnimation,
    shouldClearQueuedAngelsFeather,
  };
}

export function resolveEventDamageChoiceState(g, choice, baseState, postDamageMessage, deps) {
  const { runAdvanceEventResolution } = deps;

  if (choice.source === "event-effect") {
    const resumed = runAdvanceEventResolution({
      ...baseState,
      eventState: g.eventState
        ? {
            ...g.eventState,
            awaiting: null,
            summary: null,
            lastRoll: null,
            pendingEffects: [...(g.eventState.pendingEffects || [])],
          }
        : null,
      message: postDamageMessage || g.message,
    });
    return { game: resumed.game, cameraFloor: resumed.cameraFloor || null };
  }

  if (choice.source === "event-stat-choice") {
    const resumed = runAdvanceEventResolution(baseState);
    return { game: resumed.game, cameraFloor: resumed.cameraFloor || null };
  }

  return null;
}

export function getAngelsFeatherUsageState({ game, drawnEventPrimaryAction, queuedAngelsFeatherTotal }) {
  const eventState = game.eventState;
  const awaiting = eventState?.awaiting;

  const canApplyNow =
    (awaiting?.type === "roll-ready" && awaiting.rollKind === "trait-roll" && awaiting.overrideTotal === undefined) ||
    (awaiting?.type === "trait-roll-sequence-ready" && awaiting.overrideTotal === undefined);

  const canQueueForDrawnEvent =
    game.drawnCard?.type === "event" &&
    drawnEventPrimaryAction?.type === "roll" &&
    drawnEventPrimaryAction?.isTraitRoll &&
    queuedAngelsFeatherTotal === null;

  return {
    canApplyNow,
    canQueueForDrawnEvent,
    canUseAngelsFeatherNow: canApplyNow || canQueueForDrawnEvent,
  };
}

export function chooseAngelsFeatherValueState(
  g,
  total,
  viewedCard,
  { drawnEventPrimaryAction, queuedAngelsFeatherTotal }
) {
  const usageState = getAngelsFeatherUsageState({ game: g, drawnEventPrimaryAction, queuedAngelsFeatherTotal });
  const { canApplyNow, canQueueForDrawnEvent } = usageState;
  if (!viewedCard) return { game: g, queueTotal: undefined, closeViewedCard: false };
  if (viewedCard.id !== "angels-feather") return { game: g, queueTotal: undefined, closeViewedCard: false };
  if (viewedCard.ownerCollection !== "inventory") return { game: g, queueTotal: undefined, closeViewedCard: false };
  if (viewedCard.ownerIndex !== g.currentPlayerIndex) return { game: g, queueTotal: undefined, closeViewedCard: false };
  if (!canApplyNow && !canQueueForDrawnEvent) return { game: g, queueTotal: undefined, closeViewedCard: false };

  const owner = g.players[viewedCard.ownerIndex];
  const inventoryCard = owner?.inventory?.[viewedCard.ownerCardIndex];
  if (!inventoryCard || inventoryCard.id !== "angels-feather") {
    return { game: g, queueTotal: undefined, closeViewedCard: false };
  }

  const nextPlayers = g.players.map((player, index) => {
    if (index !== viewedCard.ownerIndex) return player;
    return {
      ...player,
      inventory: player.inventory.filter((_, cardIndex) => cardIndex !== viewedCard.ownerCardIndex),
    };
  });

  const nextGame = {
    ...g,
    players: nextPlayers,
    eventState:
      canApplyNow && g.eventState
        ? {
            ...g.eventState,
            awaiting: {
              ...g.eventState.awaiting,
              overrideTotal: total,
            },
          }
        : g.eventState,
    message: `${owner.name} buries Angel's Feather and sets this roll to ${total}.`,
  };

  return {
    game: nextGame,
    queueTotal: canQueueForDrawnEvent && !canApplyNow ? total : null,
    closeViewedCard: true,
  };
}

export function createDamageChoice(effect, player) {
  const damageType = effect.damageType || "physical";
  const allowedStats = DAMAGE_STATS[damageType] || DAMAGE_STATS.physical;
  const allocation = Object.fromEntries(allowedStats.map((stat) => [stat, 0]));
  const conversionOptions = getDamageConversionOptions(player, damageType);
  const postDamageEffects =
    effect.damage > 0
      ? getPostDamageEffectsForChoice(player, {
          damageType,
          originalDamageType: damageType,
          allocation,
        })
      : [];

  return {
    source: "tile-effect",
    effect,
    originalDamageType: damageType,
    damageType,
    adjustmentMode: "decrease",
    amount: effect.damage,
    allowedStats,
    allocation,
    playerName: player.name,
    canConvertToGeneral: damageType !== "general" && conversionOptions.canConvertToGeneral,
    conversionSourceNames: conversionOptions.sourceNames,
    postDamageEffects,
  };
}

export function updateDamageChoiceType(choice, player, damageType) {
  const allowedStats = DAMAGE_STATS[damageType] || DAMAGE_STATS.physical;
  const nextChoice = {
    ...choice,
    damageType,
    allowedStats,
    allocation: Object.fromEntries(allowedStats.map((stat) => [stat, 0])),
  };

  return {
    ...nextChoice,
    postDamageEffects: choice.amount > 0 ? getPostDamageEffectsForChoice(player, nextChoice) : [],
  };
}

export function getMysticElevatorDestination(total) {
  if (total >= 4) {
    return {
      floors: ["upper", "ground", "basement"],
      label: "any floor",
    };
  }

  if (total === 3) {
    return {
      floors: ["upper"],
      label: "the upper floor",
    };
  }

  if (total === 2) {
    return {
      floors: ["ground"],
      label: "the ground floor",
    };
  }

  return {
    floors: ["basement"],
    label: "the basement",
  };
}

export function isQueuedTileEffectType(type) {
  return ["discover-gain", "armory", "junk-room", "panic-room", "mystic-elevator-result"].includes(type);
}

export function applyTileEffectConsequences(g, players, effect) {
  let updatedPlayers = [...players];
  const pi = g.currentPlayerIndex;

  if (effect.type === "collapsed" && effect.collapsed) {
    const basementLanding = g.board.basement?.find((t) => t.id === "basement-landing");
    if (basementLanding) {
      updatedPlayers = updatedPlayers.map((pl, i) =>
        i === pi ? { ...pl, x: basementLanding.x, y: basementLanding.y, floor: "basement" } : pl
      );
    }
  }

  if (effect.type === "laundry-chute") {
    const basementLanding = g.board.basement?.find((t) => t.id === "basement-landing");
    if (basementLanding) {
      updatedPlayers = updatedPlayers.map((pl, i) =>
        i === pi ? { ...pl, x: basementLanding.x, y: basementLanding.y, floor: "basement" } : pl
      );
    }
  }

  return updatedPlayers;
}

export function getEventUiState(game, eventEngineDeps, queuedAngelsFeatherTotal = null) {
  const eventState = game.eventState;
  const drawnEventPrimaryAction =
    game.drawnCard?.type === "event" ? getInitialEventPrimaryAction(game, game.drawnCard, eventEngineDeps) : null;
  const eventTileChoiceOptions = eventState?.awaiting?.type === "tile-choice" ? eventState.awaiting.options || [] : [];
  const selectedEventTileChoiceId =
    eventState?.awaiting?.type === "tile-choice" ? eventState.awaiting.selectedOptionId || null : null;
  const showEventResolutionModal = !!eventState && eventState.awaiting?.type !== "tile-choice";
  const angelsFeatherUsageState = getAngelsFeatherUsageState({
    game,
    drawnEventPrimaryAction,
    queuedAngelsFeatherTotal,
  });

  return {
    drawnEventPrimaryAction,
    eventTileChoiceOptions,
    selectedEventTileChoiceId,
    showEventResolutionModal,
    canUseAngelsFeatherNow: angelsFeatherUsageState.canUseAngelsFeatherNow,
  };
}

export function rollDice(n) {
  const results = [];
  for (let i = 0; i < n; i++) {
    results.push(Math.floor(Math.random() * 3));
  }
  return results;
}

export function formatSourceNames(names) {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function getTileAtPosition(board, x, y, floor) {
  return board?.[floor]?.find((tile) => tile.x === x && tile.y === y) || null;
}

export function getBoardTraitRollDiceBonus(board, player) {
  const tile = getTileAtPosition(board, player?.x, player?.y, player?.floor);
  const blessingCount = tile?.tokens?.filter((token) => token.type === "blessing").length || 0;

  return {
    amount: blessingCount,
    sourceNames: blessingCount > 0 ? Array.from({ length: blessingCount }, () => "Blessing") : [],
  };
}

export function getPassiveEffects(player) {
  const ownedCards = [...(player?.omens ?? []), ...(player?.inventory ?? [])];

  return ownedCards.flatMap((card) =>
    (card.passiveEffects ?? []).map((effect) => ({
      ...effect,
      sourceName: card.name,
    }))
  );
}

export function getTraitRollBonus(player, stat) {
  const matchingEffects = getPassiveEffects(player).filter(
    (effect) => effect.type === "trait-roll-bonus" && effect.stat === stat
  );

  return {
    amount: matchingEffects.reduce((sum, effect) => sum + (effect.amount || 0), 0),
    sourceNames: matchingEffects.map((effect) => effect.sourceName),
  };
}

export function getDamageReduction(player, damageType) {
  const matchingEffects = getPassiveEffects(player).filter(
    (effect) => effect.type === "damage-reduction" && effect.damageTypes?.includes(damageType)
  );

  return {
    amount: matchingEffects.reduce((sum, effect) => sum + (effect.amount || 0), 0),
    sourceNames: matchingEffects.map((effect) => effect.sourceName),
  };
}

export function getTraitRollDiceBonus(player, context) {
  const matchingEffects = getPassiveEffects(player).filter(
    (effect) =>
      effect.type === "trait-roll-dice-bonus" &&
      (!effect.contexts || effect.contexts.length === 0 || effect.contexts.includes(context))
  );

  return {
    amount: matchingEffects.reduce((sum, effect) => sum + (effect.amount || 0), 0),
    sourceNames: matchingEffects.map((effect) => effect.sourceName),
  };
}

export function getDamageConversionOptions(player, damageType) {
  const matchingEffects = getPassiveEffects(player).filter(
    (effect) =>
      effect.type === "damage-conversion-option" &&
      effect.damageTypes?.includes(damageType) &&
      effect.convertTo === "general"
  );

  return {
    canConvertToGeneral: matchingEffects.length > 0,
    sourceNames: matchingEffects.map((effect) => effect.sourceName),
  };
}

export function createTraitRollModifier(traitBonus, diceBonus) {
  const sourceNames = [...new Set([...(traitBonus?.sourceNames || []), ...(diceBonus?.sourceNames || [])])];
  if (sourceNames.length === 0) return null;

  const parts = [];
  if ((diceBonus?.amount || 0) > 0) parts.push(`+${diceBonus.amount} dice`);
  if ((traitBonus?.amount || 0) > 0) parts.push(`+${traitBonus.amount}`);

  return {
    value: parts.join(" "),
    label: `from ${formatSourceNames(sourceNames)}`,
    tone: "positive",
  };
}

export function resolveTraitRoll(player, { stat, baseDiceCount, context, board = null, usePassives = true }) {
  const passiveDiceBonus = usePassives ? getTraitRollDiceBonus(player, context) : { amount: 0, sourceNames: [] };
  const boardDiceBonus = board ? getBoardTraitRollDiceBonus(board, player) : { amount: 0, sourceNames: [] };
  const diceBonus = {
    amount: passiveDiceBonus.amount + boardDiceBonus.amount,
    sourceNames: [...passiveDiceBonus.sourceNames, ...boardDiceBonus.sourceNames],
  };
  const traitBonus = usePassives ? getTraitRollBonus(player, stat) : { amount: 0, sourceNames: [] };
  const dice = rollDice(baseDiceCount + diceBonus.amount);

  return {
    dice,
    total: dice.reduce((sum, value) => sum + value, 0) + traitBonus.amount,
    modifier: createTraitRollModifier(traitBonus, diceBonus),
  };
}

export function createDiceModifier({ amount, sourceNames, sign = "+", labelPrefix = "from", tone = "positive" }) {
  if (!amount || sourceNames.length === 0) return null;

  return {
    value: `${sign}${amount}`,
    label: `${labelPrefix} ${formatSourceNames(sourceNames)}`,
    tone,
  };
}

export function resolveDamageEffect(player, effect) {
  if (!effect?.damageType || effect.damage === undefined || effect.damageResolved) return effect;

  const damageReduction = getDamageReduction(player, effect.damageType);

  return {
    ...effect,
    damage: Math.max(0, effect.damage - damageReduction.amount),
    damageResolved: true,
    damageModifier:
      damageReduction.amount > 0
        ? createDiceModifier({
            amount: damageReduction.amount,
            sourceNames: damageReduction.sourceNames,
            sign: "-",
            labelPrefix: "blocked by",
          })
        : null,
  };
}

export function getDamageTypesFromAllocation(choice) {
  if (!choice) return [];

  if (choice.damageType !== "general") {
    return [choice.damageType];
  }

  const damageTypes = new Set();
  for (const [stat, amount] of Object.entries(choice.allocation || {})) {
    if (!amount) continue;
    if (stat === "might" || stat === "speed") damageTypes.add("physical");
    if (stat === "sanity" || stat === "knowledge") damageTypes.add("mental");
  }

  return [...damageTypes];
}

export function getPostDamageEffectsForChoice(player, choice) {
  const damageTypes = getDamageTypesFromAllocation(choice);
  if (damageTypes.length === 0) return [];

  return getPassiveEffects(player).filter(
    (effect) => effect.type === "stat-gain-on-damage" && effect.damageTypes?.some((type) => damageTypes.includes(type))
  );
}

export function getInitialEventPrimaryAction(g, card, eventEngineDeps) {
  const simulatedEvent = {
    ...g,
    drawnCard: null,
    turnPhase: "event",
    eventState: {
      card,
      stepIndex: 0,
      context: {
        choices: {},
        selectedStats: {},
      },
      pendingEffects: [],
      awaiting: null,
      summary: null,
      lastRoll: null,
    },
  };

  const result = advanceEventResolution(simulatedEvent, eventEngineDeps);
  const awaiting = result.game.eventState?.awaiting;

  if (awaiting?.type === "roll-ready") {
    return {
      type: "roll",
      label: getEventRollButtonLabel(awaiting.baseDiceCount || 0),
      autoRoll: true,
      isTraitRoll: awaiting.rollKind === "trait-roll",
    };
  }

  if (awaiting?.type === "trait-roll-sequence-ready") {
    return {
      type: "roll",
      label: "Roll",
      autoRoll: true,
      isTraitRoll: true,
    };
  }

  if (awaiting?.type === "choice" && Array.isArray(awaiting.options) && awaiting.options.length > 0) {
    return {
      type: "choice",
      options: awaiting.options,
      prompt: awaiting.prompt || "Choose an option.",
      autoRoll: false,
    };
  }

  return {
    type: "continue",
    label: "Continue",
    autoRoll: false,
    isTraitRoll: false,
  };
}

export function resolveRollReadyAwaiting(g, awaiting, deps) {
  const { STAT_LABELS, rollDice: depRollDice, resolveTraitRoll: depResolveTraitRoll } = deps;
  const currentPlayerState = g.players[g.currentPlayerIndex];

  if (awaiting.rollKind === "trait-roll") {
    if (awaiting.overrideTotal !== undefined && awaiting.overrideTotal !== null) {
      const forcedTotal = Math.max(0, Math.min(8, awaiting.overrideTotal));
      const matchedOutcome = getMatchingOutcome(awaiting.outcomes || [], forcedTotal);
      const resolvedEffects = [...(matchedOutcome?.effects || [])];

      return {
        game: {
          ...g,
          eventState: {
            ...g.eventState,
            awaiting: null,
            lastRoll: {
              label: STAT_LABELS[awaiting.rollStat],
              dice: [forcedTotal],
              total: forcedTotal,
              modifier: null,
              outcomes: [...(awaiting.outcomes || [])],
            },
            summary: describeEventEffects(resolvedEffects),
            pendingEffects: resolvedEffects,
          },
          message: `${g.eventState.card.name}: roll set to ${forcedTotal} by Angel's Feather.`,
        },
        animation: null,
      };
    }

    const roll = depResolveTraitRoll(currentPlayerState, {
      stat: awaiting.rollStat,
      baseDiceCount: awaiting.baseDiceCount,
      context: "event",
      board: g.board,
      usePassives: awaiting.usePassives !== false,
    });

    return {
      game: {
        ...g,
        eventState: {
          ...g.eventState,
          awaiting: {
            ...awaiting,
            type: "rolling",
          },
        },
      },
      animation: {
        purpose: "event-roll",
        final: roll.dice,
        display: Array.from({ length: roll.dice.length }, () => Math.floor(Math.random() * 3)),
        settled: false,
        label: STAT_LABELS[awaiting.rollStat],
        total: roll.total,
        modifier: roll.modifier,
        outcomes: [...(awaiting.outcomes || [])],
      },
    };
  }

  if (awaiting.rollKind === "dice-roll" || awaiting.rollKind === "haunt-roll") {
    const dice = depRollDice(awaiting.baseDiceCount || 0);
    const total = dice.reduce((sum, die) => sum + die, 0);

    return {
      game: {
        ...g,
        eventState: {
          ...g.eventState,
          awaiting: {
            ...awaiting,
            type: "rolling",
          },
        },
      },
      animation: {
        purpose: "event-roll",
        final: dice,
        display: Array.from({ length: dice.length }, () => Math.floor(Math.random() * 3)),
        settled: false,
        label: awaiting.label || `${dice.length} dice`,
        total,
        modifier: null,
        outcomes: [...(awaiting.outcomes || [])],
      },
    };
  }

  return { game: g, animation: null };
}

export function resolveEventAnimationSettlement(g, da, applyStatChange) {
  if (da.purpose === "event-roll") {
    if (!g.eventState) return { handled: true, game: g };

    const matchedOutcome = getMatchingOutcome(da.outcomes || [], da.total);
    const resolvedEffects = [...(matchedOutcome?.effects || [])];

    return {
      handled: true,
      game: {
        ...g,
        eventState: {
          ...g.eventState,
          awaiting: null,
          lastRoll: {
            label: da.label,
            dice: da.final,
            total: da.total,
            modifier: da.modifier || null,
            outcomes: [...(da.outcomes || [])],
          },
          summary: describeEventEffects(resolvedEffects),
          pendingEffects: resolvedEffects,
        },
        message: `${g.eventState.card.name}: roll resolved.`,
      },
    };
  }

  if (da.purpose === "event-damage-roll") {
    if (!g.eventState) return { handled: true, game: g };

    const rolledAmount = da.final.reduce((sum, die) => sum + die, 0);
    const awaitingEffect = g.eventState.awaiting?.effect;
    const baseEffect = da.effect || awaitingEffect;
    if (!baseEffect) return { handled: true, game: g };

    const resolvedEffect = {
      ...baseEffect,
      resolvedAmount: rolledAmount,
    };

    return {
      handled: true,
      game: {
        ...g,
        eventState: {
          ...g.eventState,
          awaiting: null,
          summary: appendEventSummary(
            g.eventState.summary,
            `${g.players[g.currentPlayerIndex].name} rolls ${rolledAmount} for ${baseEffect.damageType} damage.`
          ),
          pendingEffects: [resolvedEffect, ...(g.eventState.pendingEffects || [])],
        },
        message: `${g.eventState.card.name}: damage roll resolved.`,
      },
    };
  }

  if (da.purpose === "event-damage-sequence") {
    const awaiting = g.eventState?.awaiting;
    if (!g.eventState || awaiting?.type !== "event-damage-sequence-rolling") {
      return { handled: true, game: g };
    }

    const rolledAmount = da.final.reduce((sum, die) => sum + die, 0);
    const currentEffect = awaiting.effects?.[awaiting.currentIndex];
    if (!currentEffect) return { handled: true, game: g };

    const resolvedEffect = {
      ...currentEffect,
      resolvedAmount: rolledAmount,
      rolledDice: da.final,
    };
    const nextResults = [...(awaiting.results || []), resolvedEffect];
    const hasMoreRolls = awaiting.currentIndex + 1 < (awaiting.effects?.length || 0);

    return {
      handled: true,
      game: {
        ...g,
        eventState: {
          ...g.eventState,
          summary: appendEventSummary(
            g.eventState.summary,
            `${g.players[g.currentPlayerIndex].name} rolls ${rolledAmount} for ${currentEffect.damageType} damage.`
          ),
          awaiting: hasMoreRolls
            ? {
                ...awaiting,
                type: "event-damage-sequence-ready",
                currentIndex: awaiting.currentIndex + 1,
                results: nextResults,
              }
            : {
                ...awaiting,
                type: "event-damage-sequence-complete",
                results: nextResults,
              },
        },
        message: hasMoreRolls
          ? `${g.eventState.card.name}: rolling next damage die.`
          : `${g.eventState.card.name}: damage rolls resolved.`,
      },
    };
  }

  if (da.purpose === "event-trait-sequence-roll") {
    const awaiting = g.eventState?.awaiting;
    if (!g.eventState || awaiting?.type !== "trait-roll-sequence-rolling") {
      return { handled: true, game: g };
    }

    const currentStat = awaiting.stats?.[awaiting.currentIndex];
    if (!currentStat) return { handled: true, game: g };

    const failed = da.total <= 1;
    const nextPlayers = failed ? applyStatChange(g.players, g.currentPlayerIndex, currentStat, -1) : g.players;
    const nextResults = [
      ...(awaiting.results || []),
      {
        stat: currentStat,
        dice: da.final,
        total: da.total,
        modifier: da.modifier || null,
        failed,
      },
    ];
    const hasMoreRolls = awaiting.currentIndex + 1 < (awaiting.stats?.length || 0);

    return {
      handled: true,
      game: {
        ...g,
        players: nextPlayers,
        eventState: {
          ...g.eventState,
          awaiting: hasMoreRolls
            ? {
                ...awaiting,
                currentIndex: awaiting.currentIndex + 1,
                results: nextResults,
              }
            : {
                ...awaiting,
                type: "trait-roll-sequence-complete",
                results: nextResults,
              },
        },
        message: hasMoreRolls
          ? `${g.eventState.card.name}: rolling next trait.`
          : `${g.eventState.card.name}: trait sequence complete.`,
      },
    };
  }

  return { handled: false, game: g };
}
