import { appendEventSummary, describeTokenPlacementLocation, getDiscoveredTileOptions } from "./eventUtils";

function matchesEventCondition(condition, g, eventState) {
  if (!condition) return true;

  if (condition.anyOf) {
    return condition.anyOf.some((entry) => matchesEventCondition(entry, g, eventState));
  }

  if (condition.choice) {
    return eventState.context.choices?.[condition.choice.step] === condition.choice.equals;
  }

  if (condition.hauntStarted !== undefined) {
    return g.hauntTriggered === condition.hauntStarted;
  }

  if (condition.currentFloor) {
    return g.players[g.currentPlayerIndex].floor === condition.currentFloor;
  }

  if (condition.discovered) {
    return Object.values(g.board).some((tiles) => tiles.some((tile) => tile.id === condition.discovered));
  }

  if (condition.notDiscovered) {
    return !Object.values(g.board).some((tiles) => tiles.some((tile) => tile.id === condition.notDiscovered));
  }

  if (condition.discoveredAny) {
    return condition.discoveredAny.some((id) =>
      Object.values(g.board).some((tiles) => tiles.some((tile) => tile.id === id))
    );
  }

  return true;
}

function matchesRollCondition(rollCondition, total) {
  if (!rollCondition) return true;
  if (rollCondition.exact !== undefined) return total === rollCondition.exact;
  if (rollCondition.min !== undefined && total < rollCondition.min) return false;
  if (rollCondition.max !== undefined && total > rollCondition.max) return false;
  return true;
}

export function getMatchingOutcome(outcomes, total) {
  return outcomes.find((outcome) => matchesRollCondition(outcome.when?.roll, total)) || null;
}

export function finalizeEventState(g, message) {
  return {
    game: {
      ...g,
      eventState: null,
      turnPhase: g.drawnCard ? "card" : "endTurn",
      message,
    },
  };
}

