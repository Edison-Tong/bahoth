/* [TILE-EFFECT] Returns { game } with a tileEffect prompt when the current tile has an end-of-turn effect (furnace/collapsed/laundry-chute), or null if none applies. */
export function getEndTurnTileAbilityState({ game, player, tile, currentPlayerIndex }) {
  // No end-of-turn effect on this tile, or a tileEffect is already pending — do nothing.
  if (!tile?.endOfTurn || game.tileEffect) {
    return null;
  }

  // Furnace Room: sets "furnace-prompt" tileEffect. Player clicks "Roll for Damage" →
  // handleRollFurnaceDamage (GameBoard.jsx) → "furnace" diceAnimation →
  // resolveTileDiceAnimationState (below) → "furnace" tileEffect → Continue →
  // resolveDismissTileEffectState (tileEffectFlow.js) applies Physical damage.
  if (tile.endOfTurn === "furnace") {
    return {
      game: {
        ...game,
        message: `${tile.name} — roll for damage!`,
        tileEffect: {
          type: "furnace-prompt",
          tileName: tile.name,
          playerIndex: currentPlayerIndex,
          message: `Roll 1 die for furnace damage. Take that much Physical damage (reduced by armor).`,
        },
      },
    };
  }

  // Collapsed Room: sets "collapsed-prompt" tileEffect with the player's current Speed
  // die count. Player clicks "Roll for Stability" → handleRollCollapsedStability (GameBoard.jsx)
  // → "collapsed" diceAnimation → resolveTileDiceAnimationState (below).
  // 5+: floor holds, turn passes. <5: "collapsed-pending" → second damage roll.
  if (tile.endOfTurn === "collapsed") {
    const speedVal = player.character.speed[player.statIndex.speed];
    return {
      game: {
        ...game,
        message: `${tile.name} — roll for stability!`,
        tileEffect: {
          type: "collapsed-prompt",
          tileName: tile.name,
          playerIndex: currentPlayerIndex,
          diceCount: speedVal, // captured now so it survives until the Roll button is pressed
          message: `Roll your Speed dice. On a 5 or higher the floor holds. On a 4 or lower, you fall to the Basement Landing and take damage.`,
        },
      },
    };
  }

  // Laundry Chute: no roll needed — player is auto-moved to Basement Landing on Continue.
  // resolveDismissTileEffectState (tileEffectFlow.js) → applyTileEffectConsequences (eventActions.js).
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

/* [TILE-EFFECT] [DICE-ANIMATION] Called after the diceAnimation settles for "collapsed", "collapsed-damage", or "furnace": converts settled dice into the tileEffect the player then reads and dismisses. */
export function resolveTileDiceAnimationState({ game, animation, baseTotal, getDamageReduction, createDiceModifier }) {
  // Stability roll for Collapsed Room.
  // animation.resolvedTotal may differ from baseTotal when an override item (e.g. Angel's Feather) forced the result.
  // <5 → "collapsed-pending" (prompts damage roll); ≥5 → "collapsed" safe result.
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

  // Damage roll after a failed Collapsed Room stability check.
  // animation.firstDice / firstTotal carry the original stability roll for display.
  // Armor reduces Physical damage; damageResolved: true tells tileEffectFlow to skip re-resolving.
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
        dice: animation.firstDice, // original stability roll dice shown on result card
        total: animation.firstTotal,
        collapsed: true,
        damageType: "physical",
        damageDice: animation.final, // damage roll dice shown beneath
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

  // Furnace Room damage roll. Armor reduces Physical damage.
  // damageResolved: true tells resolveDismissTileEffectState (tileEffectFlow.js) to skip re-resolving.
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
