import { useEffect } from "react";
import {
  adjustEventRollTotalState,
  confirmEventTileChoiceState,
  continueEventState,
  eventAwaitingChoiceState,
  eventTileChoiceState,
  resolveRollReadyAwaiting,
  resolveTraitRoll,
  rollDice,
  startEventFromDrawnCardState,
} from "./eventActions";
import { advanceEventResolution, applyResolvedEventEffect, finalizeEventState } from "./eventEngine";
import { dismissHauntRollState, selectTriggeredHauntDefinition } from "../haunts/hauntDomain";

function isEventStateInert(eventState) {
  if (!eventState) return false;
  if (eventState.awaiting || eventState.summary || eventState.lastRoll) return false;
  return (eventState.pendingEffects || []).length === 0;
}

function beginEventDamageRoll(game, rollDiceFn) {
  const awaiting = game.eventState?.awaiting;
  if (!awaiting || awaiting.type !== "event-damage-roll-ready") return null;

  const diceCount = awaiting.effect?.dice || 1;
  const final = rollDiceFn(diceCount);

  return {
    game: {
      ...game,
      eventState: {
        ...game.eventState,
        awaiting: {
          ...game.eventState.awaiting,
          type: "event-damage-rolling",
        },
      },
    },
    animation: {
      purpose: "event-damage-roll",
      final,
      display: Array.from({ length: diceCount }, () => Math.floor(Math.random() * 3)),
      settled: false,
      effect: awaiting.effect,
      label: `${diceCount} damage die${diceCount === 1 ? "" : "s"}`,
      modifier: null,
    },
  };
}

function beginEventDamageSequenceRoll(game, rollDiceFn) {
  const awaiting = game.eventState?.awaiting;
  if (!awaiting || awaiting.type !== "event-damage-sequence-ready") return null;

  const effect = awaiting.effects?.[awaiting.currentIndex];
  if (!effect) return null;

  const diceCount = effect.dice || 1;
  const final = rollDiceFn(diceCount);

  return {
    game: {
      ...game,
      eventState: {
        ...game.eventState,
        awaiting: {
          ...game.eventState.awaiting,
          type: "event-damage-sequence-rolling",
        },
      },
    },
    animation: {
      purpose: "event-damage-sequence",
      final,
      display: Array.from({ length: diceCount }, () => Math.floor(Math.random() * 3)),
      settled: false,
      effect,
      label: `${diceCount} damage die${diceCount === 1 ? "" : "s"}`,
      modifier: null,
    },
  };
}

function applyTraitRollSequenceOverride(game) {
  const awaiting = game.eventState?.awaiting;
  if (!awaiting || awaiting.type !== "trait-roll-sequence-rolling") return null;

  const shouldUseOverride =
    awaiting.overrideTotal !== undefined &&
    awaiting.overrideTotal !== null &&
    awaiting.currentIndex === 0 &&
    (awaiting.results?.length || 0) === 0;
  if (!shouldUseOverride) return null;

  const forcedTotal = Math.max(0, Math.min(8, awaiting.overrideTotal));
  const currentStat = awaiting.stats?.[0];
  if (!currentStat) return null;

  const failed = forcedTotal <= 1;
  const nextResults = [
    ...(awaiting.results || []),
    {
      stat: currentStat,
      dice: [forcedTotal],
      total: forcedTotal,
      modifier: null,
      failed,
    },
  ];
  const hasMoreRolls = 1 < (awaiting.stats?.length || 0);

  return {
    game: {
      ...game,
      eventState: {
        ...game.eventState,
        awaiting: hasMoreRolls
          ? {
              ...awaiting,
              currentIndex: 1,
              results: nextResults,
              overrideTotal: undefined,
            }
          : {
              ...awaiting,
              type: "trait-roll-sequence-complete",
              results: nextResults,
              overrideTotal: undefined,
            },
      },
      message: hasMoreRolls
        ? `${game.eventState.card.name}: rolling next trait.`
        : `${game.eventState.card.name}: trait sequence complete.`,
    },
  };
}

