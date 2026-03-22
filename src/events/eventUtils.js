export function getEventRollButtonLabel(diceCount) {
  return diceCount === 1 ? "Roll Die" : "Roll Dice";
}

const STAT_LABELS = {
  might: "Might",
  speed: "Speed",
  sanity: "Sanity",
  knowledge: "Knowledge",
};

export function appendEventSummary(summary, text) {
  if (!text) return summary || "";
  if (!summary) return text;
  return `${summary} ${text}`;
}

export function describeTokenPlacementLocation(location) {
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

export function describeMoveDestination(destination) {
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

export function describeEventEffect(effect) {
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

export function describeEventEffects(effects) {
  if (!effects || effects.length === 0) return "Nothing happens.";
  return effects
    .map((effect) => describeEventEffect(effect))
    .filter(Boolean)
    .join(" ");
}

function getDoorwayAdjacentTiles(board, player, DIR, getTileAtPosition) {
  const currentTile = getTileAtPosition(board, player.x, player.y, player.floor);
  if (!currentTile) return [];

  const entries = [];
  const seen = new Set();
  const pushEntry = (tile, floor) => {
    if (!tile) return;
    const key = `${floor}:${tile.x}:${tile.y}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ tile, floor });
  };

  // Door-connected neighbors on the same floor.
  for (const dir of currentTile.doors || []) {
    const offset = DIR?.[dir];
    if (!offset) continue;
    const neighbor = getTileAtPosition(board, player.x + offset.dx, player.y + offset.dy, player.floor);
    if (!neighbor) continue;
    const opposite = { N: "S", S: "N", E: "W", W: "E" }[dir];
    if (!(neighbor.doors || []).includes(opposite)) continue;
    pushEntry(neighbor, player.floor);
  }

  // Stair / special connectors.
  if (currentTile.connectsTo) {
    for (const [floor, tiles] of Object.entries(board || {})) {
      const connected = (tiles || []).find((tile) => tile.id === currentTile.connectsTo);
      if (connected) {
        pushEntry(connected, floor);
        break;
      }
    }
  }

  for (const [floor, tiles] of Object.entries(board || {})) {
    for (const tile of tiles || []) {
      if (tile.connectsTo === currentTile.id) {
        pushEntry(tile, floor);
      }
    }
  }

  return entries;
}

export function getDiscoveredTileOptions(board, player, destination, tokenType = null, DIR, getTileAtPosition) {
  const currentTile = getTileAtPosition(board, player.x, player.y, player.floor);
  const allTiles = Object.entries(board).flatMap(([floor, tiles]) =>
    tiles.map((tile) => ({
      tile,
      floor,
    }))
  );

  const withoutToken = (entries) =>
    tokenType ? entries.filter(({ tile }) => !(tile.tokens || []).some((token) => token.type === tokenType)) : entries;

  switch (destination) {
    case "current-tile":
      return currentTile ? [{ tile: currentTile, floor: player.floor }] : [];
    case "adjacent-tile":
      return getDoorwayAdjacentTiles(board, player, DIR, getTileAtPosition);
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

export function formatEventResultLines(resultText) {
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
