export function applyHolySymbolDuringPendingExplore(game, oppositeByDir) {
  const pe = game.pendingExplore;
  if (!pe || game.turnPhase !== "rotate" || pe.holySymbolReplacement) {
    return {
      ...game,
      message: "Holy Symbol can only be used before placing a newly discovered tile.",
    };
  }

  const stackWithoutPending = [...game.tileStack];
  if (pe.tileIndex < 0 || pe.tileIndex >= stackWithoutPending.length) {
    return {
      ...game,
      message: "Holy Symbol cannot bury this tile right now.",
    };
  }

  const [buriedTile] = stackWithoutPending.splice(pe.tileIndex, 1);
  if (!buriedTile) {
    return {
      ...game,
      message: "Holy Symbol cannot bury this tile right now.",
    };
  }

  const stackWithBuriedTile = [...stackWithoutPending, buriedTile];
  const allDirs = ["N", "E", "S", "W"];
  const neededDoor = oppositeByDir[pe.dir];

  const replacementIndex = stackWithBuriedTile.findIndex((tile) => {
    if (!tile.floors?.includes(pe.floor)) return false;
    for (let rot = 0; rot < 4; rot += 1) {
      const rotatedDoors = tile.doors.map((door) => {
        const doorIndex = allDirs.indexOf(door);
        return allDirs[(doorIndex + rot) % 4];
      });
      if (rotatedDoors.includes(neededDoor)) return true;
    }
    return false;
  });

  if (replacementIndex === -1) {
    return {
      ...game,
      message: "Holy Symbol found no valid replacement tile.",
    };
  }

  const replacementTile = stackWithBuriedTile[replacementIndex];
  const validRotations = [];
  for (let rot = 0; rot < 4; rot += 1) {
    const rotatedDoors = replacementTile.doors.map((door) => {
      const doorIndex = allDirs.indexOf(door);
      return allDirs[(doorIndex + rot) % 4];
    });
    if (rotatedDoors.includes(neededDoor)) {
      validRotations.push(rotatedDoors);
    }
  }

  if (validRotations.length === 0) {
    return {
      ...game,
      message: "Holy Symbol found no valid replacement rotation.",
    };
  }

  const owner = game.players[game.currentPlayerIndex];
  return {
    ...game,
    tileStack: stackWithBuriedTile,
    pendingExplore: {
      ...pe,
      tile: replacementTile,
      tileIndex: replacementIndex,
      validRotations,
      rotationIndex: 0,
      holySymbolReplacement: true,
    },
    movePath: [{ x: owner.x, y: owner.y, floor: owner.floor, cost: 0 }],
    message: `${owner.name} buries ${pe.tile.name} with Holy Symbol and discovers ${replacementTile.name}.`,
  };
}