export function applyResolvedEventEffect(g, effect, selectedValue = null, deps) {
  const {
    DIR,
    getTileAtPosition,
    applyStatChange,
    PLAYER_STAT_ORDER,
    createDrawnItemCard,
    rollDice,
    resolveDamageEffect,
    createDamageChoice,
  } = deps;

  function applyEventStatChange(players, playerIndex, statEffect, chosenStat = null) {
    const targetStat = statEffect.stat === "chosen" ? chosenStat : statEffect.stat;
    if (!targetStat) return players;

    if (targetStat === "all") {
      return PLAYER_STAT_ORDER.reduce((updatedPlayers, stat) => {
        const delta = statEffect.mode === "lose" ? -(statEffect.amount || 0) : statEffect.amount || 0;
        return statEffect.mode === "heal"
          ? updatedPlayers.map((player, index) => {
              if (index !== playerIndex) return player;
              const nextIndex = Math.max(player.statIndex[stat], player.character.startIndex[stat]);
              const statIndex = { ...player.statIndex, [stat]: nextIndex };
              const isAlive = Object.values(statIndex).every((value) => value > 0);
              return { ...player, statIndex, isAlive };
            })
          : applyStatChange(updatedPlayers, playerIndex, stat, delta);
      }, players);
    }

    if (statEffect.mode === "heal") {
      return players.map((player, index) => {
        if (index !== playerIndex) return player;
        const healedIndex = Math.max(player.statIndex[targetStat], player.character.startIndex[targetStat]);
        const statIndex = { ...player.statIndex, [targetStat]: healedIndex };
        const isAlive = Object.values(statIndex).every((value) => value > 0);
        return { ...player, statIndex, isAlive };
      });
    }

    const delta = statEffect.mode === "lose" ? -(statEffect.amount || 0) : statEffect.amount || 0;
    return applyStatChange(players, playerIndex, targetStat, delta);
  }

  const player = g.players[g.currentPlayerIndex];
  const eventState = g.eventState;
  const chosenStat = selectedValue || eventState?.context?.selectedStats?.[effect.stepKey] || null;

  if (effect.type === "grant-bonus") {
    return {
      game: {
        ...g,
        eventState: {
          ...eventState,
          summary: appendEventSummary(eventState.summary, "A blessing now empowers trait rolls on this tile."),
        },
      },
    };
  }

  if (effect.type === "stat-choice") {
    if (effect.mode === "gain") {
      return {
        game: {
          ...g,
          damageChoice: {
            source: "event-stat-choice",
            effect,
            originalDamageType: "general",
            damageType: "general",
            adjustmentMode: "increase",
            amount: effect.amount || 1,
            allowedStats: [...(effect.options || [])],
            allocation: Object.fromEntries((effect.options || []).map((stat) => [stat, 0])),
            playerName: player.name,
            canConvertToGeneral: false,
            conversionSourceNames: [],
            postDamageEffects: [],
          },
          eventState: {
            ...eventState,
            awaiting: null,
          },
          turnPhase: "event",
        },
      };
    }

    return {
      game: {
        ...g,
        eventState: {
          ...eventState,
          awaiting: {
            type: "stat-choice",
            prompt: "Choose a trait.",
            options: effect.options,
            effect,
          },
        },
      },
    };
  }

  if (effect.type === "discard-item" || effect.type === "bury-item") {
    const matchingItems = player.inventory
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => {
        if (effect.filter === "non-weapon-item") return !card.isWeapon;
        return true;
      });

    if (matchingItems.length === 0) {
      return { game: g };
    }

    if (matchingItems.length === 1) {
      const [{ index }] = matchingItems;
      return {
        game: {
          ...g,
          players: g.players.map((current, currentIndex) =>
            currentIndex === g.currentPlayerIndex
              ? { ...current, inventory: current.inventory.filter((_, cardIndex) => cardIndex !== index) }
              : current
          ),
        },
      };
    }

    return {
      game: {
        ...g,
        eventState: {
          ...eventState,
          awaiting: {
            type: "item-choice",
            prompt: effect.type === "bury-item" ? "Choose an Item to bury." : "Choose an Item to discard.",
            options: matchingItems.map(({ card, index }) => ({ label: card.name, value: index })),
            effect,
          },
        },
      },
    };
  }

  if (effect.type === "move") {
    const options = getDiscoveredTileOptions(g.board, player, effect.destination, null, DIR, getTileAtPosition);
    if (options.length === 0) {
      return {
        game: {
          ...g,
          eventState: {
            ...eventState,
            summary: appendEventSummary(eventState.summary, "No valid destination is available."),
          },
        },
      };
    }

    if (options.length === 1) {
      const [{ tile, floor }] = options;
      return {
        game: {
          ...g,
          players: g.players.map((current, currentIndex) =>
            currentIndex === g.currentPlayerIndex ? { ...current, x: tile.x, y: tile.y, floor } : current
          ),
          movePath: [{ x: tile.x, y: tile.y, floor, cost: 0 }],
        },
        cameraFloor: floor,
      };
    }

    return {
      game: {
        ...g,
        eventState: {
          ...eventState,
          awaiting: {
            type: "tile-choice",
            prompt: "Choose a tile.",
            effect,
            selectedOptionId: null,
            options: options.map(({ tile, floor }) => ({
              id: `${tile.id}-${floor}-${tile.x}-${tile.y}`,
              floor,
              x: tile.x,
              y: tile.y,
              label: tile.name,
              tileId: tile.id,
            })),
          },
        },
      },
    };
  }

  if (effect.type === "place-token") {
    const placeTokenOnTile = (board, floor, x, y) => ({
      ...board,
      [floor]: board[floor].map((tile) =>
        tile.x === x && tile.y === y
          ? {
              ...tile,
              obstacle: effect.token === "obstacle" ? true : tile.obstacle,
              tokens:
                effect.token === "obstacle" ? tile.tokens || [] : [...(tile.tokens || []), { type: effect.token }],
            }
          : tile
      ),
    });

    const options = getDiscoveredTileOptions(g.board, player, effect.location, effect.token, DIR, getTileAtPosition);
    if (options.length === 0) {
      return { game: g };
    }

    if (options.length === 1) {
      const [{ tile, floor }] = options;
      return {
        game: {
          ...g,
          board: placeTokenOnTile(g.board, floor, tile.x, tile.y),
        },
      };
    }

    return {
      game: {
        ...g,
        eventState: {
          ...eventState,
          awaiting: {
            type: "tile-choice",
            prompt: `Choose where to place the ${effect.token.replace(/-/g, " ")} token ${describeTokenPlacementLocation(effect.location)}.`,
            effect,
            selectedOptionId: null,
            options: options.map(({ tile, floor }) => ({
              id: `${tile.id}-${floor}-${tile.x}-${tile.y}`,
              floor,
              x: tile.x,
              y: tile.y,
              label: tile.name,
              tileId: tile.id,
            })),
          },
        },
      },
    };
  }

  if (effect.type === "stat-change") {
    const nextPlayers = applyEventStatChange(g.players, g.currentPlayerIndex, effect, chosenStat);
    return { game: { ...g, players: nextPlayers } };
  }

  if (effect.type === "draw-card") {
    if (effect.deck !== "item") return { game: g };
    const nextDeck = [...g.itemDeck];
    const nextItem = nextDeck.shift();
    return finalizeEventState(
      {
        ...g,
        itemDeck: nextDeck,
        drawnCard: nextItem ? createDrawnItemCard(nextItem) : null,
      },
      nextItem
        ? `${player.name} draws ${nextItem.name}.`
        : `${player.name} tried to draw an Item card, but the deck is empty.`
    );
  }

  if (effect.type === "damage") {
    if (effect.amountType === "dice" && effect.resolvedAmount === undefined) {
      return {
        game: {
          ...g,
          eventState: {
            ...eventState,
            awaiting: {
              type: "event-damage-roll-ready",
              effect,
            },
          },
          turnPhase: "event",
        },
      };
    }

    const rolledDamage =
      effect.resolvedAmount ??
      (effect.amountType === "dice" ? rollDice(effect.dice || 1).reduce((sum, die) => sum + die, 0) : null);
    const effectAmount = rolledDamage ?? effect.amount ?? 0;
    const resolved = resolveDamageEffect(player, {
      type: "event-damage",
      damageType: effect.damageType,
      damage: effectAmount,
    });

    if (resolved.damage <= 0) {
      return {
        game: {
          ...g,
          eventState: {
            ...eventState,
            summary: appendEventSummary(eventState.summary, `${player.name} blocks all damage.`),
          },
        },
      };
    }

    return {
      game: {
        ...g,
        damageChoice: {
          ...createDamageChoice(resolved, player),
          source: "event-effect",
        },
        eventState: {
          ...eventState,
          summary: appendEventSummary(
            eventState.summary,
            rolledDamage !== null
              ? `${player.name} rolls ${rolledDamage} for ${effect.damageType} damage.`
              : `${player.name} takes ${resolved.damage} ${effect.damageType} damage.`
          ),
        },
        turnPhase: "event",
      },
    };
  }

  if (effect.type === "start-haunt") {
    return {
      game: {
        ...g,
        hauntTriggered: true,
        eventState: {
          ...eventState,
          summary: appendEventSummary(
            eventState.summary,
            `The haunt begins. Use haunt ${effect.hauntNumber} from ${effect.book.replace(/-/g, " ")}.`
          ),
        },
      },
    };
  }

  return { game: g };
}

