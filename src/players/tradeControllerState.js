import {
  applyDogTradeMoveState,
  createDogTradeBackToMoveState,
  createDogTradeSelectionState,
  isItemTradeLockedThisTurn,
  resolveConfirmDogTradeState,
  toggleDogTradeOwnerGiveState,
  toggleDogTradeTargetGiveState,
} from "../omens/dogAbility";

function canPlayersTradeAcrossTeams(game, ownerIndex, targetPlayerIndex) {
  const traitorPlayerIndex = game?.hauntState?.traitorPlayerIndex;
  if (!Number.isInteger(traitorPlayerIndex)) return true;

  const ownerIsTraitor = ownerIndex === traitorPlayerIndex;
  const targetIsTraitor = targetPlayerIndex === traitorPlayerIndex;
  return ownerIsTraitor === targetIsTraitor;
}

export function getPlayerTradeTargetsOnTile(game, ownerIndex, floor, x, y) {
  return game.players
    .map((player, playerIndex) => ({ player, playerIndex }))
    .filter(
      ({ player, playerIndex }) =>
        playerIndex !== ownerIndex &&
        player.isAlive &&
        player.floor === floor &&
        player.x === x &&
        player.y === y &&
        canPlayersTradeAcrossTeams(game, ownerIndex, playerIndex)
    );
}

export function createLocalPlayerTradeState(game, ownerIndex, targetPlayerIndex) {
  const owner = game.players[ownerIndex];
  const target = game.players[targetPlayerIndex];
  if (!owner || !target) return null;
  if (!canPlayersTradeAcrossTeams(game, ownerIndex, targetPlayerIndex)) return null;

  const isSameTile = owner.floor === target.floor && owner.x === target.x && owner.y === target.y;
  if (!isSameTile) return null;

  return {
    mode: "player-local",
    phase: "trade",
    ownerIndex,
    targetPlayerIndex,
    floor: owner.floor,
    x: owner.x,
    y: owner.y,
    ownerGiveIndexes: [],
    targetGiveIndexes: [],
    ownerGiveOmenIndexes: [],
    targetGiveOmenIndexes: [],
  };
}

export function resolveStartTradeSelectionState(previousTradeState, targetPlayerIndex) {
  const nextState = createDogTradeSelectionState(previousTradeState, targetPlayerIndex);
  if (!nextState) return nextState;
  return {
    ...nextState,
    ownerGiveOmenIndexes: [],
    targetGiveOmenIndexes: [],
  };
}

export function resolveMoveTradeTokenState(previousTradeState, move) {
  if (!move) {
    return {
      tradeState: previousTradeState,
      cameraFloor: null,
    };
  }

  return {
    tradeState: applyDogTradeMoveState(previousTradeState, move),
    cameraFloor: move.floor,
  };
}

export function resolveBackToTradeMoveState(previousTradeState) {
  return createDogTradeBackToMoveState(previousTradeState);
}

export function resolveToggleTradeOwnerGiveState(previousTradeState, game, index) {
  return toggleDogTradeOwnerGiveState(previousTradeState, game, index, game.turnNumber);
}

export function resolveToggleTradeTargetGiveState(previousTradeState, game, index) {
  return toggleDogTradeTargetGiveState(previousTradeState, game, index, game.turnNumber);
}

function toggleCardIndex(previousTradeState, key, card, index, turnNumber) {
  if (!previousTradeState || !card || isItemTradeLockedThisTurn(card, turnNumber)) {
    return previousTradeState;
  }

  const selected = previousTradeState[key] || [];
  const exists = selected.includes(index);
  return {
    ...previousTradeState,
    [key]: exists ? selected.filter((value) => value !== index) : [...selected, index],
  };
}

export function resolveToggleTradeOwnerGiveOmenState(previousTradeState, game, index) {
  if (!previousTradeState) return previousTradeState;
  if (previousTradeState.mode === "dog-remote" && index === previousTradeState.dogOmenIndex) {
    return previousTradeState;
  }

  const owner = game.players[previousTradeState.ownerIndex];
  const card = owner?.omens?.[index];
  return toggleCardIndex(previousTradeState, "ownerGiveOmenIndexes", card, index, game.turnNumber);
}

