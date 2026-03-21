import { useState, useRef, useEffect } from "react";
import { STARTING_TILES, createTileStack } from "./tiles";
import { createEventDeck, createItemDeck, createOmenDeck } from "./cards";
import "./GameBoard.css";

// Direction offsets
const DIR = {
  N: { dx: 0, dy: -1 },
  S: { dx: 0, dy: 1 },
  E: { dx: 1, dy: 0 },
  W: { dx: -1, dy: 0 },
};

const OPPOSITE = { N: "S", S: "N", E: "W", W: "E" };

const DAMAGE_STATS = {
  physical: ["might", "speed"],
  mental: ["sanity", "knowledge"],
  general: ["might", "speed", "sanity", "knowledge"],
};

const STAT_LABELS = {
  might: "Might",
  speed: "Speed",
  sanity: "Sanity",
  knowledge: "Knowledge",
};

const STAT_ICONS = {
  might: "💪",
  speed: "🏃",
  sanity: "🧠",
  knowledge: "📖",
};

const PLAYER_STAT_ORDER = ["might", "speed", "sanity", "knowledge"];

const TILE_SIZE = 100;
const GAP = 4;

// Roll n dice (each die: 0, 1, or 2 with equal probability)
function rollDice(n) {
  const results = [];
  for (let i = 0; i < n; i++) {
    results.push(Math.floor(Math.random() * 3));
  }
  return results;
}