export function advanceEventResolution(g, deps) {
  const { getEventRollButtonLabel, STAT_LABELS } = deps;

  let nextGame = g;
  let eventState = g.eventState;

  if (!eventState) return { game: g };

  if (
    eventState.summary &&
    !eventState.awaiting &&
    (!eventState.pendingEffects || eventState.pendingEffects.length === 0)
  ) {
    return { game: nextGame };
  }

  while (eventState) {
    if (eventState.pendingEffects?.length > 0) {
      const sequenceEffects = [];
      let queuedRemainingEffects = [...eventState.pendingEffects];
      while (
        queuedRemainingEffects[0]?.type === "damage" &&
        queuedRemainingEffects[0]?.amountType === "dice" &&
        queuedRemainingEffects[0]?.resolvedAmount === undefined
      ) {
        sequenceEffects.push(queuedRemainingEffects.shift());
      }

      if (sequenceEffects.length > 0) {
        nextGame = {
          ...nextGame,
          eventState: {
            ...eventState,
            pendingEffects: queuedRemainingEffects,
            awaiting: {
              type: "event-damage-sequence-ready",
              effects: sequenceEffects,
              currentIndex: 0,
              results: [],
            },
          },
        };
        return { game: nextGame };
      }

      const [currentEffect, ...remainingEffects] = eventState.pendingEffects;
      nextGame = {
        ...nextGame,
        eventState: {
          ...eventState,
          pendingEffects: remainingEffects,
        },
      };
      const effectResult = applyResolvedEventEffect(nextGame, currentEffect, null, deps);
      nextGame = effectResult.game;
      eventState = nextGame.eventState;

      if (effectResult.cameraFloor) {
        const nextEventState = nextGame.eventState;
        const eventSteps = nextEventState?.card?.steps || [];
        const isEventInertAfterMove =
          !!nextEventState &&
          !nextEventState.awaiting &&
          (!nextEventState.pendingEffects || nextEventState.pendingEffects.length === 0) &&
          (nextEventState.stepIndex || 0) >= eventSteps.length;

        if (isEventInertAfterMove) {
          const finalized = finalizeEventState(
            nextGame,
            nextEventState.summary || `${nextEventState.card.name} resolved.`
          );
          return { game: finalized.game, cameraFloor: effectResult.cameraFloor };
        }

        return { game: nextGame, cameraFloor: effectResult.cameraFloor };
      }

      if (nextGame.drawnCard || nextGame.damageChoice || eventState?.awaiting) {
        return { game: nextGame };
      }

      continue;
    }

    const steps = eventState.card.steps || [];
    let stepIndex = eventState.stepIndex;
    while (stepIndex < steps.length) {
      const step = steps[stepIndex];
      if (matchesEventCondition(step.onlyIf || step.when, nextGame, eventState)) {
        break;
      }
      stepIndex += 1;
    }

    if (stepIndex >= steps.length) {
      return finalizeEventState(nextGame, eventState.summary || `${eventState.card.name} resolved.`);
    }

    const step = steps[stepIndex];
    const player = nextGame.players[nextGame.currentPlayerIndex];
    const nextEventStateBase = {
      ...eventState,
      stepIndex: stepIndex + 1,
      awaiting: null,
    };

    if (step.kind === "choice") {
      return {
        game: {
          ...nextGame,
          eventState: {
            ...nextEventStateBase,
            awaiting: {
              type: "choice",
              prompt: step.prompt,
              options: step.options,
              stepId: step.id,
            },
          },
        },
      };
    }

    if (step.kind === "effect") {
      nextGame = {
        ...nextGame,
        eventState: {
          ...nextEventStateBase,
          pendingEffects: [...(step.effects || [])],
        },
      };
      eventState = nextGame.eventState;
      continue;
    }

    if (step.kind === "trait-roll") {
      const stepKey = step.id || `${eventState.card.id}-${stepIndex}`;
      const selectedStat = step.stat || eventState.context.selectedStats?.[stepKey];
      if (!selectedStat && step.chooseFrom?.length) {
        return {
          game: {
            ...nextGame,
            eventState: {
              ...nextEventStateBase,
              awaiting: {
                type: "step-stat-choice",
                prompt: "Choose a trait to roll.",
                options: step.chooseFrom,
                stepKey,
              },
            },
          },
        };
      }

      const stat = selectedStat || step.stat;
      const baseDiceCount = player.character[stat][player.statIndex[stat]];
      return {
        game: {
          ...nextGame,
          eventState: {
            ...nextEventStateBase,
            awaiting: {
              type: "roll-ready",
              prompt: `${getEventRollButtonLabel(baseDiceCount)} for ${STAT_LABELS[stat]}.`,
              rollKind: "trait-roll",
              rollStat: stat,
              baseDiceCount,
              usePassives: step.usePassives !== false,
              stepKey,
              outcomes: (step.outcomes || []).map((outcome) => ({
                ...outcome,
                effects: [...(outcome.effects || [])].map((effect) => ({ ...effect, stepKey })),
              })),
            },
          },
        },
      };
    }

    if (step.kind === "dice-roll" || step.kind === "haunt-roll") {
      const diceCount = step.kind === "haunt-roll" ? nextGame.omenCount : step.dice || 0;
      return {
        game: {
          ...nextGame,
          eventState: {
            ...nextEventStateBase,
            awaiting: {
              type: "roll-ready",
              prompt: getEventRollButtonLabel(diceCount),
              rollKind: step.kind,
              label: step.kind === "haunt-roll" ? "Haunt" : `${diceCount} dice`,
              baseDiceCount: diceCount,
              outcomes: [...(step.outcomes || [])],
            },
          },
        },
      };
    }

    if (step.kind === "trait-roll-sequence") {
      return {
        game: {
          ...nextGame,
          eventState: {
            ...nextEventStateBase,
            awaiting: {
              type: "trait-roll-sequence-ready",
              prompt: "Roll each trait, one at a time.",
              stats: [...(step.stats || [])],
              outcomes: [...(step.outcomes || [])],
              currentIndex: 0,
              results: [],
            },
          },
        },
      };
    }

    nextGame = {
      ...nextGame,
      eventState: nextEventStateBase,
    };
    eventState = nextGame.eventState;
  }

  return { game: nextGame };
}
