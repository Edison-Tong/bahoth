export function getEndTurnTileAbilityState({
  game,
  player,
  tile,
  currentPlayerIndex,
  rollDice,
  resolveTraitRoll,
  getDamageReduction,
  createDiceModifier,
}) {
  const createRollToken = () => `${Date.now()}-${Math.random()}`;

  if (!tile?.endOfTurn || game.tileEffect) {
    return null;
  }

  if (tile.endOfTurn === "furnace") {
    const finalDice = rollDice(1);
    const damageReduction = getDamageReduction(player, "physical");
    return {
      game: { ...game, message: `${tile.name} — rolling for damage...` },
      diceAnimation: {
        purpose: "furnace",
        token: createRollToken(),
        final: finalDice,
        display: Array.from({ length: 1 }, () => Math.floor(Math.random() * 3)),
        tileName: tile.name,
        playerIndex: currentPlayerIndex,
        modifier: createDiceModifier({
          amount: damageReduction.amount,
          sourceNames: damageReduction.sourceNames,
          sign: "-",
          labelPrefix: "blocked by",
        }),
        settled: false,
      },
    };
  }

  if (tile.endOfTurn === "collapsed") {
    const speedVal = player.character.speed[player.statIndex.speed];
    const roll = resolveTraitRoll(player, {
      stat: "speed",
      baseDiceCount: speedVal,
      context: "end-of-turn",
      board: game.board,
    });
    return {
      game: { ...game, message: `${tile.name} — rolling for stability...` },
      diceAnimation: {
        purpose: "collapsed",
        token: createRollToken(),
        final: roll.dice,
        display: Array.from({ length: roll.dice.length }, () => Math.floor(Math.random() * 3)),
        tileName: tile.name,
        playerIndex: currentPlayerIndex,
        modifier: roll.modifier,
        resolvedTotal: roll.total,
        settled: false,
      },
    };
  }

  if (tile.endOfTurn === "laundry-chute") {
    return {
      game: {
        ...game,
        tileEffect: {
          type: "laundry-chute",
          tileName: tile.name,
          message: "You slide down the laundry chute to the Basement Landing!",
        },
      },
    };
  }

  return null;
}

export function resolveTileDiceAnimationState({ game, animation, baseTotal, getDamageReduction, createDiceModifier }) {
  if (animation.purpose === "collapsed") {
    const total = animation.resolvedTotal ?? baseTotal;
    const collapsed = total < 5;
    const diceModifier = animation.modifier || null;

    if (collapsed) {
      return {
        ...game,
        tileEffect: {
          type: "collapsed-pending",
          tileName: animation.tileName,
          dice: animation.final,
          diceModifier,
          total,
          message: `The floor gives way! Rolled ${total} (needed 5+). Press Roll to roll for damage.`,
        },
      };
    }

    return {
      ...game,
      tileEffect: {
        type: "collapsed",
        tileName: animation.tileName,
        dice: animation.final,
        diceModifier,
        total,
        collapsed: false,
        damageDice: [],
        damage: 0,
        message: `The floor holds! Rolled ${total} (needed 5+). Safe!`,
      },
    };
  }

  if (animation.purpose === "collapsed-damage") {
    const player = game.players[animation.playerIndex ?? game.currentPlayerIndex];
    const baseDamage = animation.final[0];
    const damageReduction = getDamageReduction(player, "physical");
    const damage = Math.max(0, baseDamage - damageReduction.amount);
    const damageDiceModifier = createDiceModifier({
      amount: damageReduction.amount,
      sourceNames: damageReduction.sourceNames,
      sign: "-",
      labelPrefix: "blocked by",
    });

    return {
      ...game,
      tileEffect: {
        type: "collapsed",
        tileName: animation.tileName,
        dice: animation.firstDice,
        total: animation.firstTotal,
        collapsed: true,
        damageType: "physical",
        damageDice: animation.final,
        damageDiceModifier,
        damage,
        damageResolved: true,
        message:
          damage > 0
            ? `The floor gives way! Rolled ${animation.firstTotal} (needed 5+). Fall to Basement Landing and take ${damage} physical damage.`
            : `The floor gives way! Rolled ${animation.firstTotal} (needed 5+). Fall to Basement Landing, but the damage is reduced to 0.`,
      },
    };
  }

  if (animation.purpose === "furnace") {
    const player = game.players[animation.playerIndex ?? game.currentPlayerIndex];
    const baseDamage = animation.final[0];
    const damageReduction = getDamageReduction(player, "physical");
    const damage = Math.max(0, baseDamage - damageReduction.amount);
    const diceModifier = createDiceModifier({
      amount: damageReduction.amount,
      sourceNames: damageReduction.sourceNames,
      sign: "-",
      labelPrefix: "blocked by",
    });

    return {
      ...game,
      tileEffect: {
        type: "furnace",
        tileName: animation.tileName,
        dice: animation.final,
        diceModifier,
        damageType: "physical",
        damage,
        damageResolved: true,
        message:
          damage > 0
            ? `The furnace burns! Take ${damage} physical damage.`
            : baseDamage > 0 && damageReduction.amount > 0
              ? "The furnace burns, but the damage is reduced to 0."
              : "The furnace sputters — no damage!",
      },
    };
  }

  return null;
}
