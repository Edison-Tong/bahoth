export const OMEN_CARDS = [
  {
    id: "armor",
    name: "Armor",
    passiveEffects: [
      {
        type: "damage-reduction",
        damageTypes: ["physical"],
        amount: 1,
      },
    ],
    passiveAbility:
      "Whenever you take any physical damage, reduce that damage by 1. (the Armor doesn't prevent General damage or the direct loss of Might and/or Speed)",
  },
  // {
  //   id: "book",
  //   name: "Book",
  //   passiveEffects: [
  //     {
  //       type: "trait-roll-bonus",
  //       stat: "knowledge",
  //       amount: 1,
  //     },
  //   ],
  //   passiveAbility: "Add 1 to the result of your knowledge rolls",
  //   activeAbility:
  //     "Once during your turn, you may use the book to lose 1 Sanity. On the next trait roll you make this turn that isn't an attack, you may use your knowledge in place of the named trait.",
  // },
  // {
  //   id: "dagger",
  //   name: "Dagger",
  //   passiveAbility: "When you use the Dagger to attack, lose one speed. Roll 2 extra dice on the attack.",
  // },
  {
    id: "dog",
    name: "Dog",
    passiveEffects: [
      {
        type: "trait-roll-bonus",
        stat: "speed",
        amount: 1,
      },
    ],
    passiveAbility: "Add 1 to the result of your speed rolls",
    activeAbility:
      "Once during your turn, you may use the Dog to trade any number of Items or Omens with another player up to 4 tiles away, using normal trading rules.",
  },
  // {
  //   id: "holy-symbol",
  //   name: "Holy Symbol",
  //   passiveEffects: [
  //     {
  //       type: "trait-roll-bonus",
  //       stat: "sanity",
  //       amount: 1,
  //     },
  //   ],
  //   passiveAbility: "Add 1 to the result of your Sanity rolls.",
  //   activeAbility:
  //     "Whenever you discover a tile, you may choose to bury it and discover the next tile instead. If you do this, do not resolve any effects for the first tile.",
  // },
  // {
  //   id: "idol",
  //   name: "Idol",
  //   passiveEffects: [
  //     {
  //       type: "trait-roll-bonus",
  //       stat: "might",
  //       amount: 1,
  //     },
  //   ],
  //   passiveAbility: "Add 1 to the result of your Might rolls",
  //   activeAbility: "When you discover a tile with an Event symbol, you may choose to not draw an Event card.",
  // },
  // {
  //   id: "mask",
  //   name: "Mask",
  //   passiveEffects: [
  //     {
  //       type: "trait-roll-bonus",
  //       stat: "speed",
  //       amount: 1,
  //     },
  //   ],
  //   passiveAbility: "Add 1 to the result of your speed rolls",
  //   activeAbility:
  //     "Once during your turn, you may use the Mask to move everyone else on your tile (explorers and monsters) to any adjacent tiles. This effect may not be used to discover new tiles",
  // },
  // {
  //   id: "ring",
  //   name: "Ring",
  //   passiveEffects: [
  //     {
  //       type: "trait-roll-bonus",
  //       stat: "sanity",
  //       amount: 1,
  //     },
  //   ],
  //   passiveAbility: "Add 1 to the result of your Sanity rolls",
  //   activeAbility:
  //     "When you use the ring to attack, you and the defender each roll Sanity instead of might. The loser takes Mental damage.",
  // },
  // {
  //   id: "skull",
  //   name: "Skull",
  //   passiveEffects: [
  //     {
  //       type: "trait-roll-bonus",
  //       stat: "knowledge",
  //       amount: 1,
  //     },
  //   ],
  //   passiveAbility: "Add 1 to the result of your Knowledge rolls",
  //   activeAbility:
  //     "If something would cause your explorer to die, first roll 3 dice. 4-6: Instead of dying, set all your traits to critical. 0-3 You die as normal.",
  // },
];

