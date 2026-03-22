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

export function getPostDamageEffectsForChoice(player, choice) {
  const damageTypes = getDamageTypesFromAllocation(choice);
  if (damageTypes.length === 0) return [];

  return getPassiveEffects(player).filter(
    (effect) => effect.type === "stat-gain-on-damage" && effect.damageTypes?.some((type) => damageTypes.includes(type))
  );
}