export function useEventRuntimeEffects({
  game,
  diceAnimation,
  setGame,
  setDiceAnimation,
  eventFlowDeps,
  applyStatChange,
}) {
  // Guard against edge cases where event state is "rolling" but the event-roll
  // animation is missing; restart the roll animation so the flow can continue.
  useEffect(() => {
    const awaiting = game.eventState?.awaiting;
    if (!awaiting || awaiting.type !== "rolling") return;
    if (diceAnimation) return;
    if (awaiting.rollKind !== "trait-roll" && awaiting.rollKind !== "dice-roll" && awaiting.rollKind !== "haunt-roll") {
      return;
    }

    const rollReady = resolveRollReadyAwaiting(game, { ...awaiting, type: "roll-ready" }, eventFlowDeps);
    if (rollReady.animation) {
      setGame(rollReady.game);
      setDiceAnimation(rollReady.animation);
    }
  }, [game, game.eventState?.awaiting, diceAnimation, eventFlowDeps, setDiceAnimation, setGame]);

  useEffect(() => {
    const awaiting = game.eventState?.awaiting;
    if (!awaiting || awaiting.type !== "event-damage-roll-ready") return;
    if (diceAnimation) return;

    const result = beginEventDamageRoll(game, rollDice);
    if (!result) return;

    setGame(result.game);
    setDiceAnimation(result.animation);
  }, [game, game.eventState?.awaiting, diceAnimation, setDiceAnimation, setGame]);

  useEffect(() => {
    const awaiting = game.eventState?.awaiting;
    if (!awaiting || awaiting.type !== "event-damage-sequence-ready") return;
    if (diceAnimation) return;

    const result = beginEventDamageSequenceRoll(game, rollDice);
    if (!result) return;

    setGame(result.game);
    setDiceAnimation(result.animation);
  }, [game, game.eventState?.awaiting, diceAnimation, setDiceAnimation, setGame]);

  useEffect(() => {
    const awaiting = game.eventState?.awaiting;
    if (!awaiting || awaiting.type !== "trait-roll-sequence-rolling") return;
    if (diceAnimation) return;

    let overrideApplied = false;
    setGame((g) => {
      const result = applyTraitRollSequenceOverride(g);
      if (!result) return g;
      overrideApplied = true;
      return result.game;
    });
    if (overrideApplied) {
      return;
    }

    const stat = awaiting.stats?.[awaiting.currentIndex];
    if (!stat) return;

    const player = game.players[game.currentPlayerIndex];
    const baseDiceCount = player.character[stat][player.statIndex[stat]];
    const roll = resolveTraitRoll(player, {
      stat,
      baseDiceCount,
      context: "event",
      board: game.board,
    });

    setDiceAnimation({
      purpose: "event-trait-sequence-roll",
      final: roll.dice,
      display: Array.from({ length: roll.dice.length }, () => Math.floor(Math.random() * 3)),
      settled: false,
      total: roll.total,
      stat,
      modifier: roll.modifier,
    });
  }, [
    game,
    game.eventState?.awaiting,
    diceAnimation,
    game.board,
    game.currentPlayerIndex,
    game.players,
    applyStatChange,
    setDiceAnimation,
    setGame,
  ]);

  // Auto-close event modal when an event reaches an inert state with nothing left to resolve.
  useEffect(() => {
    const eventState = game.eventState;
    if (!isEventStateInert(eventState)) return;

    setGame((g) => {
      const currentEventState = g.eventState;
      if (!isEventStateInert(currentEventState)) return g;

      return finalizeEventState(g, g.message || `${currentEventState.card.name} resolved.`).game;
    });
  }, [game.eventState, game.message, setGame]);
}

