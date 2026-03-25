export function isDogTradeAvailableThisTurn(game, viewedCard, getDogTradeTargets) {
  if (!viewedCard || viewedCard.ownerCollection !== "omens") return false;
  const owner = game.players?.[viewedCard.ownerIndex];
  const omenCard = owner?.omens?.[viewedCard.ownerCardIndex];
  if (!owner || !omenCard || omenCard.id !== "dog") return false;
  if (omenCard.lastActiveAbilityTurnUsed === game.turnNumber) return false;

  const targets = getDogTradeTargets(game, viewedCard.ownerIndex, 4);
  if (targets.length === 0) return false;

  const ownerHasItems = (owner.inventory || []).length > 0;
  const ownerHasTradableOmens = (owner.omens || []).some((_, index) => index !== viewedCard.ownerCardIndex);
  const anyTargetHasTradableCards = targets.some(({ playerIndex }) => {
    const target = game.players[playerIndex];
    return (target?.inventory || []).length > 0 || (target?.omens || []).length > 0;
  });
  return ownerHasItems || ownerHasTradableOmens || anyTargetHasTradableCards;
}

function canPlayersTradeAcrossTeams(game, ownerIndex, targetPlayerIndex) {
  const traitorPlayerIndex = game?.hauntState?.traitorPlayerIndex;
  if (!Number.isInteger(traitorPlayerIndex)) return true;

  const ownerIsTraitor = ownerIndex === traitorPlayerIndex;
  const targetIsTraitor = targetPlayerIndex === traitorPlayerIndex;
  return ownerIsTraitor === targetIsTraitor;
}

export function isItemTradeLockedThisTurn(card, turnNumber) {
  if (!card) return false;
  return (
    card.lastActiveAbilityTurnUsed === turnNumber ||
    card.lastAttackTurnUsed === turnNumber ||
    card.lastUsedTurn === turnNumber
  );
}

export function createDogTradeStartState(game, viewedCard, getDogTradeTargets) {
  if (!viewedCard || viewedCard.activeAbilityRule?.action !== "dog-remote-trade") {
    return { ok: false, reason: "not-dog-action" };
  }

  const targets = getDogTradeTargets(game, viewedCard.ownerIndex, 4);
  if (targets.length === 0) {
    return {
      ok: false,
      reason: "no-targets",
      message: "Dog cannot find an explorer within 4 move points to trade with.",
    };
  }

  return {
    ok: true,
    dogTradeState: {
      phase: "move",
      ownerIndex: viewedCard.ownerIndex,
      dogOmenIndex: viewedCard.ownerCardIndex,
      floor: game.players[viewedCard.ownerIndex].floor,
      x: game.players[viewedCard.ownerIndex].x,
      y: game.players[viewedCard.ownerIndex].y,
      movesLeft: 4,
      targetPlayerIndex: null,
      ownerGiveIndexes: [],
      targetGiveIndexes: [],
      ownerGiveOmenIndexes: [],
      targetGiveOmenIndexes: [],
    },
  };
}

export function createDogTradeSelectionState(previousDogTradeState, targetPlayerIndex) {
  if (!previousDogTradeState) return previousDogTradeState;
  return {
    ...previousDogTradeState,
    phase: "trade",
    targetPlayerIndex,
    ownerGiveOmenIndexes: [],
    targetGiveIndexes: [],
    targetGiveOmenIndexes: [],
  };
}

export function applyDogTradeMoveState(previousDogTradeState, move) {
  if (!previousDogTradeState || previousDogTradeState.phase !== "move") return previousDogTradeState;

  const cost = Number(move?.cost) || 0;
  if (cost <= 0 || cost > previousDogTradeState.movesLeft) return previousDogTradeState;

  return {
    ...previousDogTradeState,
    floor: move.floor,
    x: move.x,
    y: move.y,
    movesLeft: previousDogTradeState.movesLeft - cost,
  };
}