export function resolveToggleTradeTargetGiveOmenState(previousTradeState, game, index) {
  if (!previousTradeState) return previousTradeState;

  const target = game.players[previousTradeState.targetPlayerIndex];
  const card = target?.omens?.[index];
  return toggleCardIndex(previousTradeState, "targetGiveOmenIndexes", card, index, game.turnNumber);
}

function resolveConfirmLocalPlayerTradeState(game, tradeState) {
  if (!tradeState) {
    return {
      nextGame: game,
      nextTradeState: tradeState,
    };
  }

  const owner = game.players[tradeState.ownerIndex];
  const target = game.players[tradeState.targetPlayerIndex];
  if (!owner || !target) {
    return {
      nextGame: game,
      nextTradeState: null,
    };
  }

  const isSameTile = owner.floor === target.floor && owner.x === target.x && owner.y === target.y;
  if (!isSameTile) {
    return {
      nextGame: {
        ...game,
        message: "Players must be on the same tile to trade.",
      },
      nextTradeState: tradeState,
    };
  }

  if (!canPlayersTradeAcrossTeams(game, tradeState.ownerIndex, tradeState.targetPlayerIndex)) {
    return {
      nextGame: {
        ...game,
        message: "Heroes and traitor cannot trade with each other.",
      },
      nextTradeState: null,
    };
  }

  const ownerGiveSet = new Set(
    (tradeState.ownerGiveIndexes || []).filter(
      (index) =>
        Number.isInteger(index) &&
        index >= 0 &&
        index < owner.inventory.length &&
        !isItemTradeLockedThisTurn(owner.inventory[index], game.turnNumber)
    )
  );
  const targetGiveSet = new Set(
    (tradeState.targetGiveIndexes || []).filter(
      (index) =>
        Number.isInteger(index) &&
        index >= 0 &&
        index < target.inventory.length &&
        !isItemTradeLockedThisTurn(target.inventory[index], game.turnNumber)
    )
  );
  const ownerGiveOmenSet = new Set(
    (tradeState.ownerGiveOmenIndexes || []).filter(
      (index) =>
        Number.isInteger(index) &&
        index >= 0 &&
        index < owner.omens.length &&
        !isItemTradeLockedThisTurn(owner.omens[index], game.turnNumber)
    )
  );
  const targetGiveOmenSet = new Set(
    (tradeState.targetGiveOmenIndexes || []).filter(
      (index) =>
        Number.isInteger(index) &&
        index >= 0 &&
        index < target.omens.length &&
        !isItemTradeLockedThisTurn(target.omens[index], game.turnNumber)
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
        message: "Select at least one card to trade.",
      },
      nextTradeState: tradeState,
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
    if (index === tradeState.ownerIndex) {
      return {
        ...player,
        inventory: [...ownerRemainingItems, ...targetGivenItems],
        omens: [...ownerRemainingOmens, ...targetGivenOmens],
      };
    }

    if (index === tradeState.targetPlayerIndex) {
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
      message: `${owner.name} traded with ${target.name} (${ownerGivenItems.length + ownerGivenOmens.length} card${ownerGivenItems.length + ownerGivenOmens.length !== 1 ? "s" : ""} sent, ${targetGivenItems.length + targetGivenOmens.length} card${targetGivenItems.length + targetGivenOmens.length !== 1 ? "s" : ""} received).`,
    },
    nextTradeState: null,
  };
}

export function resolveConfirmTradeActionState(game, tradeState) {
  if (!tradeState) {
    return {
      nextGame: game,
      nextTradeState: tradeState,
    };
  }

  if (tradeState.mode === "player-local") {
    return resolveConfirmLocalPlayerTradeState(game, tradeState);
  }

  const dogResult = resolveConfirmDogTradeState(game, tradeState, game.turnNumber);
  return {
    nextGame: dogResult.nextGame,
    nextTradeState: dogResult.nextDogTradeState,
  };
}