export function useEventActionHandlers({
  setGame,
  setCameraFloor,
  setDiceAnimation,
  eventEngineDeps,
  eventFlowDeps,
  getTileAtPosition,
  getMatchingOutcome,
  describeEventEffects,
  resolveRollReadyAwaiting,
}) {
  const advanceEvent = (nextGame) => advanceEventResolution(nextGame, eventEngineDeps);
  const applyResolvedEvent = (nextGame, effect, selectedValue = null) =>
    applyResolvedEventEffect(nextGame, effect, selectedValue, eventEngineDeps);

  function handleContinueEvent() {
    setDiceAnimation(null);
    let nextCameraFloor = null;
    setGame((g) => {
      const result = continueEventState(g, {
        runAdvanceEventResolution: advanceEvent,
        finalizeEventState,
      });
      nextCameraFloor = result.cameraFloor;
      return result.game;
    });
    if (nextCameraFloor) {
      setCameraFloor(nextCameraFloor);
    }
  }

  function handleAdjustEventRollTotal(delta) {
    setGame((g) =>
      adjustEventRollTotalState(g, delta, {
        getMatchingOutcome,
        describeEventEffects,
      })
    );
  }

  function handleEventAwaitingChoice(value) {
    let nextCameraFloor = null;
    let nextDiceAnimation = null;
    setGame((g) => {
      const result = eventAwaitingChoiceState(g, value, {
        runAdvanceEventResolution: advanceEvent,
        runApplyResolvedEventEffect: applyResolvedEvent,
        resolveRollReadyAwaiting,
        eventFlowDeps,
      });
      nextCameraFloor = result.cameraFloor;
      nextDiceAnimation = result.diceAnimation;
      return result.game;
    });
    if (nextCameraFloor) {
      setCameraFloor(nextCameraFloor);
    }
    if (nextDiceAnimation) {
      setDiceAnimation(nextDiceAnimation);
    }
  }

  function handleEventTileChoice(option) {
    let nextCameraFloor = null;
    setGame((g) => {
      const result = eventTileChoiceState(g, option, {
        getTileAtPosition,
      });
      nextCameraFloor = result.cameraFloor;
      return result.game;
    });
    if (nextCameraFloor) {
      setCameraFloor(nextCameraFloor);
    }
  }

  function handleConfirmEventTileChoice() {
    let nextCameraFloor = null;
    setGame((g) => {
      const result = confirmEventTileChoiceState(g, {
        getTileAtPosition,
        runAdvanceEventResolution: advanceEvent,
      });
      nextCameraFloor = result.cameraFloor;
      return result.game;
    });
    if (nextCameraFloor) {
      setCameraFloor(nextCameraFloor);
    }
  }

  return {
    runAdvanceEventResolution: advanceEvent,
    runApplyResolvedEventEffect: applyResolvedEvent,
    handleContinueEvent,
    handleAdjustEventRollTotal,
    handleEventAwaitingChoice,
    handleEventTileChoice,
    handleConfirmEventTileChoice,
  };
}

export function useDrawnCardHandlers({
  game,
  setGame,
  setCameraFloor,
  setDiceAnimation,
  setQueuedTraitRollOverride,
  getQueuedTraitRollOverride,
  rollDice,
  runAdvanceEventResolution,
  resolveRollReadyAwaiting,
  eventFlowDeps,
}) {
  function handleDismissCard(options = {}) {
    const { autoRollIfReady = false, initialEventChoice = null } = options;
    const card = game.drawnCard;

    if (card?.type === "omen") {
      const numDice = game.omenCount;
      const finalDice = rollDice(numDice);
      const updatedPlayers = game.players.map((pl, i) =>
        i === game.currentPlayerIndex ? { ...pl, omens: [...pl.omens, card] } : pl
      );

      setGame({
        ...game,
        players: updatedPlayers,
        drawnCard: null,
        message: "Rolling for haunt...",
      });
      setDiceAnimation({
        purpose: "haunt",
        final: finalDice,
        display: Array.from({ length: numDice }, () => Math.floor(Math.random() * 3)),
        omenCount: game.omenCount,
        settled: false,
      });
      return;
    }

    if (card?.type === "event") {
      const queuedTraitRollOverride = getQueuedTraitRollOverride?.() ?? null;
      const eventResult = startEventFromDrawnCardState(
        game,
        {
          card,
          initialEventChoice,
          autoRollIfReady,
          queuedTraitRollOverride,
        },
        {
          runAdvanceEventResolution,
          resolveRollReadyAwaiting,
          eventFlowDeps,
        }
      );

      setGame(eventResult.game);
      if (eventResult.cameraFloor) {
        setCameraFloor(eventResult.cameraFloor);
      }
      if (eventResult.diceAnimation) {
        setDiceAnimation(eventResult.diceAnimation);
      }
      if (eventResult.shouldClearQueuedTraitRollOverride) {
        setQueuedTraitRollOverride(null);
      }
      return;
    }

    if (card?.type === "item") {
      const updatedPlayers = game.players.map((pl, i) =>
        i === game.currentPlayerIndex ? { ...pl, inventory: [...pl.inventory, card] } : pl
      );

      setGame({
        ...game,
        players: updatedPlayers,
        drawnCard: null,
        turnPhase: "endTurn",
        message: `${game.players[game.currentPlayerIndex].name} collected ${card.name}!`,
      });
      return;
    }

    setGame({
      ...game,
      drawnCard: null,
      turnPhase: "endTurn",
      message: "",
    });
  }

  function handleDismissHauntRoll() {
    setDiceAnimation(null);
    setGame((g) =>
      dismissHauntRollState(g, {
        selectHauntDefinition: selectTriggeredHauntDefinition,
      })
    );
  }

  return {
    handleDismissCard,
    handleDismissHauntRoll,
  };
}