export function createDogTradeBackToMoveState(previousDogTradeState) {
  if (!previousDogTradeState) return previousDogTradeState;
  return {
    ...previousDogTradeState,
    phase: "move",
    targetPlayerIndex: null,
    ownerGiveIndexes: [],
    targetGiveIndexes: [],
    ownerGiveOmenIndexes: [],
    targetGiveOmenIndexes: [],
  };
}

export function toggleDogTradeOwnerGiveState(previousDogTradeState, game, index, turnNumber) {
  if (!previousDogTradeState) return previousDogTradeState;
  const owner = game.players[previousDogTradeState.ownerIndex];
  const card = owner?.inventory?.[index];
  if (!card || isItemTradeLockedThisTurn(card, turnNumber)) return previousDogTradeState;

  const exists = previousDogTradeState.ownerGiveIndexes.includes(index);
  return {
    ...previousDogTradeState,
    ownerGiveIndexes: exists
      ? previousDogTradeState.ownerGiveIndexes.filter((value) => value !== index)
      : [...previousDogTradeState.ownerGiveIndexes, index],
  };
}

export function toggleDogTradeTargetGiveState(previousDogTradeState, game, index, turnNumber) {
  if (!previousDogTradeState) return previousDogTradeState;
  const target = game.players[previousDogTradeState.targetPlayerIndex];
  const card = target?.inventory?.[index];
  if (!card || isItemTradeLockedThisTurn(card, turnNumber)) return previousDogTradeState;

  const exists = previousDogTradeState.targetGiveIndexes.includes(index);
  return {
    ...previousDogTradeState,
    targetGiveIndexes: exists
      ? previousDogTradeState.targetGiveIndexes.filter((value) => value !== index)
      : [...previousDogTradeState.targetGiveIndexes, index],
  };
}

export function resolveConfirmDogTradeState(game, dogTradeState, turnNumber) {
  if (!dogTradeState) {
    return {
      nextGame: game,
      nextDogTradeState: dogTradeState,
    };
  }

  const owner = game.players[dogTradeState.ownerIndex];
  const target = game.players[dogTradeState.targetPlayerIndex];
  if (!owner || !target) {
    return {
      nextGame: game,
      nextDogTradeState: null,
    };
  }

  if (!canPlayersTradeAcrossTeams(game, dogTradeState.ownerIndex, dogTradeState.targetPlayerIndex)) {
    return {
      nextGame: {
        ...game,
        message: "Heroes and traitor cannot trade with each other.",
      },
      nextDogTradeState: null,
    };
  }

  const targetOnDogTile =
    target.floor === dogTradeState.floor && target.x === dogTradeState.x && target.y === dogTradeState.y;
  if (!targetOnDogTile) {
    return {
      nextGame: {
        ...game,
        message: "Dog must be on the same tile as the explorer to trade.",
      },
      nextDogTradeState: dogTradeState,
    };
  }

  const ownerGiveSet = new Set(
    (dogTradeState.ownerGiveIndexes || []).filter(
      (index) =>
        Number.isInteger(index) &&
        index >= 0 &&
        index < owner.inventory.length &&
        !isItemTradeLockedThisTurn(owner.inventory[index], turnNumber)
    )
  );
  const targetGiveSet = new Set(
    (dogTradeState.targetGiveIndexes || []).filter(
      (index) =>
        Number.isInteger(index) &&
        index >= 0 &&
        index < target.inventory.length &&
        !isItemTradeLockedThisTurn(target.inventory[index], turnNumber)
    )
  );
  const ownerGiveOmenSet = new Set(
    (dogTradeState.ownerGiveOmenIndexes || []).filter(
      (index) =>
        Number.isInteger(index) &&
        index >= 0 &&
        index < owner.omens.length &&
        index !== dogTradeState.dogOmenIndex &&
        !isItemTradeLockedThisTurn(owner.omens[index], turnNumber)
    )
  );
  const targetGiveOmenSet = new Set(
    (dogTradeState.targetGiveOmenIndexes || []).filter(
      (index) =>
        Number.isInteger(index) &&
        index >= 0 &&
        index < target.omens.length &&
        !isItemTradeLockedThisTurn(target.omens[index], turnNumber)
    )
  );

  if (
    ownerGiveSet.size === 0 &&
    targetGiveSet.size === 0 &&
    ownerGiveOmenSet.size === 0 &&
    targetGiveOmenSet.size === 0
  ) {
    return {
      nextGame: {
        ...game,
        message: "Select at least one card for Dog to carry.",
      },
      nextDogTradeState: dogTradeState,
    };
  }

  const ownerGivenItems = owner.inventory.filter((_, index) => ownerGiveSet.has(index));
  const targetGivenItems = target.inventory.filter((_, index) => targetGiveSet.has(index));
  const ownerGivenOmens = owner.omens.filter((_, index) => ownerGiveOmenSet.has(index));
  const targetGivenOmens = target.omens.filter((_, index) => targetGiveOmenSet.has(index));
  const ownerRemainingItems = owner.inventory.filter((_, index) => !ownerGiveSet.has(index));
  const targetRemainingItems = target.inventory.filter((_, index) => !targetGiveSet.has(index));
  const ownerRemainingOmens = owner.omens.filter((_, index) => !ownerGiveOmenSet.has(index));
  const targetRemainingOmens = target.omens.filter((_, index) => !targetGiveOmenSet.has(index));

  const nextPlayers = game.players.map((player, index) => {
    if (index === dogTradeState.ownerIndex) {
      return {
        ...player,
        inventory: [...ownerRemainingItems, ...targetGivenItems],
        omens: [...ownerRemainingOmens, ...targetGivenOmens].map((card, cardIndex) =>
          cardIndex === dogTradeState.dogOmenIndex
            ? {
                ...card,
                lastActiveAbilityTurnUsed: turnNumber,
              }
            : card
        ),
      };
    }

    if (index === dogTradeState.targetPlayerIndex) {
      return {
        ...player,
        inventory: [...targetRemainingItems, ...ownerGivenItems],
        omens: [...targetRemainingOmens, ...ownerGivenOmens],
      };
    }

    return player;
  });

  return {
    nextGame: {
      ...game,
      players: nextPlayers,
      message: `${owner.name}'s Dog completed a trade with ${target.name} (${ownerGivenItems.length + ownerGivenOmens.length} card${ownerGivenItems.length + ownerGivenOmens.length !== 1 ? "s" : ""} sent, ${targetGivenItems.length + targetGivenOmens.length} card${targetGivenItems.length + targetGivenOmens.length !== 1 ? "s" : ""} returned).`,
    },
    nextDogTradeState: null,
  };
}