function formatSourceNames(names) {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function getTileAtPosition(board, x, y, floor) {
  return board?.[floor]?.find((tile) => tile.x === x && tile.y === y) || null;
}

function getBoardTraitRollDiceBonus(board, player) {
  const tile = getTileAtPosition(board, player?.x, player?.y, player?.floor);
  const blessingCount = tile?.tokens?.filter((token) => token.type === "blessing").length || 0;

  return {
    amount: blessingCount,
    sourceNames: blessingCount > 0 ? Array.from({ length: blessingCount }, () => "Blessing") : [],
  };
}

function getPassiveEffects(player) {
  const ownedCards = [...(player?.omens ?? []), ...(player?.inventory ?? [])];

  return ownedCards.flatMap((card) =>
    (card.passiveEffects ?? []).map((effect) => ({
      ...effect,
      sourceName: card.name,
    }))
  );
}

function getTraitRollBonus(player, stat) {
  const matchingEffects = getPassiveEffects(player).filter(
    (effect) => effect.type === "trait-roll-bonus" && effect.stat === stat
  );

  return {
    amount: matchingEffects.reduce((sum, effect) => sum + (effect.amount || 0), 0),
    sourceNames: matchingEffects.map((effect) => effect.sourceName),
  };
}

function getDamageReduction(player, damageType) {
  const matchingEffects = getPassiveEffects(player).filter(
    (effect) => effect.type === "damage-reduction" && effect.damageTypes?.includes(damageType)
  );

  return {
    amount: matchingEffects.reduce((sum, effect) => sum + (effect.amount || 0), 0),
    sourceNames: matchingEffects.map((effect) => effect.sourceName),
  };
}

function getTraitRollDiceBonus(player, context) {
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

function getDamageConversionOptions(player, damageType) {
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

function createTraitRollModifier(traitBonus, diceBonus) {
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

function resolveTraitRoll(player, { stat, baseDiceCount, context, board = null, usePassives = true }) {
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

function resolveDamageEffect(player, effect) {
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

function describePostDamageEffects(effects) {
  if (!effects || effects.length === 0) return "";

  return effects
    .map((effect) => `gain ${effect.amount} ${STAT_LABELS[effect.stat]} from ${effect.sourceName}`)
    .join(" and ");
}

function getEventRollButtonLabel(diceCount) {
  return diceCount === 1 ? "Roll Die" : "Roll Dice";
}

function describeTokenPlacementLocation(location) {
  switch (location) {
    case "current-tile":
      return "on your current tile";
    case "adjacent-tile":
      return "on an adjacent tile";
    case "any-other-tile":
      return "on any other discovered tile";
    case "any-ground-floor-tile":
      return "on any Ground Floor tile";
    case "any-basement-tile":
      return "on any Basement tile";
    case "any-basement-or-ground-floor-tile":
      return "on any Basement or Ground Floor tile";
    case "any-upper-or-ground-floor-tile":
      return "on any Upper or Ground Floor tile";
    case "any-tile":
      return "on any discovered tile";
    default:
      return "on a valid tile";
  }
}

function describeMoveDestination(destination) {
  switch (destination) {
    case "adjacent-tile":
      return "an adjacent tile";
    case "any-tile-in-current-region":
      return "any tile in your current region";
    case "any-tile-in-different-region":
      return "any tile in a different region";
    case "any-ground-floor-tile":
      return "any Ground Floor tile";
    case "any-basement-tile":
      return "any Basement tile";
    case "any-basement-or-ground-floor-tile":
      return "any Basement or Ground Floor tile";
    case "any-upper-or-ground-floor-tile":
      return "any Upper or Ground Floor tile";
    case "any-tile":
      return "any discovered tile";
    case "entrance-hall":
      return "the Entrance Hall";
    case "basement-landing":
      return "the Basement Landing";
    case "upper-landing":
      return "the Upper Landing";
    case "conservatory":
      return "the Conservatory";
    case "graveyard-or-catacombs":
      return "the Graveyard or Catacombs";
    default:
      return "a valid destination";
  }
}

function describeEventEffect(effect) {
  if (!effect) return "";

  if (effect.type === "damage") {
    if (effect.amountType === "dice" && effect.resolvedAmount === undefined) {
      const diceCount = effect.dice || 1;
      return `Take ${diceCount} ${diceCount === 1 ? "die" : "dice"} of ${effect.damageType} damage.`;
    }
    const amount = effect.resolvedAmount ?? effect.amount ?? 0;
    return `Take ${amount} ${effect.damageType} damage.`;
  }
  if (effect.type === "stat-change") {
    if (effect.mode === "heal") {
      return effect.stat === "chosen" ? "Heal the chosen trait." : `Heal ${STAT_LABELS[effect.stat]}.`;
    }
    const verb = effect.mode === "lose" ? "Lose" : "Gain";
    if (effect.stat === "all") return `${verb} ${effect.amount} in each trait.`;
    if (effect.stat === "chosen") return `${verb} ${effect.amount} in the chosen trait.`;
    return `${verb} ${effect.amount} ${STAT_LABELS[effect.stat]}.`;
  }
  if (effect.type === "stat-choice") {
    const optionLabels = (effect.options || []).map((option) => STAT_LABELS[option] || option);
    const optionText =
      optionLabels.length === 0
        ? "any listed trait"
        : optionLabels.length === 1
          ? optionLabels[0]
          : optionLabels.length === 2
            ? `${optionLabels[0]} or ${optionLabels[1]}`
            : `${optionLabels.slice(0, -1).join(", ")}, or ${optionLabels[optionLabels.length - 1]}`;
    return `${effect.mode === "lose" ? "Lose" : "Gain"} ${effect.amount} ${optionText}.`;
  }
  if (effect.type === "move") return `Place your explorer on ${describeMoveDestination(effect.destination)}.`;
  if (effect.type === "draw-card")
    return `Draw ${effect.amount || 1} ${effect.deck} card${(effect.amount || 1) === 1 ? "" : "s"}.`;
  if (effect.type === "place-token") {
    return `Place a ${effect.token.replace(/-/g, " ")} token ${describeTokenPlacementLocation(effect.location)}.`;
  }
  if (effect.type === "start-haunt") return `Start haunt ${effect.hauntNumber}.`;
  if (effect.type === "discard-item") return "Discard an item.";
  if (effect.type === "bury-item") return "Bury an item.";
  return "Resolve effect.";
}

function describeEventEffects(effects) {
  if (!effects || effects.length === 0) return "Nothing happens.";
  return effects
    .map((effect) => describeEventEffect(effect))
    .filter(Boolean)
    .join(" ");
}

function getDamageTypesFromAllocation(choice) {
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

function getPostDamageEffectsForChoice(player, choice) {
  const damageTypes = getDamageTypesFromAllocation(choice);
  if (damageTypes.length === 0) return [];

  return getPassiveEffects(player).filter(
    (effect) => effect.type === "stat-gain-on-damage" && effect.damageTypes?.some((type) => damageTypes.includes(type))
  );
}

function createDiceModifier({ amount, sourceNames, sign = "+", labelPrefix = "from", tone = "positive" }) {
  if (!amount || sourceNames.length === 0) return null;

  return {
    value: `${sign}${amount}`,
    label: `${labelPrefix} ${formatSourceNames(sourceNames)}`,
    tone,
  };
}

function DiceRow({ dice, modifier = null, rolling = false }) {
  return (
    <div className="dice-row">
      <div className="dice-container">
        {dice.map((d, i) => (
          <div key={i} className={rolling ? "die die-rolling" : "die"}>
            {d}
          </div>
        ))}
      </div>
      {modifier && (
        <div className={`dice-modifier dice-modifier-${modifier.tone}`}>
          <div className="dice-modifier-value">{modifier.value}</div>
          <div className="dice-modifier-label">{modifier.label}</div>
        </div>
      )}
    </div>
  );
}

function formatEventResultLines(resultText) {
  if (!resultText) return [];

  const markerRegex = /(\d+\+?:|\d+-\d+:|\d+:|Upper Floor:|Ground Floor:|Basement:)/g;
  const matches = [...resultText.matchAll(markerRegex)];

  const baseLines =
    matches.length > 1
      ? matches
          .map((match, index) => {
            const start = match.index;
            const end = index + 1 < matches.length ? matches[index + 1].index : resultText.length;
            return resultText.slice(start, end).trim();
          })
          .filter(Boolean)
      : resultText
          .split(/(?<=\.)\s+/)
          .map((line) => line.trim())
          .filter(Boolean);

  return baseLines
    .flatMap((line) => line.split(/(?<=\.)\s+(?=(?:If|Otherwise|Then)\b)/))
    .map((line) => line.trim())
    .filter(Boolean);
}

function EventCardContent({ card }) {
  const resultLines = formatEventResultLines(card.result);

  return (
    <>
      {card.todo && (
        <div className="card-ability-block">
          <div className="card-ability-label">To Do</div>
          <p className="card-description">{card.todo}</p>
        </div>
      )}
      {card.result && (
        <div className="card-special">
          <div className="card-ability-label">Result</div>
          {resultLines.map((line, index) => (
            <div key={`event-result-${card.id || card.name || "card"}-${index}`} className="card-description">
              {line}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function CardAbilityContent({ card }) {
  if (card.type === "event") {
    return <EventCardContent card={card} />;
  }

  const primaryAbility = card.passiveAbility || card.activeAbility || card.description;
  const primaryLabel = card.passiveAbility ? "Passive Ability" : card.activeAbility ? "Active Ability" : null;
  const secondaryAbility = card.passiveAbility && card.activeAbility ? card.activeAbility : card.special;
  const secondaryLabel = card.passiveAbility && card.activeAbility ? "Active Ability" : card.special ? "Special" : null;

  return (
    <>
      {primaryAbility && (
        <div className="card-ability-block">
          {primaryLabel && <div className="card-ability-label">{primaryLabel}</div>}
          <p className="card-description">{primaryAbility}</p>
        </div>
      )}
      {secondaryAbility && (
        <div className="card-special">
          {secondaryLabel && <div className="card-ability-label">{secondaryLabel}</div>}
          {secondaryAbility}
        </div>
      )}
    </>
  );
}

// Initialize game state from players
function initGameState(players) {
  const tileStack = createTileStack();
  const itemDeck = createItemDeck();
  const omenDeck = createOmenDeck();
  const eventDeck = createEventDeck();

  // Ground floor starts with 3 tiles in a vertical line:
  // Entrance Hall (0,0) — Hallway (0,-1) — Grand Staircase (0,-2)
  const entrance = { ...STARTING_TILES[0], x: 0, y: 0, floor: "ground" };
  const hallway = { ...STARTING_TILES[1], x: 0, y: -1, floor: "ground" };
  const grandStaircase = { ...STARTING_TILES[2], x: 0, y: -2, floor: "ground" };
  const upperLanding = { ...STARTING_TILES[3], x: 0, y: 0, floor: "upper" };
  const basementLanding = { ...STARTING_TILES[4], x: 0, y: 0, floor: "basement" };

  return {
    players: players.map((p, i) => {
      const speed = p.character.speed[p.character.startIndex.speed];
      return {
        ...p,
        index: i,
        x: 0,
        y: 0,
        floor: "ground",
        movesLeft: i === 0 ? speed : 0,
        statIndex: { ...p.character.startIndex },
        inventory: [],
        omens: [],
        isAlive: true,
      };
    }),
    board: {
      ground: [entrance, hallway, grandStaircase],
      upper: [upperLanding],
      basement: [basementLanding],
    },
    tileStack,
    itemDeck,
    omenDeck,
    eventDeck,
    currentPlayerIndex: 0,
    turnPhase: "move",
    movePath: [{ x: 0, y: 0, floor: "ground", cost: 0 }],
    pendingExplore: null,
    pendingSpecialPlacement: null,
    mysticElevatorReady: false,
    mysticElevatorUsed: false,
    omenCount: 0,
    hauntTriggered: false,
    drawnCard: null,
    hauntRoll: null,
    tileEffect: null,
    damageChoice: null,
    eventState: null,
    turnNumber: 1,
    message: `${players[0].name}'s turn — ${players[0].character.speed[players[0].character.startIndex.speed]} moves`,
  };
}

function createDrawnItemCard(card) {
  return {
    type: "item",
    ...card,
  };
}

function createDrawnOmenCard(card) {
  return {
    type: "omen",
    ...card,
  };
}

function createDrawnEventCard(card) {
  return {
    type: "event",
    ...card,
  };
}

export default function GameBoard({ players, onQuit }) {
  const [game, setGame] = useState(() => initGameState(players));
  const [cameraFloor, setCameraFloor] = useState("ground");
  const [diceAnimation, setDiceAnimation] = useState(null);
  const [expandedSidebarPlayers, setExpandedSidebarPlayers] = useState(() => new Set());
  const [viewedCard, setViewedCard] = useState(null);
  const [queuedAngelsFeatherTotal, setQueuedAngelsFeatherTotal] = useState(null);
  const boardRef = useRef(null);

  // Dice rolling animation
  useEffect(() => {
    if (!diceAnimation || diceAnimation.settled) return;
    const activeAnimation = diceAnimation;

    const interval = setInterval(() => {
      setDiceAnimation((prev) => {
        if (!prev || prev.settled) return prev;
        return {
          ...prev,
          display: Array.from({ length: prev.final.length }, () => Math.floor(Math.random() * 3)),
        };
      });
    }, 80);

    const timeout = setTimeout(() => {
      setDiceAnimation((prev) => {
        if (!prev) return prev;
        return { ...prev, display: prev.final, settled: true };
      });
      const da = activeAnimation;
      if (!da) return;
      const baseTotal = da.final.reduce((a, b) => a + b, 0);
      const total = baseTotal;

      if (da.purpose === "haunt") {
        const hauntTriggered = baseTotal >= 5;
        setGame((g) => ({
          ...g,
          hauntRoll: {
            dice: da.final,
            total: baseTotal,
            omenCount: da.omenCount,
            hauntTriggered,
          },
          hauntTriggered: g.hauntTriggered || hauntTriggered,
          message: hauntTriggered
            ? `THE HAUNT BEGINS! Rolled ${baseTotal} with ${da.omenCount} dice!`
            : `Safe... Rolled ${baseTotal} with ${da.omenCount} dice.`,
        }));
      } else if (da.purpose === "event-roll") {
        setGame((g) => {
          if (!g.eventState) return g;

          const matchedOutcome = getMatchingOutcome(da.outcomes || [], da.total); // FOR DEV ONLY. DELETE EVENTUALLY!

          const resolvedEffects = [...(matchedOutcome?.effects || [])];

          return {
            ...g,
            eventState: {
              ...g.eventState,
              awaiting: null,
              lastRoll: {
                label: da.label,
                dice: da.final,
                total: da.total,
                modifier: da.modifier || null,
                outcomes: [...(da.outcomes || [])], // FOR DEV ONLY. DELETE EVENTUALLY!
              },
              summary: describeEventEffects(resolvedEffects),
              pendingEffects: resolvedEffects,
            },
            message: `${g.eventState.card.name}: roll resolved.`,
          };
        });
        setDiceAnimation(null);
      } else if (da.purpose === "event-damage-roll") {
        setGame((g) => {
          if (!g.eventState) return g;

          const rolledAmount = da.final.reduce((sum, die) => sum + die, 0);
          const awaitingEffect = g.eventState.awaiting?.effect;
          const baseEffect = da.effect || awaitingEffect;
          if (!baseEffect) return g;

          const resolvedEffect = {
            ...baseEffect,
            resolvedAmount: rolledAmount,
          };

          return {
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
          };
        });
        setDiceAnimation(null);
      } else if (da.purpose === "event-damage-sequence") {
        setGame((g) => {
          const awaiting = g.eventState?.awaiting;
          if (!g.eventState || awaiting?.type !== "event-damage-sequence-rolling") return g;

          const rolledAmount = da.final.reduce((sum, die) => sum + die, 0);
          const currentEffect = awaiting.effects?.[awaiting.currentIndex];
          if (!currentEffect) return g;

          const resolvedEffect = {
            ...currentEffect,
            resolvedAmount: rolledAmount,
            rolledDice: da.final,
          };
          const nextResults = [...(awaiting.results || []), resolvedEffect];
          const hasMoreRolls = awaiting.currentIndex + 1 < (awaiting.effects?.length || 0);

          return {
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
          };
        });
        setDiceAnimation(null);
      } else if (da.purpose === "event-trait-sequence-roll") {
        setGame((g) => {
          const awaiting = g.eventState?.awaiting;
          if (!g.eventState || awaiting?.type !== "trait-roll-sequence-rolling") return g;

          const currentStat = awaiting.stats?.[awaiting.currentIndex];
          if (!currentStat) return g;

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
          };
        });
        setDiceAnimation(null);
      } else if (da.purpose === "collapsed") {
        setGame((g) => {
          const total = da.resolvedTotal ?? baseTotal;
          const collapsed = total < 5;
          const diceModifier = da.modifier || null;

          if (collapsed) {
            return {
              ...g,
              tileEffect: {
                type: "collapsed-pending",
                tileName: da.tileName,
                dice: da.final,
                diceModifier,
                total,
                message: `The floor gives way! Rolled ${total} (needed 5+). Press Roll to roll for damage.`,
              },
            };
          }

          return {
            ...g,
            tileEffect: {
              type: "collapsed",
              tileName: da.tileName,
              dice: da.final,
              diceModifier,
              total,
              collapsed: false,
              damageDice: [],
              damage: 0,
              message: `The floor holds! Rolled ${total} (needed 5+). Safe!`,
            },
          };
        });
      } else if (da.purpose === "collapsed-damage") {
        setGame((g) => {
          const player = g.players[da.playerIndex ?? g.currentPlayerIndex];
          const baseDamage = da.final[0];
          const damageReduction = getDamageReduction(player, "physical");
          const damage = Math.max(0, baseDamage - damageReduction.amount);
          const damageDiceModifier = createDiceModifier({
            amount: damageReduction.amount,
            sourceNames: damageReduction.sourceNames,
            sign: "-",
            labelPrefix: "blocked by",
          });

          return {
            ...g,
            tileEffect: {
              type: "collapsed",
              tileName: da.tileName,
              dice: da.firstDice,
              total: da.firstTotal,
              collapsed: true,
              damageType: "physical",
              damageDice: da.final,
              damageDiceModifier,
              damage,
              damageResolved: true,
              message:
                damage > 0
                  ? `The floor gives way! Rolled ${da.firstTotal} (needed 5+). Fall to Basement Landing and take ${damage} physical damage.`
                  : `The floor gives way! Rolled ${da.firstTotal} (needed 5+). Fall to Basement Landing, but the damage is reduced to 0.`,
            },
          };
        });
      } else if (da.purpose === "furnace") {
        setGame((g) => {
          const player = g.players[da.playerIndex ?? g.currentPlayerIndex];
          const baseDamage = da.final[0];
          const damageReduction = getDamageReduction(player, "physical");
          const damage = Math.max(0, baseDamage - damageReduction.amount);
          const diceModifier = createDiceModifier({
            amount: damageReduction.amount,
            sourceNames: damageReduction.sourceNames,
            sign: "-",
            labelPrefix: "blocked by",
          });

          return {
            ...g,
            tileEffect: {
              type: "furnace",
              tileName: da.tileName,
              dice: da.final,
              diceModifier,
              damageType: "physical",
              damage,
              damageResolved: true,
              message:
                damage > 0
                  ? `The furnace burns! Take ${damage} physical damage.`
                  : baseDamage > 0 && damageReduction.amount > 0
                    ? `The furnace burns, but the damage is reduced to 0.`
                    : "The furnace sputters — no damage!",
            },
          };
        });
      } else if (da.purpose === "mystic-elevator") {
        setGame((g) => {
          const player = g.players[g.currentPlayerIndex];
          const elevatorTile = g.board[player.floor]?.find((tile) => tile.x === player.x && tile.y === player.y);
          if (!elevatorTile || elevatorTile.id !== "mystic-elevator") {
            return {
              ...g,
              tileEffect: {
                type: "mystic-elevator-result",
                tileName: "Mystic Elevator",
                dice: da.final,
                total,
                message: "The Mystic Elevator shudders, but nothing happens.",
                nextTurnPhase: "move",
                nextMessage:
                  player.movesLeft > 0
                    ? `${player.name} can keep moving. ${player.movesLeft} move${player.movesLeft !== 1 ? "s" : ""} left.`
                    : `${player.name} has no moves left.`,
              },
            };
          }

          const destination = getMysticElevatorDestination(total);
          const boardWithoutElevator = {
            ...g.board,
            [player.floor]: (g.board[player.floor] || []).filter((tile) => tile !== elevatorTile),
          };
          const placements = getPlacementOptions(boardWithoutElevator, {
            ...elevatorTile,
            floors: destination.floors,
          }).filter(
            (placement) =>
              !(placement.floor === player.floor && placement.x === elevatorTile.x && placement.y === elevatorTile.y)
          );

          if (placements.length === 0) {
            return {
              ...g,
              tileEffect: {
                type: "mystic-elevator-result",
                tileName: "Mystic Elevator",
                dice: da.final,
                total,
                message: `Rolled ${total}. The elevator can go to ${destination.label}, but there is no open doorway there.`,
                nextTurnPhase: "move",
                nextMessage:
                  player.movesLeft > 0
                    ? `${player.name} stays on the Mystic Elevator. ${player.movesLeft} move${player.movesLeft !== 1 ? "s" : ""} left.`
                    : `${player.name} stays on the Mystic Elevator. No moves left.`,
              },
            };
          }

          return {
            ...g,
            tileEffect: {
              type: "mystic-elevator-result",
              tileName: "Mystic Elevator",
              dice: da.final,
              total,
              message: `Rolled ${total}. Choose an open doorway on ${destination.label}.`,
              nextTurnPhase: "special-place",
              nextMessage: "Choose where to move the Mystic Elevator.",
              pendingSpecialPlacement: {
                mode: "move-existing",
                tile: elevatorTile,
                placements,
                nextTurnPhase: "move",
                nextMessage:
                  player.movesLeft > 0
                    ? `${player.name} rides the Mystic Elevator. ${player.movesLeft} move${player.movesLeft !== 1 ? "s" : ""} left.`
                    : `${player.name} rides the Mystic Elevator. No moves left.`,
              },
            },
          };
        });
      }
    }, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diceAnimation?.purpose, diceAnimation?.settled]);

  // Guard against edge cases where event state is "rolling" but the event-roll
  // animation is missing; restart the roll animation so the flow can continue.
  useEffect(() => {
    const awaiting = game.eventState?.awaiting;
    if (!awaiting || awaiting.type !== "rolling") return;
    if (diceAnimation) return;
    if (awaiting.rollKind !== "trait-roll" && awaiting.rollKind !== "dice-roll" && awaiting.rollKind !== "haunt-roll") {
      return;
    }

    const rollReady = resolveRollReadyAwaiting(game, { ...awaiting, type: "roll-ready" });
    if (rollReady.animation) {
      setGame(rollReady.game);
      setDiceAnimation(rollReady.animation);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.eventState?.awaiting, diceAnimation]);

  useEffect(() => {
    const awaiting = game.eventState?.awaiting;
    if (!awaiting || awaiting.type !== "event-damage-roll-ready") return;
    if (diceAnimation) return;

    const diceCount = awaiting.effect?.dice || 1;
    const final = rollDice(diceCount);

    setGame((g) => {
      if (g.eventState?.awaiting?.type !== "event-damage-roll-ready") return g;
      return {
        ...g,
        eventState: {
          ...g.eventState,
          awaiting: {
            ...g.eventState.awaiting,
            type: "event-damage-rolling",
          },
        },
      };
    });

    setDiceAnimation({
      purpose: "event-damage-roll",
      final,
      display: Array.from({ length: diceCount }, () => Math.floor(Math.random() * 3)),
      settled: false,
      effect: awaiting.effect,
      label: `${diceCount} damage die${diceCount === 1 ? "" : "s"}`,
      modifier: null,
    });
  }, [game.eventState?.awaiting, diceAnimation]);

  useEffect(() => {
    const awaiting = game.eventState?.awaiting;
    if (!awaiting || awaiting.type !== "event-damage-sequence-ready") return;
    if (diceAnimation) return;

    const effect = awaiting.effects?.[awaiting.currentIndex];
    if (!effect) return;

    const diceCount = effect.dice || 1;
    const final = rollDice(diceCount);

    setGame((g) => {
      if (g.eventState?.awaiting?.type !== "event-damage-sequence-ready") return g;
      return {
        ...g,
        eventState: {
          ...g.eventState,
          awaiting: {
            ...g.eventState.awaiting,
            type: "event-damage-sequence-rolling",
          },
        },
      };
    });

    setDiceAnimation({
      purpose: "event-damage-sequence",
      final,
      display: Array.from({ length: diceCount }, () => Math.floor(Math.random() * 3)),
      settled: false,
      effect,
      label: `${diceCount} damage die${diceCount === 1 ? "" : "s"}`,
      modifier: null,
    });
  }, [game.eventState?.awaiting, diceAnimation]);

  useEffect(() => {
    const awaiting = game.eventState?.awaiting;
    if (!awaiting || awaiting.type !== "trait-roll-sequence-rolling") return;
    if (diceAnimation) return;

    const shouldUseOverride =
      awaiting.overrideTotal !== undefined &&
      awaiting.overrideTotal !== null &&
      awaiting.currentIndex === 0 &&
      (awaiting.results?.length || 0) === 0;

    if (shouldUseOverride) {
      const forcedTotal = Math.max(0, Math.min(8, awaiting.overrideTotal));

      setGame((g) => {
        const sequenceAwaiting = g.eventState?.awaiting;
        if (!sequenceAwaiting || sequenceAwaiting.type !== "trait-roll-sequence-rolling") return g;
        if (sequenceAwaiting.currentIndex !== 0 || (sequenceAwaiting.results?.length || 0) > 0) return g;

        const currentStat = sequenceAwaiting.stats?.[0];
        if (!currentStat) return g;

        const failed = forcedTotal <= 1;
        const nextPlayers = failed ? applyStatChange(g.players, g.currentPlayerIndex, currentStat, -1) : g.players;
        const nextResults = [
          ...(sequenceAwaiting.results || []),
          {
            stat: currentStat,
            dice: [forcedTotal],
            total: forcedTotal,
            modifier: null,
            failed,
          },
        ];
        const hasMoreRolls = 1 < (sequenceAwaiting.stats?.length || 0);

        return {
          ...g,
          players: nextPlayers,
          eventState: {
            ...g.eventState,
            awaiting: hasMoreRolls
              ? {
                  ...sequenceAwaiting,
                  currentIndex: 1,
                  results: nextResults,
                  overrideTotal: undefined,
                }
              : {
                  ...sequenceAwaiting,
                  type: "trait-roll-sequence-complete",
                  results: nextResults,
                  overrideTotal: undefined,
                },
          },
          message: hasMoreRolls
            ? `${g.eventState.card.name}: rolling next trait.`
            : `${g.eventState.card.name}: trait sequence complete.`,
        };
      });

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
  }, [game.eventState?.awaiting, diceAnimation, game.board, game.currentPlayerIndex, game.players]);

  // Auto-close event modal when an event reaches an inert state with nothing left to resolve.
  useEffect(() => {
    const eventState = game.eventState;
    if (!eventState) return;
    if (eventState.awaiting || eventState.summary || eventState.lastRoll) return;
    if ((eventState.pendingEffects || []).length > 0) return;

    setGame((g) => {
      const currentEventState = g.eventState;
      if (!currentEventState) return g;
      if (currentEventState.awaiting || currentEventState.summary || currentEventState.lastRoll) return g;
      if ((currentEventState.pendingEffects || []).length > 0) return g;

      return finalizeEventState(g, g.message || `${currentEventState.card.name} resolved.`).game;
    });
  }, [game.eventState, game.message]);

  const currentPlayer = game.players[game.currentPlayerIndex];
  const floorTiles = game.board[cameraFloor] || [];

  // Keyboard controls
  useEffect(() => {
    function handleKeyDown(e) {
      // Rotate phase: R/E to rotate, Enter to place
      if (game.turnPhase === "rotate") {
        if (e.key === "r" || e.key === "R" || e.key === "ArrowRight") {
          e.preventDefault();
          handleRotateTile(1);
        } else if (e.key === "e" || e.key === "E" || e.key === "ArrowLeft") {
          e.preventDefault();
          handleRotateTile(-1);
        } else if (e.key === "Enter") {
          e.preventDefault();
          handlePlaceTile();
        }
        return;
      }

      if (game.turnPhase !== "move") return;
      if (cameraFloor !== currentPlayer.floor) return;

      const keyToDir = {
        ArrowUp: "N",
        ArrowDown: "S",
        ArrowRight: "E",
        ArrowLeft: "W",
      };
      const dir = keyToDir[e.key];
      if (!dir) return;

      e.preventDefault();

      // If on a pending explore placeholder, only allow backtracking
      if (game.pendingExplore) {
        const path = game.movePath;
        if (path.length >= 2) {
          const prev = path[path.length - 2];
          const { dx, dy } = DIR[dir];
          const nx = currentPlayer.x + dx;
          const ny = currentPlayer.y + dy;
          if (prev.x === nx && prev.y === ny && prev.floor === currentPlayer.floor) {
            handleBacktrack();
          }
        }
        return;
      }

      const tile = getTileAt(currentPlayer.x, currentPlayer.y, currentPlayer.floor);
      if (!tile || !tile.doors.includes(dir)) return;

      const { dx, dy } = DIR[dir];
      const nx = currentPlayer.x + dx;
      const ny = currentPlayer.y + dy;

      // Check if backtracking
      const path = game.movePath;
      if (path.length >= 2) {
        const prev = path[path.length - 2];
        if (prev.x === nx && prev.y === ny && prev.floor === currentPlayer.floor) {
          handleBacktrack();
          return;
        }
      }

      const moveCost = getLeaveMoveCost(tile);
      if (currentPlayer.movesLeft < moveCost) return;

      const neighbor = getTileAt(nx, ny, currentPlayer.floor);

      if (neighbor && neighbor.doors.includes(OPPOSITE[dir])) {
        handleMove(nx, ny, moveCost);
      } else if (!neighbor) {
        handleExplore(dir, nx, ny, moveCost);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Get tile at position
  function getTileAt(x, y, floor) {
    return game.board[floor]?.find((t) => t.x === x && t.y === y);
  }

  function getLeaveMoveCost(tile) {
    return tile?.obstacle ? 2 : 1;
  }

  function getPlacementOptions(board, tile) {
    const allDirs = ["N", "E", "S", "W"];
    const placements = [];

    for (const floor of tile.floors || []) {
      for (const baseTile of board[floor] || []) {
        for (const dir of baseTile.doors) {
          const { dx, dy } = DIR[dir];
          const x = baseTile.x + dx;
          const y = baseTile.y + dy;
          const occupied = board[floor]?.some((placedTile) => placedTile.x === x && placedTile.y === y);
          if (occupied) continue;

          const neededDoor = OPPOSITE[dir];
          const validRotations = [];
          for (let rot = 0; rot < 4; rot++) {
            const rotatedDoors = tile.doors.map((door) => {
              const doorIndex = allDirs.indexOf(door);
              return allDirs[(doorIndex + rot) % 4];
            });
            if (rotatedDoors.includes(neededDoor)) {
              validRotations.push(rotatedDoors);
            }
          }

          if (validRotations.length === 0) continue;

          placements.push({
            floor,
            x,
            y,
            validRotations,
          });
        }
      }
    }

    return placements;
  }

  function getConnectedMoveTarget(board, currentTile, path) {
    if (!currentTile) return null;

    const prev = path.length >= 2 ? path[path.length - 2] : null;

    if (currentTile.connectsTo) {
      for (const floor of ["ground", "upper", "basement"]) {
        const found = board[floor]?.find((tile) => tile.id === currentTile.connectsTo);
        if (found) {
          return {
            targetTile: found,
            targetFloor: floor,
            isBacktrack: Boolean(prev && prev.x === found.x && prev.y === found.y && prev.floor === floor),
          };
        }
      }
    }

    if (prev) {
      const previousTile = board[prev.floor]?.find((tile) => tile.x === prev.x && tile.y === prev.y);
      if (previousTile?.connectsTo === currentTile.id) {
        return {
          targetTile: previousTile,
          targetFloor: prev.floor,
          isBacktrack: true,
        };
      }
    }

    return null;
  }

  function getMysticElevatorDestination(total) {
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

  // Get valid move directions from current tile
  function getValidMoves() {
    if (game.turnPhase !== "move") return [];

    // If on a pending explore placeholder, only allow backtrack
    if (game.pendingExplore) {
      const path = game.movePath;
      if (path.length >= 2) {
        const prev = path[path.length - 2];
        // Find which direction leads back
        const dx = prev.x - currentPlayer.x;
        const dy = prev.y - currentPlayer.y;
        const dir = Object.entries(DIR).find(([, v]) => v.dx === dx && v.dy === dy)?.[0];
        if (dir) {
          return [{ dir, x: prev.x, y: prev.y, type: "backtrack" }];
        }
      }
      return [];
    }

    const tile = getTileAt(currentPlayer.x, currentPlayer.y, currentPlayer.floor);
    if (!tile) return [];

    // Find backtrack target
    const path = game.movePath;
    let backtrackPos = null;
    if (path.length >= 2) {
      backtrackPos = path[path.length - 2];
    }

    const moves = [];
    const moveCost = getLeaveMoveCost(tile);
    for (const dir of tile.doors) {
      const { dx, dy } = DIR[dir];
      const nx = currentPlayer.x + dx;
      const ny = currentPlayer.y + dy;
      const neighbor = getTileAt(nx, ny, currentPlayer.floor);

      if (neighbor) {
        if (neighbor.doors.includes(OPPOSITE[dir])) {
          // Check if this is a backtrack
          const isBacktrack =
            backtrackPos &&
            backtrackPos.x === nx &&
            backtrackPos.y === ny &&
            backtrackPos.floor === currentPlayer.floor;
          if (isBacktrack) {
            moves.push({ dir, x: nx, y: ny, type: "backtrack" });
          } else if (currentPlayer.movesLeft >= moveCost) {
            moves.push({ dir, x: nx, y: ny, type: "move", cost: moveCost });
          }
        }
      } else if (currentPlayer.movesLeft >= moveCost) {
        moves.push({ dir, x: nx, y: ny, type: "explore", cost: moveCost });
      }
    }
    return moves;
  }

  // Move player to an existing tile and extend the current path.
  function handleMove(nx, ny, cost) {
    setGame((g) => {
      const player = g.players[g.currentPlayerIndex];
      const currentTile = g.board[player.floor]?.find((t) => t.x === player.x && t.y === player.y);
      const resolvedCost = cost ?? getLeaveMoveCost(currentTile);
      if (player.movesLeft < resolvedCost) return g;

      const movesLeft = player.movesLeft - resolvedCost;
      const newPath = [...g.movePath, { x: nx, y: ny, floor: player.floor, cost: resolvedCost }];
      const destinationTile = g.board[player.floor]?.find((tile) => tile.x === nx && tile.y === ny);
      const updatedPlayers = g.players.map((p, i) =>
        i === g.currentPlayerIndex ? { ...p, x: nx, y: ny, movesLeft } : p
      );
      return {
        ...g,
        players: updatedPlayers,
        movePath: newPath,
        mysticElevatorReady:
          destinationTile?.enterEffect === "mystic-elevator" && !g.mysticElevatorUsed ? true : g.mysticElevatorReady,
        message:
          destinationTile?.enterEffect === "mystic-elevator" && !g.mysticElevatorUsed
            ? `${g.players[g.currentPlayerIndex].name} entered the Mystic Elevator. Use Elevator to roll 2 dice.`
            : movesLeft > 0
              ? `${g.players[g.currentPlayerIndex].name} — ${movesLeft} move${movesLeft !== 1 ? "s" : ""} left`
              : `${g.players[g.currentPlayerIndex].name} — no moves left`,
      };
    });
  }

  // Backtrack to previous tile in path and refund the cost of the undone step.
  function handleBacktrack() {
    setGame((g) => {
      const path = g.movePath;
      if (path.length < 2) return g;
      const prev = path[path.length - 2];
      const lastStep = path[path.length - 1];
      const newPath = path.slice(0, -1);
      const movesLeft = g.players[g.currentPlayerIndex].movesLeft + (lastStep.cost ?? 1);
      const updatedPlayers = g.players.map((p, i) =>
        i === g.currentPlayerIndex ? { ...p, x: prev.x, y: prev.y, floor: prev.floor || p.floor, movesLeft } : p
      );
      return {
        ...g,
        players: updatedPlayers,
        movePath: newPath,
        pendingExplore: null,
        message: `${g.players[g.currentPlayerIndex].name} — ${movesLeft} move${movesLeft !== 1 ? "s" : ""} left`,
      };
    });
    // Auto-switch camera if backtracking across floors
    setGame((g) => {
      const p = g.players[g.currentPlayerIndex];
      setCameraFloor(p.floor);
      return g;
    });
  }

  // Explore — move player onto placeholder, don't reveal tile yet.
  function handleExplore(dir, nx, ny, cost) {
    setGame((g) => {
      const player = g.players[g.currentPlayerIndex];
      const floor = player.floor;
      const currentTile = g.board[floor]?.find((t) => t.x === player.x && t.y === player.y);
      const resolvedCost = cost ?? getLeaveMoveCost(currentTile);
      if (player.movesLeft < resolvedCost) return g;

      // Find a tile that fits this floor
      const tileIndex = g.tileStack.findIndex((t) => t.floors.includes(floor));
      if (tileIndex === -1) {
        return { ...g, message: "No tiles left for this floor!" };
      }

      const tile = g.tileStack[tileIndex];

      // Compute all valid rotations (must include the door connecting back)
      const neededDoor = OPPOSITE[dir];
      const allDirs = ["N", "E", "S", "W"];
      const validRotations = [];
      for (let rot = 0; rot < 4; rot++) {
        const rotated = tile.doors.map((d) => {
          const idx = allDirs.indexOf(d);
          return allDirs[(idx + rot) % 4];
        });
        if (rotated.includes(neededDoor)) {
          validRotations.push(rotated);
        }
      }

      const movesLeft = player.movesLeft - resolvedCost;
      const newPath = [...g.movePath, { x: nx, y: ny, floor, cost: resolvedCost }];
      const updatedPlayers = g.players.map((p, i) =>
        i === g.currentPlayerIndex ? { ...p, x: nx, y: ny, movesLeft } : p
      );

      return {
        ...g,
        players: updatedPlayers,
        movePath: newPath,
        pendingExplore: {
          tile,
          tileIndex,
          x: nx,
          y: ny,
          floor,
          dir,
          validRotations,
          rotationIndex: 0,
        },
        message: `${g.players[g.currentPlayerIndex].name} entered an unknown room... Move Here to reveal it, or back out.`,
      };
    });
  }

  // Handle clicking a move/explore/backtrack target
  function handleAction(move) {
    if (move.type === "backtrack") {
      handleBacktrack();
    } else if (move.type === "move") {
      handleMove(move.x, move.y, move.cost);
    } else {
      handleExplore(move.dir, move.x, move.y, move.cost);
    }
  }

  // Confirm move — commit current position, reset path
  // If on a pending explore, enter rotate phase to choose orientation
  function handleConfirmMove() {
    setGame((g) => {
      const p = g.players[g.currentPlayerIndex];

      if (g.pendingExplore) {
        return {
          ...g,
          turnPhase: "rotate",
          message: `${p.name} discovered ${g.pendingExplore.tile.name}! Rotate the tile, then place it.`,
        };
      }

      return {
        ...g,
        movePath: [{ x: p.x, y: p.y, floor: p.floor, cost: 0 }],
        message: `${p.name} moved — ${p.movesLeft} move${p.movesLeft !== 1 ? "s" : ""} left`,
      };
    });
  }

  // Rotate the pending tile to the next valid orientation
  function handleRotateTile(direction) {
    setGame((g) => {
      if (!g.pendingExplore) return g;
      const pe = g.pendingExplore;
      const count = pe.validRotations.length;
      const newIndex = direction === 1 ? (pe.rotationIndex + 1) % count : (pe.rotationIndex - 1 + count) % count;
      return {
        ...g,
        pendingExplore: { ...pe, rotationIndex: newIndex },
      };
    });
  }

  // Place the tile with the chosen rotation
  function handlePlaceTile() {
    setGame((g) => {
      const p = g.players[g.currentPlayerIndex];
      const pe = g.pendingExplore;
      if (!pe) return g;

      const chosenDoors = pe.validRotations[pe.rotationIndex];
      const placedTile = {
        ...pe.tile,
        x: pe.x,
        y: pe.y,
        floor: pe.floor,
        doors: chosenDoors,
      };

      const newBoard = { ...g.board };
      newBoard[pe.floor] = [...newBoard[pe.floor], placedTile];

      const newStack = [...g.tileStack];
      newStack.splice(pe.tileIndex, 1);
      let newItemDeck = [...g.itemDeck];
      let newOmenDeck = [...g.omenDeck];
      let newEventDeck = [...g.eventDeck];

      let message = `${p.name} placed ${pe.tile.name}!`;
      let turnPhase = "move";
      let drawnCard = null;
      let newOmenCount = g.omenCount;
      let updatedPlayers = g.players;
      let tileEffect = null;

      if (pe.tile.cardType) {
        const cardType = pe.tile.cardType;
        if (cardType === "item") {
          const nextItem = newItemDeck.shift();
          drawnCard = nextItem ? createDrawnItemCard(nextItem) : null;
        } else if (cardType === "omen") {
          const nextOmen = newOmenDeck.shift();
          drawnCard = nextOmen ? createDrawnOmenCard(nextOmen) : null;
        } else {
          const nextEvent = newEventDeck.shift();
          drawnCard = nextEvent ? createDrawnEventCard(nextEvent) : null;
        }
        if (cardType === "omen") {
          newOmenCount++;
        }
        if (drawnCard) {
          message += ` A${cardType === "omen" || cardType === "event" ? "n" : "n"} ${cardType} card appears...`;
        }
        turnPhase = "card";
      } else {
        message += ` ${p.movesLeft} move${p.movesLeft !== 1 ? "s" : ""} left.`;
      }

      if (placedTile.discoverEffect === "junk-room") {
        newBoard[pe.floor] = newBoard[pe.floor].map((tile) =>
          tile.x === placedTile.x && tile.y === placedTile.y ? { ...tile, obstacle: true } : tile
        );

        const junkMessage = `${p.name} places an obstacle token in the Junk Room.`;
        tileEffect = {
          type: "junk-room",
          tileName: placedTile.name,
          message: junkMessage,
          queuedCard: drawnCard,
          nextTurnPhase: drawnCard ? "card" : "move",
          nextMessage: drawnCard
            ? `${junkMessage} ${drawnCard.type.toUpperCase()} card appears...`
            : `${junkMessage} ${p.movesLeft} move${p.movesLeft !== 1 ? "s" : ""} left.`,
        };

        drawnCard = null;
        turnPhase = "card";
        message = junkMessage;
      }

      if (placedTile.discoverEffect === "panic-room") {
        const secretAlreadyPlaced = Object.values(newBoard).some((tiles) =>
          tiles.some((tile) => tile.id === "secret-staircase")
        );
        const secretIndex = newStack.findIndex((tile) => tile.id === "secret-staircase");

        let panicMessage = "";
        if (!secretAlreadyPlaced && secretIndex !== -1) {
          const secretTile = newStack[secretIndex];
          const placements = getPlacementOptions(newBoard, secretTile);

          if (placements.length > 0) {
            newStack.splice(secretIndex, 1);
            panicMessage = `${p.name} reveals the Secret Staircase. Choose any open doorway to place it.`;

            tileEffect = {
              type: "panic-room",
              tileName: placedTile.name,
              message: `${panicMessage} The tile stack is shuffled.`,
              queuedCard: drawnCard,
              nextTurnPhase: "special-place",
              nextMessage: "Place the Secret Staircase on any open doorway.",
              pendingSpecialPlacement: {
                tile: secretTile,
                placements,
                queuedCard: drawnCard,
                nextTurnPhase: drawnCard ? "card" : "move",
                nextMessage: drawnCard
                  ? `${p.name} placed the Secret Staircase. An omen card appears...`
                  : `${p.name} placed the Secret Staircase. ${p.movesLeft} move${p.movesLeft !== 1 ? "s" : ""} left.`,
              },
            };
          } else {
            panicMessage = `${p.name} found the Secret Staircase, but there was nowhere to place it.`;

            tileEffect = {
              type: "panic-room",
              tileName: placedTile.name,
              message: `${panicMessage} The tile stack is shuffled.`,
              queuedCard: drawnCard,
              nextTurnPhase: drawnCard ? "card" : "move",
              nextMessage: drawnCard
                ? `${panicMessage} An omen card appears...`
                : `${panicMessage} ${p.movesLeft} move${p.movesLeft !== 1 ? "s" : ""} left.`,
            };
          }
        } else {
          panicMessage = "The Secret Staircase is already in play.";

          tileEffect = {
            type: "panic-room",
            tileName: placedTile.name,
            message: `${panicMessage} The tile stack is shuffled.`,
            queuedCard: drawnCard,
            nextTurnPhase: drawnCard ? "card" : "move",
            nextMessage: drawnCard
              ? `${panicMessage} An omen card appears...`
              : `${panicMessage} ${p.movesLeft} move${p.movesLeft !== 1 ? "s" : ""} left.`,
          };
        }

        newStack.sort(() => Math.random() - 0.5);
        drawnCard = null;
        turnPhase = tileEffect?.nextTurnPhase || "card";
        message = panicMessage;
      }

      if (placedTile.discoverEffect === "armory") {
        const { weaponCard, remainingDeck } = drawWeaponItem(newItemDeck);
        newItemDeck = remainingDeck;

        const armoryMessage = weaponCard
          ? `${p.name} searched the Armory and found ${weaponCard.name}.`
          : `${p.name} searched the Armory but found no weapon.`;

        tileEffect = {
          type: "armory",
          tileName: placedTile.name,
          message: armoryMessage,
          queuedCard: weaponCard ? createDrawnItemCard(weaponCard) : null,
          nextTurnPhase: weaponCard ? "card" : "move",
          nextMessage: weaponCard
            ? `${armoryMessage} A weapon item is taken.`
            : `${armoryMessage} ${p.movesLeft} move${p.movesLeft !== 1 ? "s" : ""} left.`,
        };

        drawnCard = null;
        turnPhase = weaponCard ? "card" : "move";
        message = armoryMessage;
      }

      const enableMysticElevator = placedTile.enterEffect === "mystic-elevator" && !g.mysticElevatorUsed;
      if (enableMysticElevator) {
        tileEffect = null;
        turnPhase = "move";
        message = `${p.name} placed Mystic Elevator! Use Elevator to roll 2 dice.`;
      }

      if (placedTile.discoverGain) {
        const { stat, amount } = placedTile.discoverGain;
        const currentIndex = p.statIndex[stat];
        const maxIndex = p.character[stat].length - 1;
        const appliedAmount = Math.min(amount, maxIndex - currentIndex);

        updatedPlayers = applyStatChange(g.players, g.currentPlayerIndex, stat, appliedAmount);

        const nextValue =
          updatedPlayers[g.currentPlayerIndex].character[stat][updatedPlayers[g.currentPlayerIndex].statIndex[stat]];
        const gainMessage =
          appliedAmount > 0
            ? `${p.name} gains ${appliedAmount} ${STAT_LABELS[stat]} from ${placedTile.name}. ${STAT_LABELS[stat]} is now ${nextValue}.`
            : `${p.name} cannot gain more ${STAT_LABELS[stat]} from ${placedTile.name}.`;

        tileEffect = {
          type: "discover-gain",
          tileName: placedTile.name,
          gainStat: stat,
          gainAmount: appliedAmount,
          message: gainMessage,
          queuedCard: drawnCard,
          nextTurnPhase: drawnCard ? "card" : "move",
          nextMessage: drawnCard
            ? `${gainMessage} ${drawnCard.type.toUpperCase()} card appears...`
            : `${gainMessage} ${p.movesLeft} move${p.movesLeft !== 1 ? "s" : ""} left.`,
        };

        drawnCard = null;
        turnPhase = "card";
        message = gainMessage;
      }

      return {
        ...g,
        board: newBoard,
        tileStack: newStack,
        itemDeck: newItemDeck,
        omenDeck: newOmenDeck,
        eventDeck: newEventDeck,
        players: updatedPlayers,
        movePath: [{ x: p.x, y: p.y, floor: p.floor, cost: 0 }],
        pendingExplore: null,
        pendingSpecialPlacement: null,
        mysticElevatorReady: enableMysticElevator ? true : g.mysticElevatorReady,
        mysticElevatorUsed: g.mysticElevatorUsed,
        omenCount: newOmenCount,
        drawnCard,
        tileEffect,
        turnPhase,
        message,
      };
    });
  }

  // Dismiss drawn card and continue
  function handleDismissCard(options = {}) {
    const { autoRollIfReady = false, initialEventChoice = null } = options;
    let nextCameraFloor = null;
    let nextDiceAnimation = null;
    let shouldClearQueuedAngelsFeather = false;
    setGame((g) => {
      const card = g.drawnCard;

      // Omen cards trigger a haunt roll animation
      if (card?.type === "omen") {
        const numDice = g.omenCount;
        const finalDice = rollDice(numDice);
        const updatedPlayers = g.players.map((pl, i) =>
          i === g.currentPlayerIndex ? { ...pl, omens: [...pl.omens, card] } : pl
        );
        setDiceAnimation({
          purpose: "haunt",
          final: finalDice,
          display: Array.from({ length: numDice }, () => Math.floor(Math.random() * 3)),
          omenCount: g.omenCount,
          settled: false,
        });
        return {
          ...g,
          players: updatedPlayers,
          drawnCard: null,
          message: "Rolling for haunt...",
        };
      }

      let message = "";
      if (card?.type === "event") {
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
        const result = advanceEventResolution(eventGame);
        let nextState = result.game;
        nextCameraFloor = result.cameraFloor || null;

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
          const choiceResult = advanceEventResolution(choiceApplied);
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
          const rollReady = resolveRollReadyAwaiting(nextState, nextState.eventState.awaiting);
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

        return nextState;
      } else if (card?.type === "item") {
        const updatedPlayers = g.players.map((pl, i) =>
          i === g.currentPlayerIndex ? { ...pl, inventory: [...pl.inventory, card] } : pl
        );
        return {
          ...g,
          players: updatedPlayers,
          drawnCard: null,
          turnPhase: "endTurn",
          message: `${g.players[g.currentPlayerIndex].name} collected ${card.name}!`,
        };
      }
      return {
        ...g,
        drawnCard: null,
        turnPhase: "endTurn",
        message,
      };
    });
    if (nextCameraFloor) {
      setCameraFloor(nextCameraFloor);
    }
    if (nextDiceAnimation) {
      setDiceAnimation(nextDiceAnimation);
    }
    if (shouldClearQueuedAngelsFeather) {
      setQueuedAngelsFeatherTotal(null);
    }
  }

  function handleDismissHauntRoll() {
    setDiceAnimation(null);
    setGame((g) => ({
      ...g,
      hauntRoll: null,
      turnPhase: "endTurn",
    }));
  }

  // Change floor via staircase
  function handleChangeFloor() {
    setGame((g) => {
      const p = g.players[g.currentPlayerIndex];

      // Find current tile
      const currentTile = g.board[p.floor]?.find((t) => t.x === p.x && t.y === p.y);
      const path = g.movePath;
      const connectedMove = getConnectedMoveTarget(g.board, currentTile, path);
      if (!connectedMove) return g;

      const { targetTile, targetFloor, isBacktrack } = connectedMove;

      if (isBacktrack) {
        const lastStep = path[path.length - 1];
        const movesLeft = p.movesLeft + (lastStep.cost ?? 1);
        const updatedPlayers = g.players.map((pl, i) =>
          i === g.currentPlayerIndex ? { ...pl, x: targetTile.x, y: targetTile.y, floor: targetFloor, movesLeft } : pl
        );
        return {
          ...g,
          players: updatedPlayers,
          movePath: path.slice(0, -1),
          pendingExplore: null,
          message: `${p.name} — ${movesLeft} move${movesLeft !== 1 ? "s" : ""} left`,
        };
      }

      const moveCost = getLeaveMoveCost(currentTile);
      if (p.movesLeft < moveCost) return g;
      const movesLeft = p.movesLeft - moveCost;
      const updatedPlayers = g.players.map((pl, i) =>
        i === g.currentPlayerIndex ? { ...pl, x: targetTile.x, y: targetTile.y, floor: targetFloor, movesLeft } : pl
      );

      return {
        ...g,
        players: updatedPlayers,
        movePath: [...g.movePath, { x: targetTile.x, y: targetTile.y, floor: targetFloor, cost: moveCost }],
        message:
          movesLeft > 0
            ? `${p.name} moved to ${targetTile.name} — ${movesLeft} move${movesLeft !== 1 ? "s" : ""} left`
            : `${p.name} moved to ${targetTile.name} — no moves left`,
      };
    });
    // Auto-switch camera to the player's new floor
    setCameraFloor((prev) => {
      const p = game.players[game.currentPlayerIndex];
      const currentTile = game.board[p.floor]?.find((t) => t.x === p.x && t.y === p.y);
      const connectedMove = getConnectedMoveTarget(game.board, currentTile, game.movePath);
      return connectedMove?.targetFloor || prev;
    });
  }

  function handleUseSecretPassage(target) {
    setGame((g) => {
      const player = g.players[g.currentPlayerIndex];
      if (g.turnPhase !== "move") return g;

      const currentTile = g.board[player.floor]?.find((tile) => tile.x === player.x && tile.y === player.y);
      const isOnSecretPassage = (currentTile?.tokens || []).some((token) => token.type === "secret-passage");
      if (!isOnSecretPassage) return g;

      const destinationTile = getTileAtPosition(g.board, target.x, target.y, target.floor);
      const destinationHasPassage = (destinationTile?.tokens || []).some((token) => token.type === "secret-passage");
      if (!destinationTile || !destinationHasPassage) return g;

      const path = g.movePath || [];
      const previousStep = path.length >= 2 ? path[path.length - 2] : null;
      const isBacktrack =
        previousStep &&
        previousStep.x === target.x &&
        previousStep.y === target.y &&
        previousStep.floor === target.floor;

      if (isBacktrack) {
        const lastStep = path[path.length - 1];
        const refundedMoves = player.movesLeft + (lastStep?.cost ?? 1);
        const updatedPlayers = g.players.map((current, index) =>
          index === g.currentPlayerIndex
            ? { ...current, x: target.x, y: target.y, floor: target.floor, movesLeft: refundedMoves }
            : current
        );

        return {
          ...g,
          players: updatedPlayers,
          movePath: path.slice(0, -1),
          message: `${player.name} backtracks through the Secret Passage to ${destinationTile.name} — ${refundedMoves} move${refundedMoves !== 1 ? "s" : ""} left`,
        };
      }

      if (player.movesLeft < 1) return g;

      const movesLeft = player.movesLeft - 1;
      const updatedPlayers = g.players.map((current, index) =>
        index === g.currentPlayerIndex
          ? { ...current, x: target.x, y: target.y, floor: target.floor, movesLeft }
          : current
      );

      return {
        ...g,
        players: updatedPlayers,
        movePath: [...g.movePath, { x: target.x, y: target.y, floor: target.floor, cost: 1 }],
        message:
          movesLeft > 0
            ? `${player.name} uses a Secret Passage to ${destinationTile.name} — ${movesLeft} move${movesLeft !== 1 ? "s" : ""} left`
            : `${player.name} uses a Secret Passage to ${destinationTile.name} — no moves left`,
      };
    });
    setCameraFloor(target.floor);
  }

  // End turn
  function handleEndTurn() {
    setGame((g) => {
      const p = g.players[g.currentPlayerIndex];
      const tile = g.board[p.floor]?.find((t) => t.x === p.x && t.y === p.y);

      // Check for end-of-turn tile effects
      if (tile?.endOfTurn && !g.tileEffect) {
        if (tile.endOfTurn === "furnace") {
          const finalDice = rollDice(1);
          const damageReduction = getDamageReduction(p, "physical");
          setDiceAnimation({
            purpose: "furnace",
            final: finalDice,
            display: Array.from({ length: 1 }, () => Math.floor(Math.random() * 3)),
            tileName: tile.name,
            playerIndex: g.currentPlayerIndex,
            modifier: createDiceModifier({
              amount: damageReduction.amount,
              sourceNames: damageReduction.sourceNames,
              sign: "-",
              labelPrefix: "blocked by",
            }),
            settled: false,
          });
          return { ...g, message: `${tile.name} — rolling for damage...` };
        }
        if (tile.endOfTurn === "collapsed") {
          const speedVal = p.character.speed[p.statIndex.speed];
          const roll = resolveTraitRoll(p, {
            stat: "speed",
            baseDiceCount: speedVal,
            context: "end-of-turn",
            board: g.board,
          });
          setDiceAnimation({
            purpose: "collapsed",
            final: roll.dice,
            display: Array.from({ length: roll.dice.length }, () => Math.floor(Math.random() * 3)),
            tileName: tile.name,
            playerIndex: g.currentPlayerIndex,
            modifier: roll.modifier,
            resolvedTotal: roll.total,
            settled: false,
          });
          return { ...g, message: `${tile.name} — rolling for stability...` };
        }
        if (tile.endOfTurn === "laundry-chute") {
          return {
            ...g,
            tileEffect: {
              type: "laundry-chute",
              tileName: tile.name,
              message: "You slide down the laundry chute to the Basement Landing!",
            },
          };
        }
      }

      return passTurn(g);
    });
  }

  function createDamageChoice(effect, player) {
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

  function updateDamageChoiceType(choice, player, damageType) {
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

  function applyStatChange(players, playerIndex, stat, amount) {
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

  function drawWeaponItem(itemDeck) {
    const weaponIndex = itemDeck.findIndex((card) => card.isWeapon);
    if (weaponIndex === -1) {
      return {
        weaponCard: null,
        remainingDeck: [...itemDeck],
      };
    }

    const remainingDeck = [...itemDeck];
    const [weaponCard] = remainingDeck.splice(weaponIndex, 1);
    return {
      weaponCard,
      remainingDeck,
    };
  }

  function applyDamageAllocation(players, playerIndex, allocation, adjustmentMode = "decrease") {
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

  function applyTileEffectConsequences(g, players, effect) {
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

  function appendEventSummary(summary, text) {
    if (!text) return summary || "";
    if (!summary) return text;
    return `${summary} ${text}`;
  }

  function getDiscoveredTileOptions(board, player, destination, tokenType = null) {
    const currentTile = getTileAtPosition(board, player.x, player.y, player.floor);
    const allTiles = Object.entries(board).flatMap(([floor, tiles]) =>
      tiles.map((tile) => ({
        tile,
        floor,
      }))
    );

    const withoutToken = (entries) =>
      tokenType
        ? entries.filter(({ tile }) => !(tile.tokens || []).some((token) => token.type === tokenType))
        : entries;

    switch (destination) {
      case "current-tile":
        return currentTile ? [{ tile: currentTile, floor: player.floor }] : [];
      case "adjacent-tile":
        return Object.entries(DIR)
          .map(([, dir]) => getTileAtPosition(board, player.x + dir.dx, player.y + dir.dy, player.floor))
          .filter(Boolean)
          .map((tile) => ({ tile, floor: player.floor }));
      case "entrance-hall":
      case "basement-landing":
      case "upper-landing":
      case "conservatory": {
        const target = allTiles.find(({ tile }) => tile.id === destination);
        return target ? [target] : [];
      }
      case "any-tile-in-current-region":
        return allTiles.filter(({ floor }) => floor === player.floor);
      case "any-tile-in-different-region":
        return allTiles.filter(({ floor }) => floor !== player.floor);
      case "any-tile":
        return allTiles;
      case "any-other-tile":
        return withoutToken(
          allTiles.filter(({ tile, floor }) => !(floor === player.floor && tile.x === player.x && tile.y === player.y))
        );
      case "any-ground-floor-tile":
        return withoutToken(allTiles.filter(({ floor }) => floor === "ground"));
      case "any-basement-tile":
        return withoutToken(allTiles.filter(({ floor }) => floor === "basement"));
      case "any-basement-or-ground-floor-tile":
        return allTiles.filter(({ floor }) => floor === "basement" || floor === "ground");
      case "any-upper-or-ground-floor-tile":
        return allTiles.filter(({ floor }) => floor === "upper" || floor === "ground");
      case "graveyard-or-catacombs":
        return allTiles.filter(({ tile }) => tile.id === "graveyard" || tile.id === "catacombs");
      default:
        return [];
    }
  }

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

  function getMatchingOutcome(outcomes, total) {
    return outcomes.find((outcome) => matchesRollCondition(outcome.when?.roll, total)) || null;
  }

  function getInitialEventPrimaryAction(g, card) {
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

    const result = advanceEventResolution(simulatedEvent);
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

  function resolveRollReadyAwaiting(g, awaiting) {
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
                outcomes: [...(awaiting.outcomes || [])], // FOR DEV ONLY. DELETE EVENTUALLY!
              },
              summary: describeEventEffects(resolvedEffects),
              pendingEffects: resolvedEffects,
            },
            message: `${g.eventState.card.name}: roll set to ${forcedTotal} by Angel's Feather.`,
          },
          animation: null,
        };
      }

      const roll = resolveTraitRoll(currentPlayerState, {
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
          outcomes: [...(awaiting.outcomes || [])], // FOR DEV ONLY. DELETE EVENTUALLY!
        },
      };
    }

    if (awaiting.rollKind === "dice-roll" || awaiting.rollKind === "haunt-roll") {
      const dice = rollDice(awaiting.baseDiceCount || 0);
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
          outcomes: [...(awaiting.outcomes || [])], // FOR DEV ONLY. DELETE EVENTUALLY!
        },
      };
    }

    return { game: g, animation: null };
  }

  function applyEventStatChange(players, playerIndex, effect, chosenStat = null) {
    const targetStat = effect.stat === "chosen" ? chosenStat : effect.stat;
    if (!targetStat) return players;

    if (targetStat === "all") {
      return PLAYER_STAT_ORDER.reduce((updatedPlayers, stat) => {
        const delta = effect.mode === "lose" ? -(effect.amount || 0) : effect.amount || 0;
        return effect.mode === "heal"
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

    if (effect.mode === "heal") {
      return players.map((player, index) => {
        if (index !== playerIndex) return player;
        const healedIndex = Math.max(player.statIndex[targetStat], player.character.startIndex[targetStat]);
        const statIndex = { ...player.statIndex, [targetStat]: healedIndex };
        const isAlive = Object.values(statIndex).every((value) => value > 0);
        return { ...player, statIndex, isAlive };
      });
    }

    const delta = effect.mode === "lose" ? -(effect.amount || 0) : effect.amount || 0;
    return applyStatChange(players, playerIndex, targetStat, delta);
  }

  function finalizeEventState(g, message) {
    return {
      game: {
        ...g,
        eventState: null,
        turnPhase: g.drawnCard ? "card" : "endTurn",
        message,
      },
    };
  }

  function applyResolvedEventEffect(g, effect, selectedValue = null) {
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
      const options = getDiscoveredTileOptions(g.board, player, effect.destination);
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

      const options = getDiscoveredTileOptions(g.board, player, effect.location, effect.token);
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

  function advanceEventResolution(g) {
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
        const effectResult = applyResolvedEventEffect(nextGame, currentEffect);
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

  function handleAdjustDamageAllocation(stat, delta) {
    setGame((g) => {
      const choice = g.damageChoice;
      if (!choice || !choice.allowedStats.includes(stat)) return g;

      const currentPlayerState = g.players[g.currentPlayerIndex];
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

      return {
        ...g,
        damageChoice: {
          ...(() => {
            const nextChoice = {
              ...choice,
              allocation: {
                ...choice.allocation,
                [stat]: Math.max(0, currentAmount + delta),
              },
            };

            return {
              ...nextChoice,
              postDamageEffects: getPostDamageEffectsForChoice(currentPlayerState, nextChoice),
            };
          })(),
        },
      };
    });
  }

  function handleToggleDamageConversion() {
    setGame((g) => {
      const choice = g.damageChoice;
      if (!choice?.canConvertToGeneral) return g;

      const nextDamageType = choice.damageType === "general" ? choice.originalDamageType : "general";
      return {
        ...g,
        damageChoice: updateDamageChoiceType(choice, g.players[g.currentPlayerIndex], nextDamageType),
      };
    });
  }

  function applyPostDamagePassiveEffects(players, playerIndex, choice) {
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
        messages.push(`${playerName} gains ${appliedAmount} ${STAT_LABELS[effect.stat]} from ${effect.sourceName}.`);
      }
    }

    return {
      players: updatedPlayers,
      message: messages.join(" "),
    };
  }

  function handleConfirmDamageChoice() {
    let nextCameraFloor = null;
    setGame((g) => {
      const choice = g.damageChoice;
      if (!choice) return g;

      const selectedTotal = Object.values(choice.allocation).reduce((sum, value) => sum + value, 0);
      if (selectedTotal !== choice.amount) return g;

      const damagedPlayers = applyDamageAllocation(
        g.players,
        g.currentPlayerIndex,
        choice.allocation,
        choice.adjustmentMode
      );
      const postDamageResult = applyPostDamagePassiveEffects(damagedPlayers, g.currentPlayerIndex, choice);
      const resolvedPlayers = applyTileEffectConsequences(g, postDamageResult.players, choice.effect);
      const baseState = {
        ...g,
        players: resolvedPlayers,
        tileEffect: null,
        damageChoice: null,
      };

      if (choice.source === "event-effect") {
        const resumed = advanceEventResolution({
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
          message: postDamageResult.message || g.message,
        });
        nextCameraFloor = resumed.cameraFloor || null;
        return resumed.game;
      }

      if (choice.source === "event-stat-choice") {
        const resumed = advanceEventResolution(baseState);
        nextCameraFloor = resumed.cameraFloor || null;
        return resumed.game;
      }

      const nextState = passTurn(baseState);

      return postDamageResult.message
        ? {
            ...nextState,
            message: `${postDamageResult.message} ${nextState.message}`,
          }
        : nextState;
    });
    setDiceAnimation(null);
    if (nextCameraFloor) {
      setCameraFloor(nextCameraFloor);
    }
  }

  function handleContinueEvent() {
    let nextCameraFloor = null;
    setGame((g) => {
      if (!g.eventState) return g;

      if (g.eventState.awaiting?.type === "trait-roll-sequence-complete") {
        const results = g.eventState.awaiting.results || [];
        const allSucceeded = results.every((entry) => !entry.failed);
        const rewardOutcome = allSucceeded
          ? (g.eventState.awaiting.outcomes || []).find((outcome) => outcome.when?.allRolls?.min !== undefined)
          : null;

        const resumed = advanceEventResolution({
          ...g,
          eventState: {
            ...g.eventState,
            awaiting: null,
            summary: null,
            pendingEffects: [...(rewardOutcome?.effects || [])],
          },
        });
        nextCameraFloor = resumed.cameraFloor || null;
        return resumed.game;
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
        const resumed = advanceEventResolution(hydratedState);
        nextCameraFloor = resumed.cameraFloor || null;
        return resumed.game;
      }

      const result = advanceEventResolution({
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
        nextCameraFloor = result.cameraFloor || null;
        return finalizeEventState(result.game, result.game.message || `${pendingEventState.card.name} resolved.`).game;
      }
      nextCameraFloor = result.cameraFloor || null;
      return result.game;
    });
    if (nextCameraFloor) {
      setCameraFloor(nextCameraFloor);
    }
  }

  function handleAdjustEventRollTotal(delta) {
    // FOR DEV ONLY. DELETE EVENTUALLY!
    setGame((g) => {
      // FOR DEV ONLY. DELETE EVENTUALLY!
      const eventState = g.eventState; // FOR DEV ONLY. DELETE EVENTUALLY!
      const lastRoll = eventState?.lastRoll; // FOR DEV ONLY. DELETE EVENTUALLY!
      if (!eventState || !lastRoll || !Array.isArray(lastRoll.outcomes)) return g; // FOR DEV ONLY. DELETE EVENTUALLY!

      const nextTotal = Math.max(0, (lastRoll.total || 0) + delta); // FOR DEV ONLY. DELETE EVENTUALLY!
      const matchedOutcome = getMatchingOutcome(lastRoll.outcomes, nextTotal); // FOR DEV ONLY. DELETE EVENTUALLY!
      const resolvedEffects = [...(matchedOutcome?.effects || [])]; // FOR DEV ONLY. DELETE EVENTUALLY!

      return {
        // FOR DEV ONLY. DELETE EVENTUALLY!
        ...g, // FOR DEV ONLY. DELETE EVENTUALLY!
        eventState: {
          // FOR DEV ONLY. DELETE EVENTUALLY!
          ...eventState, // FOR DEV ONLY. DELETE EVENTUALLY!
          lastRoll: {
            // FOR DEV ONLY. DELETE EVENTUALLY!
            ...lastRoll, // FOR DEV ONLY. DELETE EVENTUALLY!
            total: nextTotal, // FOR DEV ONLY. DELETE EVENTUALLY!
          }, // FOR DEV ONLY. DELETE EVENTUALLY!
          summary: describeEventEffects(resolvedEffects), // FOR DEV ONLY. DELETE EVENTUALLY!
          pendingEffects: resolvedEffects, // FOR DEV ONLY. DELETE EVENTUALLY!
        }, // FOR DEV ONLY. DELETE EVENTUALLY!
        message: `${eventState.card.name}: roll adjusted to ${nextTotal}.`, // FOR DEV ONLY. DELETE EVENTUALLY!
      }; // FOR DEV ONLY. DELETE EVENTUALLY!
    }); // FOR DEV ONLY. DELETE EVENTUALLY!
  } // FOR DEV ONLY. DELETE EVENTUALLY!

  function handleEventAwaitingChoice(value) {
    const immediateAwaiting = game.eventState?.awaiting;
    if (immediateAwaiting?.type === "roll-ready") {
      const rollReady = resolveRollReadyAwaiting(game, immediateAwaiting);
      setGame(rollReady.game);
      if (rollReady.animation) {
        setDiceAnimation(rollReady.animation);
      }
      return;
    }

    if (immediateAwaiting?.type === "trait-roll-sequence-ready") {
      setGame((g) => {
        if (g.eventState?.awaiting?.type !== "trait-roll-sequence-ready") return g;
        return {
          ...g,
          eventState: {
            ...g.eventState,
            awaiting: {
              ...g.eventState.awaiting,
              type: "trait-roll-sequence-rolling",
            },
          },
        };
      });
      return;
    }

    let nextCameraFloor = null;
    let nextDiceAnimation = null;
    setGame((g) => {
      const awaiting = g.eventState?.awaiting;
      if (!awaiting) return g;

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
        const result = advanceEventResolution(nextState);
        nextCameraFloor = result.cameraFloor || null;
        return result.game;
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
        let result = advanceEventResolution(nextState);
        if (result.game.eventState?.awaiting?.type === "roll-ready") {
          const rollReady = resolveRollReadyAwaiting(result.game, result.game.eventState.awaiting);
          result = {
            ...result,
            game: rollReady.game,
          };
          nextDiceAnimation = rollReady.animation;
        }
        nextCameraFloor = result.cameraFloor || null;
        return result.game;
      }

      if (awaiting.type === "stat-choice") {
        const applied = applyResolvedEventEffect(g, awaiting.effect, value);
        const resumed = advanceEventResolution({
          ...applied.game,
          eventState: {
            ...applied.game.eventState,
            awaiting: null,
          },
        });
        nextCameraFloor = applied.cameraFloor || resumed.cameraFloor || null;
        return resumed.game;
      }

      if (awaiting.type === "item-choice") {
        const nextPlayers = g.players.map((player, index) =>
          index === g.currentPlayerIndex
            ? { ...player, inventory: player.inventory.filter((_, itemIndex) => itemIndex !== Number(value)) }
            : player
        );
        const resumed = advanceEventResolution({
          ...g,
          players: nextPlayers,
          eventState: {
            ...g.eventState,
            awaiting: null,
          },
        });
        nextCameraFloor = resumed.cameraFloor || null;
        return resumed.game;
      }

      return g;
    });
    if (nextCameraFloor) {
      setCameraFloor(nextCameraFloor);
    }
    if (nextDiceAnimation) {
      setDiceAnimation(nextDiceAnimation);
    }
  }

  function handleEventTileChoice(option) {
    setGame((g) => {
      const awaiting = g.eventState?.awaiting;
      if (awaiting?.type !== "tile-choice") return g;

      if (awaiting.effect?.type === "move") {
        const tile = getTileAtPosition(g.board, option.x, option.y, option.floor);
        if (!tile) return g;

        return {
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
        };
      }

      return {
        ...g,
        eventState: {
          ...g.eventState,
          awaiting: {
            ...awaiting,
            selectedOptionId: option.id,
          },
        },
      };
    });
    setCameraFloor(option.floor);
  }

  function handleConfirmEventTileChoice() {
    let nextCameraFloor = null;
    setGame((g) => {
      const awaiting = g.eventState?.awaiting;
      if (awaiting?.type !== "tile-choice") return g;

      const selectedOption =
        awaiting.options?.find((option) => option.id === awaiting.selectedOptionId) ||
        (awaiting.options?.length === 1 ? awaiting.options[0] : null);
      if (!selectedOption) return g;

      const tile = getTileAtPosition(g.board, selectedOption.x, selectedOption.y, selectedOption.floor);
      if (!tile) return g;

      if (awaiting.effect.type === "move") {
        const resumed = advanceEventResolution({
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
        nextCameraFloor = selectedOption.floor;
        return resumed.game;
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
        const resumed = advanceEventResolution({
          ...g,
          board: nextBoard,
          eventState: {
            ...g.eventState,
            awaiting: null,
          },
        });
        nextCameraFloor = selectedOption.floor;
        return resumed.game;
      }

      return g;
    });
    if (nextCameraFloor) {
      setCameraFloor(nextCameraFloor);
    }
  }

  function getDamagePreview(player, choice) {
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

  function getStatTrackCellClass(index, currentIndex, previewIndex, adjustmentMode = "decrease") {
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

  function handleDismissTileEffect() {
    setGame((g) => {
      const effect = g.tileEffect;
      if (!effect) return passTurn(g);

      if (["discover-gain", "armory", "junk-room", "panic-room", "mystic-elevator-result"].includes(effect.type)) {
        if (effect.pendingSpecialPlacement) {
          setCameraFloor(effect.pendingSpecialPlacement.placements[0]?.floor || cameraFloor);
        }

        return {
          ...g,
          tileEffect: null,
          drawnCard: effect.pendingSpecialPlacement ? null : effect.queuedCard || null,
          pendingSpecialPlacement: effect.pendingSpecialPlacement || null,
          turnPhase: effect.nextTurnPhase,
          message: effect.nextMessage,
        };
      }

      const pi = g.currentPlayerIndex;
      const currentPlayerState = g.players[pi];
      const resolvedEffect = resolveDamageEffect(currentPlayerState, effect);

      if (resolvedEffect.damage > 0 && resolvedEffect.damageType) {
        return {
          ...g,
          tileEffect: null,
          damageChoice: createDamageChoice(resolvedEffect, currentPlayerState),
        };
      }

      const updatedPlayers = applyTileEffectConsequences(g, g.players, resolvedEffect);
      return passTurn({ ...g, players: updatedPlayers, tileEffect: null, damageChoice: null });
    });
    setDiceAnimation(null);
  }

  function handleRollMysticElevator() {
    setGame((g) => {
      const player = g.players[g.currentPlayerIndex];
      const currentTile = g.board[player.floor]?.find((tile) => tile.x === player.x && tile.y === player.y);
      if (!g.mysticElevatorReady || g.mysticElevatorUsed || currentTile?.id !== "mystic-elevator") return g;

      return {
        ...g,
        mysticElevatorReady: false,
        mysticElevatorUsed: true,
        tileEffect: null,
        message: "Rolling for the Mystic Elevator...",
      };
    });
    setDiceAnimation({
      purpose: "mystic-elevator",
      final: rollDice(2),
      display: Array.from({ length: 2 }, () => Math.floor(Math.random() * 3)),
      settled: false,
      tileName: "Mystic Elevator",
    });
  }

  function handleStartCollapsedDamage() {
    const te = game.tileEffect;
    if (!te || te.type !== "collapsed-pending") return;
    const damageFinal = rollDice(1);
    const damageReduction = getDamageReduction(game.players[game.currentPlayerIndex], "physical");
    // clear the pending effect and start the damage animation
    setGame((g) => ({ ...g, tileEffect: null }));
    setDiceAnimation({
      purpose: "collapsed-damage",
      final: damageFinal,
      display: Array.from({ length: 1 }, () => Math.floor(Math.random() * 3)),
      settled: false,
      tileName: te.tileName,
      playerIndex: game.currentPlayerIndex,
      modifier: createDiceModifier({
        amount: damageReduction.amount,
        sourceNames: damageReduction.sourceNames,
        sign: "-",
        labelPrefix: "blocked by",
      }),
      firstDice: te.dice,
      firstTotal: te.total,
    });
  }

  function handlePlacePendingSpecialTile(placement) {
    setGame((g) => {
      const pendingPlacement = g.pendingSpecialPlacement;
      if (!pendingPlacement) return g;

      const chosenDoors = placement.validRotations[0];
      const placedTile = {
        ...pendingPlacement.tile,
        x: placement.x,
        y: placement.y,
        floor: placement.floor,
        doors: chosenDoors,
      };

      if (pendingPlacement.mode === "move-existing") {
        const currentPlayerIndex = g.currentPlayerIndex;
        const oldFloor = pendingPlacement.tile.floor;
        const updatedBoard = {
          ...g.board,
          [oldFloor]: (g.board[oldFloor] || []).filter((tile) => tile !== pendingPlacement.tile),
          [placement.floor]: [...(g.board[placement.floor] || []), placedTile],
        };
        const updatedPlayers = g.players.map((player, index) =>
          index === currentPlayerIndex ? { ...player, x: placement.x, y: placement.y, floor: placement.floor } : player
        );

        setCameraFloor(placement.floor);

        return {
          ...g,
          board: updatedBoard,
          players: updatedPlayers,
          movePath: [{ x: placement.x, y: placement.y, floor: placement.floor, cost: 0 }],
          pendingSpecialPlacement: null,
          drawnCard: pendingPlacement.queuedCard || null,
          turnPhase: pendingPlacement.nextTurnPhase,
          message: pendingPlacement.nextMessage,
        };
      }

      return {
        ...g,
        board: {
          ...g.board,
          [placement.floor]: [...(g.board[placement.floor] || []), placedTile],
        },
        pendingSpecialPlacement: null,
        drawnCard: pendingPlacement.queuedCard || null,
        turnPhase: pendingPlacement.nextTurnPhase,
        message: pendingPlacement.nextMessage,
      };
    });
  }

  function toggleSidebarPlayer(index) {
    setExpandedSidebarPlayers((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function handleViewOwnedCard(card, ownerName, ownerIndex, ownerCollection, ownerCardIndex) {
    setViewedCard({
      ...card,
      ownerName,
      ownerIndex,
      ownerCollection,
      ownerCardIndex,
      showUseNowPicker: false,
    });
  }

  function handleUseAngelsFeatherNow() {
    setViewedCard((card) => {
      if (!card || card.id !== "angels-feather") return card;
      return {
        ...card,
        showUseNowPicker: true,
      };
    });
  }

  function handleChooseAngelsFeatherValue(total) {
    const awaiting = game.eventState?.awaiting;
    const canApplyNow =
      (awaiting?.type === "roll-ready" && awaiting.rollKind === "trait-roll") ||
      awaiting?.type === "trait-roll-sequence-ready";
    const canQueueForDrawnEvent =
      game.drawnCard?.type === "event" &&
      drawnEventPrimaryAction?.type === "roll" &&
      drawnEventPrimaryAction?.isTraitRoll;

    setGame((g) => {
      if (!viewedCard) return g;
      if (viewedCard.id !== "angels-feather") return g;
      if (viewedCard.ownerCollection !== "inventory") return g;
      if (viewedCard.ownerIndex !== g.currentPlayerIndex) return g;
      if (!canApplyNow && !canQueueForDrawnEvent) return g;

      const owner = g.players[viewedCard.ownerIndex];
      const inventoryCard = owner?.inventory?.[viewedCard.ownerCardIndex];
      if (!inventoryCard || inventoryCard.id !== "angels-feather") return g;

      const nextPlayers = g.players.map((player, index) => {
        if (index !== viewedCard.ownerIndex) return player;
        return {
          ...player,
          inventory: player.inventory.filter((_, cardIndex) => cardIndex !== viewedCard.ownerCardIndex),
        };
      });

      return {
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
    });

    if (canQueueForDrawnEvent && !canApplyNow) {
      setQueuedAngelsFeatherTotal(total);
    } else {
      setQueuedAngelsFeatherTotal(null);
    }

    setViewedCard(null);
  }

  function handleCloseViewedCard() {
    setViewedCard(null);
  }

  function passTurn(g) {
    let next = (g.currentPlayerIndex + 1) % g.players.length;
    // Skip dead players
    let attempts = 0;
    while (!g.players[next].isAlive && attempts < g.players.length) {
      next = (next + 1) % g.players.length;
      attempts++;
    }

    const nextPlayer = g.players[next];
    const speed = nextPlayer.character.speed[nextPlayer.statIndex.speed];
    const updatedPlayers = g.players.map((pl, i) => (i === next ? { ...pl, movesLeft: speed } : pl));

    setCameraFloor(nextPlayer.floor);

    return {
      ...g,
      players: updatedPlayers,
      currentPlayerIndex: next,
      turnPhase: "move",
      movePath: [{ x: nextPlayer.x, y: nextPlayer.y, floor: nextPlayer.floor, cost: 0 }],
      pendingExplore: null,
      pendingSpecialPlacement: null,
      mysticElevatorReady: false,
      mysticElevatorUsed: false,
      tileEffect: null,
      damageChoice: null,
      eventState: null,
      turnNumber: g.turnNumber + (next === 0 ? 1 : 0),
      message: `${nextPlayer.name}'s turn — ${speed} moves`,
    };
  }

  const validMoves = cameraFloor === currentPlayer.floor ? getValidMoves() : [];
  const pendingSpecialPlacementTargets = (game.pendingSpecialPlacement?.placements || []).filter(
    (placement) => placement.floor === cameraFloor
  );
  const damageChoice = game.damageChoice;
  const eventState = game.eventState;
  const drawnEventPrimaryAction =
    game.drawnCard?.type === "event" ? getInitialEventPrimaryAction(game, game.drawnCard) : null;
  const eventTileChoiceOptions = eventState?.awaiting?.type === "tile-choice" ? eventState.awaiting.options || [] : [];
  const selectedEventTileChoiceId =
    eventState?.awaiting?.type === "tile-choice" ? eventState.awaiting.selectedOptionId || null : null;
  const showEventResolutionModal = !!eventState && eventState.awaiting?.type !== "tile-choice";
  const damageAllocated = damageChoice
    ? Object.values(damageChoice.allocation).reduce((sum, value) => sum + value, 0)
    : 0;
  const damageRemaining = damageChoice ? damageChoice.amount - damageAllocated : 0;
  const damagePreview = damageChoice ? getDamagePreview(currentPlayer, damageChoice) : null;

  // Check if current player is on a staircase tile
  const currentTileObj = game.board[currentPlayer.floor]?.find(
    (t) => t.x === currentPlayer.x && t.y === currentPlayer.y
  );
  const canUseMysticElevator =
    game.turnPhase === "move" &&
    !game.pendingExplore &&
    !game.pendingSpecialPlacement &&
    !game.tileEffect &&
    !game.drawnCard &&
    !diceAnimation &&
    currentTileObj?.id === "mystic-elevator" &&
    game.mysticElevatorReady &&
    !game.mysticElevatorUsed;
  const secretPassageTargets =
    game.turnPhase === "move" && !game.pendingExplore && !game.pendingSpecialPlacement && !game.tileEffect
      ? Object.entries(game.board)
          .flatMap(([floor, tiles]) =>
            tiles
              .filter((tile) => (tile.tokens || []).some((token) => token.type === "secret-passage"))
              .map((tile) => ({
                floor,
                x: tile.x,
                y: tile.y,
                name: tile.name,
              }))
          )
          .filter(
            (tile) => !(tile.floor === currentPlayer.floor && tile.x === currentPlayer.x && tile.y === currentPlayer.y)
          )
      : [];
  const isOnSecretPassageTile = (currentTileObj?.tokens || []).some((token) => token.type === "secret-passage");
  const canUseSecretPassage = isOnSecretPassageTile && secretPassageTargets.length > 0;
  const angelsFeatherTraitRollReady =
    eventState?.awaiting?.type === "roll-ready" &&
    eventState.awaiting.rollKind === "trait-roll" &&
    eventState.awaiting.overrideTotal === undefined;
  const angelsFeatherTraitSequenceReady =
    eventState?.awaiting?.type === "trait-roll-sequence-ready" && eventState.awaiting.overrideTotal === undefined;
  const angelsFeatherDrawnEventTraitRollReady =
    game.drawnCard?.type === "event" &&
    drawnEventPrimaryAction?.type === "roll" &&
    drawnEventPrimaryAction?.isTraitRoll &&
    queuedAngelsFeatherTotal === null;
  const canUseAngelsFeatherNow =
    angelsFeatherTraitRollReady || angelsFeatherTraitSequenceReady || angelsFeatherDrawnEventTraitRollReady;
  let stairTarget = null;
  let stairIsBacktrack = false;
  if (game.turnPhase === "move" && !game.pendingExplore) {
    const connectedMove = getConnectedMoveTarget(game.board, currentTileObj, game.movePath);
    if (connectedMove) {
      stairIsBacktrack = connectedMove.isBacktrack;
      const moveCost = getLeaveMoveCost(currentTileObj);
      if (currentPlayer.movesLeft >= moveCost || stairIsBacktrack) {
        stairTarget = connectedMove.targetTile;
      }
    }
  }

  // Calculate board bounds for centering
  const allXs = floorTiles.map((t) => t.x);
  const allYs = floorTiles.map((t) => t.y);
  // Include move targets in bounds
  validMoves.forEach((m) => {
    if (m.type === "explore") {
      allXs.push(m.x);
      allYs.push(m.y);
    }
  });
  pendingSpecialPlacementTargets.forEach((placement) => {
    allXs.push(placement.x);
    allYs.push(placement.y);
  });
  const minX = Math.min(...allXs, 0) - 1;
  const maxX = Math.max(...allXs, 0) + 1;
  const minY = Math.min(...allYs, 0) - 1;
  const maxY = Math.max(...allYs, 0) + 1;

  const gridWidth = (maxX - minX + 1) * (TILE_SIZE + GAP);
  const gridHeight = (maxY - minY + 1) * (TILE_SIZE + GAP);

  // Players on current floor
  const playersOnFloor = game.players.filter((p) => p.floor === cameraFloor && p.isAlive);

  return (
    <div className="game-screen">
      {/* Header bar */}
      <div className="game-header">
        <div className="game-header-left">
          <span className="floor-tabs">
            {["upper", "ground", "basement"].map((f) => (
              <button
                key={f}
                className={`floor-tab ${cameraFloor === f ? "floor-tab-active" : ""}`}
                onClick={() => setCameraFloor(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f === currentPlayer.floor && " ●"}
              </button>
            ))}
          </span>
        </div>
        <div className="game-header-right"></div>
      </div>

      {/* Message bar */}
      {game.message && <div className="game-message">{game.message}</div>}

      {/* Board */}
      <div className="board-container" ref={boardRef}>
        <div className="board-scroll">
          <div className="board-grid" style={{ width: gridWidth, height: gridHeight }}>
            {/* Movement path line */}
            {game.movePath.filter((p) => p.floor === cameraFloor).length >= 2 && (
              <svg className="path-svg" style={{ width: gridWidth, height: gridHeight }}>
                <polyline
                  points={game.movePath
                    .filter((p) => p.floor === cameraFloor)
                    .map((p) => {
                      const cx = (p.x - minX) * (TILE_SIZE + GAP) + TILE_SIZE / 2;
                      const cy = (p.y - minY) * (TILE_SIZE + GAP) + TILE_SIZE / 2;
                      return `${cx},${cy}`;
                    })
                    .join(" ")}
                  className="path-line"
                  style={{ stroke: currentPlayer.color }}
                />
              </svg>
            )}

            {/* Placed tiles */}
            {floorTiles.map((tile) => {
              const left = (tile.x - minX) * (TILE_SIZE + GAP);
              const top = (tile.y - minY) * (TILE_SIZE + GAP);
              const tilePlayersHere = playersOnFloor.filter((p) => p.x === tile.x && p.y === tile.y);
              const isCurrentTile =
                currentPlayer.x === tile.x && currentPlayer.y === tile.y && currentPlayer.floor === cameraFloor;

              return (
                <div
                  key={tile.id + tile.x + tile.y}
                  className={`board-tile ${isCurrentTile ? "board-tile-current" : ""} ${
                    tile.cardType ? "board-tile-" + tile.cardType : ""
                  }`}
                  style={{ left, top, width: TILE_SIZE, height: TILE_SIZE }}
                >
                  {tile.description && <div className="tile-tooltip">{tile.description}</div>}
                  <div className="tile-name">{tile.name}</div>
                  {tile.cardType && <div className={`tile-type tile-type-${tile.cardType}`}>{tile.cardType}</div>}
                  {tile.obstacle && <div className="tile-obstacle">Obstacle</div>}
                  {tile.tokens?.length > 0 && (
                    <div className="tile-token-list">
                      {tile.tokens.map((token, tokenIndex) => (
                        <div
                          key={`${tile.id}-token-${token.type}-${tokenIndex}`}
                          className={`tile-token tile-token-${token.type}`}
                        >
                          {token.type.replace(/-/g, " ")}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Door indicators */}
                  <div className="tile-doors">
                    {tile.doors.map((d) => (
                      <div key={d} className={`door door-${d}`} />
                    ))}
                  </div>
                  {/* Player tokens */}
                  {tilePlayersHere.length > 0 && (
                    <div className="tile-players">
                      {tilePlayersHere.map((p) => (
                        <div key={p.index} className="player-token" style={{ background: p.color }} title={p.name}>
                          {p.name.charAt(0)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Pending explore placeholder / rotate preview */}
            {game.pendingExplore &&
              game.pendingExplore.floor === cameraFloor &&
              (() => {
                const pe = game.pendingExplore;
                const left = (pe.x - minX) * (TILE_SIZE + GAP);
                const top = (pe.y - minY) * (TILE_SIZE + GAP);
                const tilePlayersHere = playersOnFloor.filter((p) => p.x === pe.x && p.y === pe.y);
                const isRotating = game.turnPhase === "rotate";
                const previewDoors = isRotating ? pe.validRotations[pe.rotationIndex] : [];

                return (
                  <div
                    key="pending-explore"
                    className={`board-tile ${isRotating ? "board-tile-rotate" : "board-tile-pending"}`}
                    style={{ left, top, width: TILE_SIZE, height: TILE_SIZE }}
                  >
                    {isRotating ? (
                      <>
                        <div className="tile-name">{pe.tile.name}</div>
                        {pe.tile.cardType && (
                          <div className={`tile-type tile-type-${pe.tile.cardType}`}>{pe.tile.cardType}</div>
                        )}
                        <div className="tile-doors">
                          {previewDoors.map((d) => (
                            <div key={d} className={`door door-${d}`} />
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="tile-name" style={{ color: "var(--accent)" }}>
                        ?
                      </div>
                    )}
                    {tilePlayersHere.length > 0 && (
                      <div className="tile-players">
                        {tilePlayersHere.map((p) => (
                          <div key={p.index} className="player-token" style={{ background: p.color }} title={p.name}>
                            {p.name.charAt(0)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

            {/* Explore/move targets */}
            {!game.pendingExplore &&
              validMoves.map((m) => {
                // Don't show target if there's already a tile there (move targets are on existing tiles)
                if (m.type === "move") return null;
                const left = (m.x - minX) * (TILE_SIZE + GAP);
                const top = (m.y - minY) * (TILE_SIZE + GAP);
                return (
                  <button
                    key={`target-${m.x}-${m.y}`}
                    className="explore-target"
                    style={{ left, top, width: TILE_SIZE, height: TILE_SIZE }}
                    onClick={() => handleAction(m)}
                  >
                    <span className="explore-icon">?</span>
                  </button>
                );
              })}

            {game.pendingSpecialPlacement &&
              pendingSpecialPlacementTargets.map((placement) => {
                const left = (placement.x - minX) * (TILE_SIZE + GAP);
                const top = (placement.y - minY) * (TILE_SIZE + GAP);
                return (
                  <button
                    key={`special-placement-${placement.floor}-${placement.x}-${placement.y}`}
                    className="explore-target"
                    style={{ left, top, width: TILE_SIZE, height: TILE_SIZE }}
                    onClick={() => handlePlacePendingSpecialTile(placement)}
                  >
                    <span className="explore-icon">⇵</span>
                  </button>
                );
              })}

            {eventTileChoiceOptions
              .filter((option) => option.floor === cameraFloor)
              .map((option) => {
                const left = (option.x - minX) * (TILE_SIZE + GAP);
                const top = (option.y - minY) * (TILE_SIZE + GAP);
                return (
                  <button
                    key={`event-target-${option.id}`}
                    className={`event-target-overlay ${selectedEventTileChoiceId === option.id ? "event-target-overlay-selected" : ""}`}
                    style={{ left, top, width: TILE_SIZE, height: TILE_SIZE }}
                    onClick={() => handleEventTileChoice(option)}
                    title={option.label}
                  >
                    <span className="explore-icon">✦</span>
                  </button>
                );
              })}

            {/* Clickable overlay on existing tiles for movement/backtrack */}
            {validMoves
              .filter((m) => m.type === "move" || m.type === "backtrack")
              .map((m) => {
                const left = (m.x - minX) * (TILE_SIZE + GAP);
                const top = (m.y - minY) * (TILE_SIZE + GAP);
                return (
                  <button
                    key={`move-${m.x}-${m.y}`}
                    className={m.type === "backtrack" ? "backtrack-overlay" : "move-overlay"}
                    style={{ left, top, width: TILE_SIZE, height: TILE_SIZE }}
                    onClick={() => handleAction(m)}
                  />
                );
              })}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="game-actions">
        {eventState?.awaiting?.type === "tile-choice" && (
          <button
            className="btn btn-confirm"
            onClick={handleConfirmEventTileChoice}
            disabled={!selectedEventTileChoiceId}
          >
            Confirm Placement
          </button>
        )}
        {game.turnPhase === "move" && game.movePath.length > 1 && (
          <button className="btn btn-confirm" onClick={handleConfirmMove}>
            Move Here
          </button>
        )}
        {stairTarget && (
          <button className="btn btn-stairs" onClick={handleChangeFloor}>
            {stairIsBacktrack ? `Go back to ${stairTarget.name}` : `Move to ${stairTarget.name}`}
          </button>
        )}
        {canUseMysticElevator && (
          <button className="btn btn-stairs" onClick={handleRollMysticElevator}>
            Use Elevator
          </button>
        )}
        {canUseSecretPassage &&
          secretPassageTargets.map((target) => (
            <button
              key={`secret-passage-${target.floor}-${target.x}-${target.y}`}
              className="btn btn-stairs"
              onClick={() => handleUseSecretPassage(target)}
              disabled={currentPlayer.movesLeft < 1}
            >
              {`Move to ${target.name} (${target.floor})`}
            </button>
          ))}
        {game.turnPhase === "rotate" && (
          <>
            <button className="btn btn-rotate" onClick={() => handleRotateTile(-1)}>
              ↺ Rotate Left
            </button>
            <button className="btn btn-confirm" onClick={handlePlaceTile}>
              Place Tile
            </button>
            <button className="btn btn-rotate" onClick={() => handleRotateTile(1)}>
              Rotate Right ↻
            </button>
          </>
        )}
        {(game.turnPhase === "endTurn" || game.turnPhase === "move") && !game.pendingExplore && (
          <button className="btn btn-primary" onClick={handleEndTurn}>
            End Turn — Pass to {game.players[(game.currentPlayerIndex + 1) % game.players.length].name}
          </button>
        )}
      </div>

      {/* Player sidebar */}
      <div className="player-sidebar">
        {game.players.map((p, i) => {
          const isCurrent = i === game.currentPlayerIndex;
          const isExpanded = isCurrent || expandedSidebarPlayers.has(i);
          return (
            <div
              key={i}
              className={`sidebar-player ${isCurrent ? "sidebar-current" : ""} ${isExpanded ? "sidebar-expanded" : "sidebar-collapsed"} ${!p.isAlive ? "sidebar-dead" : ""}`}
              style={{ borderColor: isCurrent ? p.color : "transparent" }}
            >
              <button className="sidebar-header" onClick={() => toggleSidebarPlayer(i)} type="button">
                <div className="sidebar-name" style={{ color: p.color }}>
                  {p.name} {isCurrent && "◄"}
                </div>
                <span className={`sidebar-toggle ${isExpanded ? "sidebar-toggle-expanded" : ""}`} aria-hidden="true">
                  ▾
                </span>
              </button>
              <div className="sidebar-char">{p.character.name}</div>
              {!isExpanded && (
                <div className="sidebar-stats-summary">
                  {PLAYER_STAT_ORDER.map((stat) => (
                    <span key={`${p.name}-${stat}-summary`} className="sidebar-stats-summary-item">
                      <span>{STAT_ICONS[stat]}</span>
                      <span>{p.character[stat][p.statIndex[stat]]}</span>
                    </span>
                  ))}
                </div>
              )}
              <div className={`sidebar-stats ${isExpanded ? "sidebar-stats-expanded" : "sidebar-stats-collapsed"}`}>
                {PLAYER_STAT_ORDER.map((stat) => (
                  <div key={`${p.name}-${stat}`} className="sidebar-stat-row">
                    <div className="sidebar-stat-label">
                      <span>{STAT_ICONS[stat]}</span>
                      <span>{STAT_LABELS[stat]}</span>
                    </div>
                    <div className="sidebar-stat-track" aria-label={`${p.name} ${STAT_LABELS[stat]} track`}>
                      {p.character[stat].map((value, index) => (
                        <div
                          key={`${p.name}-${stat}-${index}`}
                          className={[
                            "sidebar-stat-cell",
                            index === p.statIndex[stat] ? "sidebar-stat-cell-current" : "",
                            index === p.character.startIndex[stat] ? "sidebar-stat-cell-start" : "",
                            value === 0 ? "sidebar-stat-cell-zero" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {value}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="sidebar-card-groups">
                  <div className="sidebar-card-group">
                    <div className="sidebar-card-group-header">
                      <span>Items</span>
                      <span>{p.inventory.length}</span>
                    </div>
                    {p.inventory.length > 0 ? (
                      <div className="sidebar-card-list">
                        {p.inventory.map((card, cardIndex) => (
                          <button
                            key={`${p.name}-item-${card.id}-${cardIndex}`}
                            type="button"
                            className="sidebar-card-chip sidebar-card-chip-item"
                            onClick={() =>
                              handleViewOwnedCard(
                                {
                                  ...card,
                                  ownerCollection: "inventory",
                                  ownerCardIndex: cardIndex,
                                },
                                p.name,
                                i,
                                "inventory",
                                cardIndex
                              )
                            }
                          >
                            {card.name}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="sidebar-card-empty">No items</div>
                    )}
                  </div>
                  <div className="sidebar-card-group">
                    <div className="sidebar-card-group-header">
                      <span>Omens</span>
                      <span>{p.omens.length}</span>
                    </div>
                    {p.omens.length > 0 ? (
                      <div className="sidebar-card-list">
                        {p.omens.map((card, cardIndex) => (
                          <button
                            key={`${p.name}-omen-${card.id}-${cardIndex}`}
                            type="button"
                            className="sidebar-card-chip sidebar-card-chip-omen"
                            onClick={() =>
                              handleViewOwnedCard(
                                {
                                  ...card,
                                  ownerCollection: "omens",
                                  ownerCardIndex: cardIndex,
                                },
                                p.name,
                                i,
                                "omens",
                                cardIndex
                              )
                            }
                          >
                            {card.name}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="sidebar-card-empty">No omens</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <button className="btn btn-danger sidebar-quit" onClick={onQuit}>
          Quit Game
        </button>
      </div>

      {/* Card overlay */}
      {game.drawnCard && (
        <div className="card-overlay">
          <div className={`card-modal card-${game.drawnCard.type}`}>
            <div className="card-type-label">{game.drawnCard.type.toUpperCase()}</div>
            <h2 className="card-name">{game.drawnCard.name}</h2>
            <CardAbilityContent card={game.drawnCard} />
            {game.drawnCard.flavor && <p className="card-flavor">{game.drawnCard.flavor}</p>}
            {game.drawnCard.type === "event" && drawnEventPrimaryAction?.type === "choice" ? (
              <>
                {drawnEventPrimaryAction.prompt && <p className="card-description">{drawnEventPrimaryAction.prompt}</p>}
                <div className="event-option-list">
                  {drawnEventPrimaryAction.options.map((option) => (
                    <button
                      key={`drawn-event-choice-${option}`}
                      className="btn btn-primary"
                      onClick={() =>
                        handleDismissCard({
                          initialEventChoice: option,
                          autoRollIfReady: true,
                        })
                      }
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <button
                className="btn btn-primary"
                onClick={() =>
                  handleDismissCard({
                    autoRollIfReady: game.drawnCard.type === "event" && drawnEventPrimaryAction?.autoRoll,
                  })
                }
              >
                {game.drawnCard.type === "omen"
                  ? "Roll for Haunt"
                  : game.drawnCard.type === "event"
                    ? drawnEventPrimaryAction?.label || "Continue"
                    : "Continue"}
              </button>
            )}
          </div>
        </div>
      )}

      {viewedCard && (
        <div className="sidebar-card-viewer" role="dialog" aria-label={`${viewedCard.type} details`}>
          <div className={`card-modal card-${viewedCard.type} card-viewer`}>
            <div className="card-type-label">{viewedCard.type.toUpperCase()}</div>
            <h2 className="card-name">{viewedCard.name}</h2>
            <div className="card-owner-label">Held by {viewedCard.ownerName}</div>
            <CardAbilityContent card={viewedCard} />
            {viewedCard.id === "angels-feather" &&
              viewedCard.ownerCollection === "inventory" &&
              viewedCard.ownerIndex === game.currentPlayerIndex &&
              canUseAngelsFeatherNow && (
                <button className="btn btn-primary" onClick={handleUseAngelsFeatherNow}>
                  Use now
                </button>
              )}
            {viewedCard.id === "angels-feather" && viewedCard.showUseNowPicker && (
              <div className="event-option-list" style={{ marginTop: "0.75rem" }}>
                {Array.from({ length: 9 }, (_, value) => (
                  <button
                    key={`angels-feather-value-${value}`}
                    className="btn btn-secondary"
                    onClick={() => handleChooseAngelsFeatherValue(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            )}
            {viewedCard.flavor && <p className="card-flavor">{viewedCard.flavor}</p>}
            <button className="btn btn-primary" onClick={handleCloseViewedCard}>
              Close
            </button>
          </div>
        </div>
      )}

      {showEventResolutionModal && (
        <div className="card-overlay">
          <div className="card-modal card-event-resolution">
            <div className="card-type-label">EVENT</div>
            <h2 className="card-name">{eventState.card.name}</h2>
            {eventState.summary && !eventState.lastRoll && <p className="card-description">{eventState.summary}</p>}
            {eventState.lastRoll && (
              <>
                <DiceRow dice={eventState.lastRoll.dice} modifier={eventState.lastRoll.modifier} />
                <div className="dice-total">
                  {/^[0-9]+ dice?$/.test(eventState.lastRoll.label || "")
                    ? eventState.lastRoll.total
                    : `${eventState.lastRoll.label}: ${eventState.lastRoll.total}`}
                </div>
                {eventState.summary && <p className="card-description">{eventState.summary}</p>}
                <div className="dev-roll-tools">
                  {" "}
                  {/* FOR DEV ONLY. DELETE EVENTUALLY! */}
                  <span className="dev-roll-tools-label">Dev Roll</span> {/* FOR DEV ONLY. DELETE EVENTUALLY! */}
                  <button className="btn btn-secondary" onClick={() => handleAdjustEventRollTotal(-1)}>
                    {" "}
                    {/* FOR DEV ONLY. DELETE EVENTUALLY! */}
                    -1
                  </button>
                  <button className="btn btn-secondary" onClick={() => handleAdjustEventRollTotal(1)}>
                    {" "}
                    {/* FOR DEV ONLY. DELETE EVENTUALLY! */}
                    +1
                  </button>
                </div>
              </>
            )}
            {eventState.awaiting?.prompt && <p className="card-description">{eventState.awaiting.prompt}</p>}
            {eventState.awaiting?.type === "choice" && (
              <div className="event-option-list">
                {eventState.awaiting.options.map((option) => (
                  <button
                    key={`event-choice-${option}`}
                    className="btn btn-primary"
                    onClick={() => handleEventAwaitingChoice(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
            {eventState.awaiting?.type === "step-stat-choice" && (
              <div className="event-option-list">
                {eventState.awaiting.options.map((option) => (
                  <button
                    key={`event-step-stat-${option}`}
                    className="btn btn-primary"
                    onClick={() => handleEventAwaitingChoice(option)}
                  >
                    {`${STAT_LABELS[option]} (${currentPlayer.character[option]?.[currentPlayer.statIndex[option]] ?? 0})`}
                  </button>
                ))}
              </div>
            )}
            {eventState.awaiting?.type === "stat-choice" && (
              <div className="event-option-list">
                {eventState.awaiting.options.map((option) => (
                  <button
                    key={`event-stat-${option}`}
                    className="btn btn-primary"
                    onClick={() => handleEventAwaitingChoice(option)}
                  >
                    {`${STAT_LABELS[option]} (${currentPlayer.character[option]?.[currentPlayer.statIndex[option]] ?? 0})`}
                  </button>
                ))}
              </div>
            )}
            {eventState.awaiting?.type === "item-choice" && (
              <div className="event-option-list">
                {eventState.awaiting.options.map((option) => (
                  <button
                    key={`event-item-${option.value}`}
                    className="btn btn-primary"
                    onClick={() => handleEventAwaitingChoice(String(option.value))}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
            {eventState.awaiting?.type === "tile-choice" && (
              <p className="card-description">Select a highlighted tile on the board.</p>
            )}
            {eventState.awaiting?.type === "roll-ready" && (
              <button className="btn btn-primary" onClick={() => handleEventAwaitingChoice("roll")}>
                {getEventRollButtonLabel(eventState.awaiting.baseDiceCount || 0)}
              </button>
            )}
            {eventState.awaiting?.type === "trait-roll-sequence-ready" && (
              <button className="btn btn-primary" onClick={() => handleEventAwaitingChoice("roll-sequence")}>
                Roll
              </button>
            )}
            {(eventState.awaiting?.type === "trait-roll-sequence-rolling" ||
              eventState.awaiting?.type === "trait-roll-sequence-complete") && (
              <>
                <div className="event-option-list">
                  {eventState.awaiting.stats.map((stat, index) => {
                    const result = eventState.awaiting.results?.[index];
                    const isRollingNow =
                      eventState.awaiting.type === "trait-roll-sequence-rolling" &&
                      eventState.awaiting.currentIndex === index &&
                      diceAnimation?.purpose === "event-trait-sequence-roll";

                    return (
                      <div key={`event-trait-sequence-${stat}-${index}`}>
                        <p className="card-description">{`${STAT_LABELS[stat]} Roll`}</p>
                        {result?.dice && <DiceRow dice={result.dice} modifier={result.modifier} />}
                        {isRollingNow && (
                          <DiceRow dice={diceAnimation.display} modifier={diceAnimation.modifier} rolling />
                        )}
                        {result && <p className="card-description">Result: {result.total}</p>}
                      </div>
                    );
                  })}
                </div>
                {eventState.awaiting?.type === "trait-roll-sequence-complete" && (
                  <button className="btn btn-primary" onClick={handleContinueEvent}>
                    Continue
                  </button>
                )}
              </>
            )}
            {eventState.awaiting?.type === "rolling" && (
              <>
                {diceAnimation?.purpose === "event-roll" && (
                  <DiceRow dice={diceAnimation.display} modifier={diceAnimation.modifier} rolling />
                )}
                <p className="card-description">Rolling...</p>
                {diceAnimation?.settled && (
                  <button className="btn btn-primary" onClick={handleContinueEvent}>
                    Recover
                  </button>
                )}
              </>
            )}
            {(eventState.awaiting?.type === "event-damage-sequence-ready" ||
              eventState.awaiting?.type === "event-damage-sequence-rolling" ||
              eventState.awaiting?.type === "event-damage-sequence-complete") && (
              <>
                <div className="event-option-list">
                  {eventState.awaiting.effects.map((effect, index) => {
                    const rolledEffect = eventState.awaiting.results?.[index];
                    const isRollingNow =
                      eventState.awaiting.type === "event-damage-sequence-rolling" &&
                      eventState.awaiting.currentIndex === index &&
                      diceAnimation?.purpose === "event-damage-sequence";

                    return (
                      <div key={`event-damage-sequence-${effect.damageType}-${index}`}>
                        <p className="card-description">
                          {`${effect.damageType === "physical" ? "Physical" : "Mental"} Damage Roll`}
                        </p>
                        {rolledEffect?.rolledDice && <DiceRow dice={rolledEffect.rolledDice} modifier={null} />}
                        {isRollingNow && <DiceRow dice={diceAnimation.display} modifier={null} rolling />}
                        {rolledEffect?.resolvedAmount !== undefined && (
                          <p className="card-description">Result: {rolledEffect.resolvedAmount}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                {eventState.awaiting?.type === "event-damage-sequence-complete" && (
                  <button className="btn btn-primary" onClick={handleContinueEvent}>
                    Okay
                  </button>
                )}
              </>
            )}
            {!eventState.awaiting && (
              <button className="btn btn-primary" onClick={handleContinueEvent}>
                Continue
              </button>
            )}
          </div>
        </div>
      )}

      {/* Dice roll overlay — animating */}
      {diceAnimation &&
        !diceAnimation.settled &&
        diceAnimation.purpose !== "event-damage-sequence" &&
        diceAnimation.purpose !== "event-trait-sequence-roll" && (
          <div className="card-overlay">
            <div
              className={`card-modal ${diceAnimation.purpose === "haunt" ? "card-haunt-rolling" : "card-tile-rolling"}`}
            >
              <div className="card-type-label">
                {diceAnimation.purpose === "haunt"
                  ? "HAUNT ROLL"
                  : diceAnimation.purpose === "event-roll"
                    ? "EVENT ROLL"
                    : diceAnimation.purpose === "event-damage-roll"
                      ? "EVENT DAMAGE ROLL"
                      : diceAnimation.purpose === "mystic-elevator"
                        ? "MYSTIC ELEVATOR"
                        : diceAnimation.purpose === "collapsed"
                          ? "COLLAPSED ROOM"
                          : diceAnimation.purpose === "collapsed-damage"
                            ? "COLLAPSED ROOM — DAMAGE"
                            : "FURNACE ROOM"}
              </div>
              <DiceRow dice={diceAnimation.display} modifier={diceAnimation.modifier} rolling />
              <h2 className="card-name">Rolling...</h2>
            </div>
          </div>
        )}

      {/* Haunt roll overlay — settled */}
      {game.hauntRoll && diceAnimation?.settled && diceAnimation.purpose === "haunt" && (
        <div className="card-overlay">
          <div className={`card-modal ${game.hauntRoll.hauntTriggered ? "card-haunt-triggered" : "card-haunt-safe"}`}>
            <div className="card-type-label">HAUNT ROLL</div>
            <DiceRow dice={game.hauntRoll.dice} />
            <div className="dice-total">Total: {game.hauntRoll.total}</div>
            <div className="dice-target">Need less than 5 to be safe</div>
            <h2 className="card-name">{game.hauntRoll.hauntTriggered ? "THE HAUNT BEGINS!" : "Safe... for now."}</h2>
            <p className="card-description">
              {game.hauntRoll.hauntTriggered
                ? `Rolled ${game.hauntRoll.total} with ${game.hauntRoll.omenCount} dice — 5 or higher! The haunt is upon you!`
                : `Rolled ${game.hauntRoll.total} with ${game.hauntRoll.omenCount} dice — less than 5. The house spares you... for now.`}
            </p>
            <button className="btn btn-primary" onClick={handleDismissHauntRoll}>
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Tile effect overlay */}
      {game.tileEffect && (
        <div className="card-overlay">
          <div
            className={`card-modal card-tile-effect ${game.tileEffect.type === "laundry-chute" ? "card-tile-neutral" : game.tileEffect.type === "collapsed-pending" ? "card-tile-danger" : game.tileEffect.damage > 0 || game.tileEffect.collapsed ? "card-tile-danger" : "card-tile-safe"}`}
          >
            <div className="card-type-label">{game.tileEffect.tileName}</div>
            {game.tileEffect.dice && <DiceRow dice={game.tileEffect.dice} modifier={game.tileEffect.diceModifier} />}
            {game.tileEffect.total !== undefined && <div className="dice-total">Total: {game.tileEffect.total}</div>}
            {game.tileEffect.collapsed && game.tileEffect.damageDice.length > 0 && (
              <>
                <div className="dice-total" style={{ marginTop: "0.5rem" }}>
                  Damage roll:
                </div>
                <DiceRow dice={game.tileEffect.damageDice} modifier={game.tileEffect.damageDiceModifier} />
              </>
            )}
            <p className="card-description">{game.tileEffect.message}</p>
            {game.tileEffect.type === "collapsed-pending" ? (
              <button className="btn btn-primary" onClick={handleStartCollapsedDamage}>
                Roll for damage
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handleDismissTileEffect}>
                {game.tileEffect.type === "mystic-elevator-result" && game.tileEffect.pendingSpecialPlacement
                  ? "Choose doorway"
                  : "Continue"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Damage choice overlay */}
      {damageChoice && (
        <div className="card-overlay">
          <div className="card-modal card-damage-choice">
            <div className="card-type-label">
              {damageChoice.adjustmentMode === "increase"
                ? "STAT GAIN"
                : `${damageChoice.damageType.toUpperCase()} DAMAGE`}
            </div>
            <h2 className="card-name">
              {damageChoice.adjustmentMode === "increase"
                ? "Choose where the gain goes"
                : "Choose where the damage goes"}
            </h2>
            <p className="card-description">
              {damageChoice.adjustmentMode === "increase"
                ? `Assign ${damageChoice.amount} point${damageChoice.amount === 1 ? "" : "s"} of gain to ${damageChoice.playerName}.`
                : `Assign ${damageChoice.amount} point${damageChoice.amount === 1 ? "" : "s"} of ${damageChoice.damageType} damage to ${damageChoice.playerName}.`}
            </p>
            {damageChoice.adjustmentMode !== "increase" && damageChoice.canConvertToGeneral && (
              <div className="damage-conversion-panel">
                <div className="damage-conversion-copy">
                  {damageChoice.damageType === "general"
                    ? `Taking this as General damage via ${formatSourceNames(damageChoice.conversionSourceNames)}.`
                    : `${formatSourceNames(damageChoice.conversionSourceNames)} can convert this to General damage.`}
                </div>
                <button className="btn btn-secondary damage-conversion-button" onClick={handleToggleDamageConversion}>
                  {damageChoice.damageType === "general"
                    ? `Use ${damageChoice.originalDamageType} damage`
                    : "Take as General Damage"}
                </button>
              </div>
            )}
            {damageChoice.adjustmentMode !== "increase" && damageChoice.postDamageEffects.length > 0 && (
              <p className="damage-choice-hint">
                After taking damage: {describePostDamageEffects(damageChoice.postDamageEffects)}.
              </p>
            )}
            <p className="damage-choice-hint">
              Use {damageChoice.adjustmentMode === "increase" ? "+" : "-"} to assign this change to a trait.
            </p>
            <div className="damage-choice-status">
              <span>Assigned: {damageAllocated}</span>
              <span>Remaining: {damageRemaining}</span>
            </div>
            <div className="damage-choice-list">
              {damageChoice.allowedStats.map((stat) => {
                const assigned = damageChoice.allocation[stat] || 0;
                const currentIndex = currentPlayer.statIndex[stat];
                const previewIndex = damagePreview[stat];
                const maxIncrease = currentPlayer.character[stat].length - 1 - currentIndex;
                const canAllocate =
                  damageChoice.adjustmentMode === "increase"
                    ? damageRemaining > 0 && assigned < maxIncrease
                    : damageRemaining > 0 && assigned < currentIndex;
                const canUndo = assigned > 0;
                const minusDelta = damageChoice.adjustmentMode === "increase" ? -1 : 1;
                const plusDelta = damageChoice.adjustmentMode === "increase" ? 1 : -1;
                const minusEnabled = minusDelta > 0 ? canAllocate : canUndo;
                const plusEnabled = plusDelta > 0 ? canAllocate : canUndo;

                return (
                  <div key={stat} className="damage-choice-row">
                    <div className="damage-choice-stat">
                      <div className="damage-choice-stat-header">
                        <div className="damage-choice-stat-name">{STAT_LABELS[stat]}</div>
                      </div>
                      <div className="stat-track-numbers" aria-label={`${STAT_LABELS[stat]} track`}>
                        {currentPlayer.character[stat].map((value, index) => (
                          <div
                            key={`${stat}-${index}`}
                            className={getStatTrackCellClass(
                              index,
                              currentIndex,
                              previewIndex,
                              damageChoice.adjustmentMode
                            )}
                          >
                            {value}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="damage-choice-controls">
                      <button
                        className="btn btn-secondary damage-choice-button"
                        onClick={() => handleAdjustDamageAllocation(stat, minusDelta)}
                        disabled={!minusEnabled}
                        aria-label={`- ${STAT_LABELS[stat]}`}
                      >
                        -
                      </button>
                      <div className="damage-choice-count">{assigned}</div>
                      <button
                        className="btn btn-primary damage-choice-button"
                        onClick={() => handleAdjustDamageAllocation(stat, plusDelta)}
                        disabled={!plusEnabled}
                        aria-label={`+ ${STAT_LABELS[stat]}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <button className="btn btn-primary" onClick={handleConfirmDamageChoice} disabled={damageRemaining !== 0}>
              {damageChoice.adjustmentMode === "increase" ? "Apply gain" : "Apply damage"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