export const ITEM_CARDS = [
  {
    id: "angels-feather",
    name: "Angel's Feather",
    subtype: "trait-roll",
    isWeapon: false,
    description:
      "When you are required to make a trait roll, you may instead bury Angel's Feather. If you do, choose a number from 0-8. Use that number as the result of the required roll.",
  },
  {
    id: "brooch",
    name: "Brooch",
    isWeapon: false,
    description: "Whenever you take Physical or Mental damage, you may instead take it as General damage.",
  },
  {
    id: "chainsaw",
    name: "Chainsaw",
    isWeapon: true,
    description: "When you use the Chainsaw to attack, add one die to your attack.",
  },
  {
    id: "creepy-doll",
    name: "Creepy Doll",
    subtype: "trait-roll",
    isWeapon: false,
    description: "Once during your turn, you may reroll all dice on a trait roll you just made. Then lose 1 Sanity.",
  },
  {
    id: "crossbow",
    name: "Crossbow",
    isWeapon: true,
    description:
      "When you use the Crossbow to attack, you may attack any character on your tile or an adjacent tile. You and the defender each roll Speed. Roll 1 extra die on the attack. If you lose, you take no damage.",
  },
  {
    id: "dynamite",
    name: "Dynamite",
    isWeapon: true,
    description:
      "You may use Dynamite in place of a regular attack. To do so, bury it and then choose your tile or an adjacent one. Everyone on the chosen tile must make a Speed roll. 4+: Nothing happens. 0-3: Take 4 Physical damage.",
  },
  {
    id: "first-aid-kit",
    name: "First Aid Kit",
    isWeapon: false,
    description:
      "On your turn, you may bury the First Aid Kit. If you do, heal all of your critical traits. You may also use the First Aid Kit to heal another explorer on your tile.",
  },
  {
    id: "flashlight",
    name: "Flashlight",
    isWeapon: false,
    description: "During Events, you may roll 2 extra dice on trait rolls.",
  },
  {
    id: "gun",
    name: "Gun",
    isWeapon: true,
    description:
      "When you use the Gun to attack, you may attack any target in line of sight. You and the defender each roll Speed. If you lose, you take no damage.",
  },
  {
    id: "headphones",
    name: "Headphones",
    isWeapon: false,
    description:
      "Whenever you take Mental damage, reduce that damage by 1. The Headphones do not prevent General damage or the direct loss of Knowledge and/or Sanity.",
  },
  {
    id: "leather-jacket",
    name: "Leather Jacket",
    isWeapon: false,
    description: "Roll 1 extra die whenever you defend against an attack.",
  },
  {
    id: "lucky-coin",
    name: "Lucky Coin",
    isWeapon: false,
    description:
      "Once during your turn, you may reroll all blank dice on a trait roll you just made. For each blank die on the reroll, take 1 Mental damage.",
  },
  {
    id: "machete",
    name: "Machete",
    isWeapon: true,
    description: "When you use the Machete to attack, add 1 to the result of your roll.",
  },
  {
    id: "magic-camera",
    name: "Magic Camera",
    isWeapon: false,
    description: "You may use your Sanity to make Knowledge rolls.",
  },
  {
    id: "map",
    name: "Map",
    isWeapon: false,
    description: "On your turn, you may bury the Map. If you do, place your explorer on any tile.",
  },
  {
    id: "mirror",
    name: "Mirror",
    isWeapon: false,
    description: "On your turn, you may bury the Mirror. If you do, heal your Knowledge and Sanity.",
  },
  {
    id: "mystical-stopwatch",
    name: "Mystical Stopwatch",
    isWeapon: false,
    description:
      "On your turn, you may bury the Mystical Stopwatch. If you do, take another turn after this one. You may only use this ability after the haunt has started.",
  },
  {
    id: "necklace-of-teeth",
    name: "Necklace of Teeth",
    isWeapon: false,
    description: "At the end of your turn, you may gain 1 in a critical trait of your choice.",
  },
  {
    id: "rabbits-foot",
    name: "Rabbit's Foot",
    isWeapon: false,
    description: "Once during your turn, you may reroll 1 die that you just rolled.",
  },
  {
    id: "skeleton-key",
    name: "Skeleton Key",
    isWeapon: false,
    description:
      "You may move through walls. Whenever you do so, roll 1 die. If you roll a blank, bury the Skeleton Key. You may not use the Skeleton Key to discover new rooms.",
  },
  {
    id: "strange-amulet",
    name: "Strange Amulet",
    isWeapon: false,
    description: "Whenever you take Physical damage, gain 1 Sanity.",
  },
  {
    id: "strange-medicine",
    name: "Strange Medicine",
    isWeapon: false,
    description: "On your turn, you may bury the Strange Medicine. If you do, heal your Might and your Speed.",
  },
];

export const EVENT_CARDS = [
  {
    id: "angry-being",
    name: "Angry Being",
    description: "A force of rage rushes through the room. Every living thing trembles.",
    flavor: "Placeholder event card.",
  },
  {
    id: "creaking-sound",
    name: "Creaking Sound",
    description: "Something heavy shifts somewhere in the house, just out of sight.",
    flavor: "Placeholder event card.",
  },
  {
    id: "icy-breath",
    name: "Icy Breath",
    description: "The air turns painfully cold and every breath hangs in front of you.",
    flavor: "Placeholder event card.",
  },
];

function shuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function createItemDeck() {
  return shuffle(ITEM_CARDS);
}

export function createOmenDeck() {
  return shuffle(OMEN_CARDS);
}

export function createEventDeck() {
  return shuffle(EVENT_CARDS);
}