export function getDogTradeUiState(game, dogTradeState, cameraFloor, getDogMoveOptions, getTileAtPosition) {
  if (!dogTradeState || dogTradeState.phase !== "move") {
    return {
      dogMoveOptions: [],
      dogMoveOptionsOnFloor: [],
      dogStairMoveOption: null,
      dogStairDestination: null,
      dogTradeTargetsOnTile: [],
    };
  }

  const dogMoveOptions = getDogMoveOptions(
    game,
    {
      floor: dogTradeState.floor,
      x: dogTradeState.x,
      y: dogTradeState.y,
    },
    dogTradeState.movesLeft
  );
  const dogMoveOptionsOnFloor = dogMoveOptions.filter((move) => move.floor === cameraFloor);
  const dogStairMoveOption = dogMoveOptions.find((move) => move.floor !== dogTradeState.floor) || null;
  const dogStairDestination = dogStairMoveOption
    ? getTileAtPosition(game.board, dogStairMoveOption.x, dogStairMoveOption.y, dogStairMoveOption.floor)
    : null;
  const dogTradeTargetsOnTile = game.players
    .map((player, playerIndex) => ({ player, playerIndex }))
    .filter(
      ({ player, playerIndex }) =>
        playerIndex !== dogTradeState.ownerIndex &&
        player.isAlive &&
        player.floor === dogTradeState.floor &&
        player.x === dogTradeState.x &&
        player.y === dogTradeState.y
    );

  return {
    dogMoveOptions,
    dogMoveOptionsOnFloor,
    dogStairMoveOption,
    dogStairDestination,
    dogTradeTargetsOnTile,
  };
}
