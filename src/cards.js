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
  {
    id: "book",
    name: "Book",
    passiveEffects: [
      {
        type: "trait-roll-bonus",
        stat: "knowledge",
        amount: 1,
      },
    ],
    passiveAbility: "Add 1 to the result of your knowledge rolls",
    activeAbility:
      "Once during your turn, you may use the book to lose 1 Sanity. On the next trait roll you make this turn that isn't an attack, you may use your knowledge in place of the named trait.",
  },
  {
    id: "dagger",
    name: "Dagger",
    passiveEffects: [
      {
        type: "attack-roll-dice-bonus",
        amount: 2,
      },
      {
        type: "self-damage-on-attack",
        damageType: "direct-stat-loss",
        stat: "speed",
        amount: 1,
      },
    ],
    passiveAbility: "When you use the Dagger to attack, lose one speed. Roll 2 extra dice on the attack.",
  },
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
  {
    id: "holy-symbol",
    name: "Holy Symbol",
    passiveEffects: [
      {
        type: "trait-roll-bonus",
        stat: "sanity",
        amount: 1,
      },
    ],
    passiveAbility: "Add 1 to the result of your Sanity rolls.",
    activeAbility:
      "Whenever you discover a tile, you may choose to bury it and discover the next tile instead. If you do this, do not resolve any effects for the first tile.",
  },
  {
    id: "idol",
    name: "Idol",
    passiveEffects: [
      {
        type: "trait-roll-bonus",
        stat: "might",
        amount: 1,
      },
    ],
    passiveAbility: "Add 1 to the result of your Might rolls",
    activeAbility: "When you discover a tile with an Event symbol, you may choose to not draw an Event card.",
  },
  {
    id: "mask",
    name: "Mask",
    passiveEffects: [
      {
        type: "trait-roll-bonus",
        stat: "speed",
        amount: 1,
      },
    ],
    passiveAbility: "Add 1 to the result of your speed rolls",
    activeAbility:
      "Once during your turn, you may use the Mask to move everyone else on your tile (explorers and monsters) to any adjacent tiles. This effect may not be used to discover new tiles",
  },
  {
    id: "ring",
    name: "Ring",
    passiveEffects: [
      {
        type: "trait-roll-bonus",
        stat: "sanity",
        amount: 1,
      },
    ],
    passiveAbility: "Add 1 to the result of your Sanity rolls",
    activeAbility:
      "When you use the ring to attack, you and the defender each roll Sanity instead of might. The loser takes Mental damage.",
  },
  {
    id: "skull",
    name: "Skull",
    passiveEffects: [
      {
        type: "trait-roll-bonus",
        stat: "knowledge",
        amount: 1,
      },
    ],
    passiveAbility: "Add 1 to the result of your Knowledge rolls",
    activeAbility:
      "If something would cause your explorer to die, first roll 3 dice. 4-6: Instead of dying, set all your traits to critical. 0-3 You die as normal.",
  },
];

export const ITEM_CARDS = [
  // {
  //   id: "angels-feather",
  //   name: "Angel's Feather",
  //   subtype: "trait-roll",
  //   isWeapon: false,
  //   activeAbility:
  //     "When you are required to make a trait roll, you may instead bury Angel's Feather. If you do, choose a number from 0-8. Use that number as the result of the required roll.",
  // },
  {
    id: "brooch",
    name: "Brooch",
    isWeapon: false,
    passiveEffects: [
      {
        type: "damage-conversion-option",
        damageTypes: ["physical", "mental"],
        convertTo: "general",
      },
    ],
    passiveAbility: "Whenever you take Physical or Mental damage, you may instead take it as General damage.",
  },
  // {
  //   id: "chainsaw",
  //   name: "Chainsaw",
  //   isWeapon: true,
  //   activeAbility: "When you use the Chainsaw to attack, add one die to your attack.",
  // },
  // {
  //   id: "creepy-doll",
  //   name: "Creepy Doll",
  //   subtype: "trait-roll",
  //   isWeapon: false,
  //   activeAbility: "Once during your turn, you may reroll all dice on a trait roll you just made. Then lose 1 Sanity.",
  // },
  // {
  //   id: "crossbow",
  //   name: "Crossbow",
  //   isWeapon: true,
  //   activeAbility:
  //     "When you use the Crossbow to attack, you may attack any character on your tile or an adjacent tile. You and the defender each roll Speed. Roll 1 extra die on the attack. If you lose, you take no damage.",
  // },
  // {
  //   id: "dynamite",
  //   name: "Dynamite",
  //   isWeapon: true,
  //   activeAbility:
  //     "You may use Dynamite in place of a regular attack. To do so, bury it and then choose your tile or an adjacent one. Everyone on the chosen tile must make a Speed roll. 4+: Nothing happens. 0-3: Take 4 Physical damage.",
  // },
  // {
  //   id: "first-aid-kit",
  //   name: "First Aid Kit",
  //   isWeapon: false,
  //   activeAbility:
  //     "On your turn, you may bury the First Aid Kit. If you do, heal all of your critical traits. You may also use the First Aid Kit to heal another explorer on your tile.",
  // },
  {
    id: "flashlight",
    name: "Flashlight",
    isWeapon: false,
    passiveEffects: [
      {
        type: "trait-roll-dice-bonus",
        amount: 2,
        contexts: ["event"],
      },
    ],
    passiveAbility: "During Events, you may roll 2 extra dice on trait rolls.",
  },
  // {
  //   id: "gun",
  //   name: "Gun",
  //   isWeapon: true,
  //   activeAbility:
  //     "When you use the Gun to attack, you may attack any target in line of sight. You and the defender each roll Speed. If you lose, you take no damage.",
  // },
  {
    id: "headphones",
    name: "Headphones",
    isWeapon: false,
    passiveEffects: [
      {
        type: "damage-reduction",
        damageTypes: ["mental"],
        amount: 1,
      },
    ],
    passiveAbility:
      "Whenever you take Mental damage, reduce that damage by 1. The Headphones do not prevent General damage or the direct loss of Knowledge and/or Sanity.",
  },
  {
    id: "leather-jacket",
    name: "Leather Jacket",
    isWeapon: false,
    passiveEffects: [
      {
        type: "defense-roll-dice-bonus",
        amount: 1,
      },
    ],
    passiveAbility: "Roll 1 extra die whenever you defend against an attack.",
  },
  // {
  //   id: "lucky-coin",
  //   name: "Lucky Coin",
  //   isWeapon: false,
  //   activeAbility:
  //     "Once during your turn, you may reroll all blank dice on a trait roll you just made. For each blank die on the reroll, take 1 Mental damage.",
  // },
  // {
  //   id: "machete",
  //   name: "Machete",
  //   isWeapon: true,
  //   activeAbility: "When you use the Machete to attack, add 1 to the result of your roll.",
  // },
  // {
  //   id: "magic-camera",
  //   name: "Magic Camera",
  //   isWeapon: false,
  //   activeAbility: "You may use your Sanity to make Knowledge rolls.",
  // },
  // {
  //   id: "map",
  //   name: "Map",
  //   isWeapon: false,
  //   activeAbility: "On your turn, you may bury the Map. If you do, place your explorer on any tile.",
  // },
  // {
  //   id: "mirror",
  //   name: "Mirror",
  //   isWeapon: false,
  //   activeAbility: "On your turn, you may bury the Mirror. If you do, heal your Knowledge and Sanity.",
  // },
  // {
  //   id: "mystical-stopwatch",
  //   name: "Mystical Stopwatch",
  //   isWeapon: false,
  //   activeAbility:
  //     "On your turn, you may bury the Mystical Stopwatch. If you do, take another turn after this one. You may only use this ability after the haunt has started.",
  // },
  // {
  //   id: "necklace-of-teeth",
  //   name: "Necklace of Teeth",
  //   isWeapon: false,
  //   activeAbility: "At the end of your turn, you may gain 1 in a critical trait of your choice.",
  // },
  // {
  //   id: "rabbits-foot",
  //   name: "Rabbit's Foot",
  //   isWeapon: false,
  //   activeAbility: "Once during your turn, you may reroll 1 die that you just rolled.",
  // },
  // {
  //   id: "skeleton-key",
  //   name: "Skeleton Key",
  //   isWeapon: false,
  //   activeAbility:
  //     "You may move through walls. Whenever you do so, roll 1 die. If you roll a blank, bury the Skeleton Key. You may not use the Skeleton Key to discover new rooms.",
  // },
  {
    id: "strange-amulet",
    name: "Strange Amulet",
    isWeapon: false,
    passiveEffects: [
      {
        type: "stat-gain-on-damage",
        damageTypes: ["physical"],
        stat: "sanity",
        amount: 1,
      },
    ],
    passiveAbility: "Whenever you take Physical damage, gain 1 Sanity.",
  },
  // {
  //   id: "strange-medicine",
  //   name: "Strange Medicine",
  //   isWeapon: false,
  //   activeAbility: "On your turn, you may bury the Strange Medicine. If you do, heal your Might and your Speed.",
  // },
];

export const EVENT_CARDS = [
  {
    name: "a bite!",
    type: "event",
    todo: "Make a Might roll",
    result: "4+: Nothing happens. 2-3: Take 1 Physical damage. 0-1: Take 3 Physical damage.",
  },
  {
    name: "a cry for help",
    type: "event",
    todo: "Make a Knowledge roll",
    result: "4+: Place your explorer on any tile in your region. 0-3: Take 1 Mental damage",
  },
  {
    name: "a full table",
    type: "event",
    todo: "Make a Knowledge or Sanity roll",
    result: "5+: Gain 1 Speed. 0-4: Take 1 General damage.",
  },
  {
    name: "alien geometry",
    type: "event",
    todo: "Make a Knowledge roll",
    result: " 4+: Gain 1 Sanity. 0-3: Lose 1 Speed",
  },
  {
    name: "a moment of hope",
    type: "event",
    todo: "Place a blessing token on your tile.",
    result: "A hero on the same tile as the blessing token must roll an extra die on all trait rolls",
  },
  {
    name: "an eerie feeling", // MUST NOT BE AFFECTED BY ITEMS OR OMENS SPECIFIC TO TRAIT ROLLS
    type: "event",
    todo: "Roll 2 dice.",
    result: "4: Nothing happens. 3: Lose 1 speed. 2: Lose 1 Sanity. 1: lose 1 Knowledge. 0: Lose 1 Might.",
  },
  {
    name: "a secret passage",
    type: "event",
    todo: "Place a secret passage token on your tile. Make a Knowledge roll.",
    result:
      "5+: Place another secret Passage token on any other tile. Gain 1 knowledge. 3-4: Place another Secret Passage token on any Ground Floor tile. 0-2: Place another Secret Passage token on any Basement Tile. Lose 1 Sanity.",
  },
  {
    name: "a splash of crimson",
    type: "event",
    todo: "If the haunt has not started, you may make a haunt roll",
    result:
      "5+: Turn to haunt 1 in the TRAITORS TOME. You are the traitor. 0-4: Gain 1 Speed. If the haunt has started or if you choose not to make a haunt roll, take one die of Physical damage.",
  },
  {
    name: "a vial of dust",
    type: "event",
    todo: "If the haunt has not started, you may make a haunt roll",
    result:
      "5+: Turn to haunt 3 in the TRAITORS TOME. You are the haunt revealer. 0-4: Gain 1 Sanity. If the haunt has started or if you choose not to make a haunt roll, lose 1 Might and gain 1 Sanity.",
  },
  {
    name: "bat out of hell",
    type: "event",
    todo: "Make a Speed roll",
    result: "4+: Place your explorer on an adjacent tile. 0-3: Take 1 Physical damage.",
  },
  {
    name: "behind you!",
    type: "event",
    todo: "Make a Speed roll",
    result: "4+: Gain 1 Sanity. 0-3: Take 1 Physical damage.",
  },
  {
    name: "brain food",
    type: "event",
    todo: "Make a Might roll",
    result: "5+: Gain 1 Might or Speed. 1-4: Gain 1 Speed and lose 1 Sanity. 0: Take 2 General damage.",
  },
  {
    name: "burning figure",
    type: "event",
    todo: "Make a Sanity roll",
    result:
      "4+: Gain 1 Sanity. 2-3: Place your explorer on the Entrance Hall. 0-1: Take 1 die of Physical damage and 1 die of Mental damage.",
  },
  {
    name: "cassette player",
    type: "event",
    todo: "Make a Sanity roll",
    result: "4+: Gain 1 knowledge. 0-3: Take 1 Mental damage.",
  },
  {
    name: "clown room",
    type: "event",
    todo: "Make a Sanity roll",
    result: "4+: Nothing happens. 0-3: Take 2 Mental damage.",
  },
  {
    name: "creaking door",
    type: "event",
    todo: "Make a Knowledge roll",
    result:
      "6+: Place your explorer on any Upper or Ground Floor tile. 4-5: Place your explorer on any Ground Floor tile. 0-3: Place your explorer on the Basement Landing tile.",
  },
  {
    name: "dark and stormy night",
    type: "event",
    todo: " Make a Knowledge roll",
    result: "4+: Gain 1 Sanity. 0-3: Take 1 Mental damage.",
  },
  {
    name: "eerie mirror",
    type: "event",
    todo: "If the haunt has not started, you may make a haunt roll",
    result:
      "5+: Turn to haunt 7 in the SECRETS OF SURVIVAL book. this haunt has no traitor. you are the haunt revealer. 0-4: Gain 1 Sanity. If the haunt has started or if you choose not to make a haunt roll, draw an item card.",
  },
  {
    name: "flickering lights",
    type: "event",
    todo: "Make a Speed or Might roll",
    result: "5+: Gain 1 Speed. 0-4: Take one die of Physical damage.",
  },
  {
    name: "forbidden knowledge",
    type: "event",
    todo: "Make a Sanity roll",
    result: "4+: Gain 1 Knowledge. 2-3: Gain 1 Knowledge and lose 1 Sanity. 0-1: Take 2 Mental damage",
  },
  {
    name: "funeral",
    type: "event",
    todo: "Make a Sanity roll",
    result:
      "4+: Gain 1 Sanity. 2-3 Lose 1 Sanity. 0-1: Lose 1 Sanity and 1 Might. If the Graveyard or Catacombs tiles have been discovered, place your explorer on one of those tiles.",
  },
  {
    name: "hanged man",
    type: "event",
    todo: "Roll each trait, one at a time.",
    result: "2+: Nothing happens. 0-1: Lose 1 from that trait. If you roll 2+ on all four rolls, gain 1 in any trait.",
  },

  {
    name: "impossible architecture",
    type: "event",
    todo: "Make a Sanity roll",
    result: "4+: Nothing happens. 0-3: Take 1 die of Mental damage.",
  },
  {
    name: "jar of organs",
    type: "event",
    todo: "Make a Sanity roll",
    result: "4+: Draw an Item card. 0-3: Lose 1 Might.",
  },
  {
    name: "jonah's turn",
    type: "event",
    todo: "You may discard any Item card that is not a weapon.",
    result: "If you do, gain 1 Sanity. Otherwise, take one die of Mental damage.",
  },
  {
    name: "meat moss",
    type: "event",
    todo: "You may inhale the scent. If you do, roll 2 dice.",
    result: "3-4: Gain 1 in any trait. 0-2: Take one die of Mental damage.",
  },
  {
    name: "mysterious fluid",
    type: "event",
    todo: "You may drink the fluid. If you do, roll 3 dice.",
    result:
      "6: Gain 1 in each trait. 5: Gain 1 Might and 1 Speed. 4: Gain 1 Knowledge and 1 Sanity. 3: Gain 1 knowledge and lose 1 Might. 2: Lose 1 Knowledge and 1 Sanity. 1: Lose 1 Might and 1 Speed. 0: Lose 1 in each trait.",
  },
  {
    name: "phone call",
    type: "event",
    todo: "Roll 2 dice.",
    result:
      "4+: Gain 1 Sanity. 3: Gain 1 Knowledge. 1-2: Take one die of Mental damage. 0: Take two dice of Physical damage.",
  },
  {
    name: "poor yorick",
    type: "event",
    todo: "Make a Sanity roll.",
    result: "4+: Gain 1 Knowledge. 0-3: Take 1 Mental damage.",
  },
  {
    name: "radio broadcast",
    type: "event",
    todo: "Roll 2 dice.",
    result: " 3-4: Gain 1 Knowledge. 0-2: Take one die of Mental damage.",
  },
  {
    name: "say cheese",
    type: "event",
    todo: "If the haunt has not started, you may make a haunt roll.",
    result:
      "5+: Turn to haunt 33 in the TRAITOR'S TOME. If a hero has the Magic Camera, they are the traitor. Otherwise, you are the traitor. 0-4: Draw an Item card. If the haunt has started, or you chose not to make a haunt roll, draw an Item card.",
  },
  {
    name: "secret elevator",
    type: "event",
    todo: "You find a dumbwaiter. You may choose to crawl inside.",
    result: "If you do, you may place yourself on any tile in a different region",
  },
  {
    name: "severed hand",
    type: "event",
    todo: "You may take 2 Physical damage.",
    result: "If you do, draw an Item card.",
  },
  {
    name: "spiders",
    type: "event",
    todo: "Make a Sanity roll",
    result:
      "4+: Gain 1 Sanity or Speed. Place your explorer on an adjacent tile. 2-3: Gain 1 Speed and lose 1 Sanity. 0-1: Lose 1 speed.",
  },
  {
    name: "taxidermy",
    type: "event",
    todo: "Make a Might roll",
    result: "5+: Gain 1 Sanity. 0-4: Take 1 Physical damage. Place and Obstacle token on this tile.",
  },
  {
    name: "technical difficulties",
    type: "event",
    todo: "Place your explorer on the Landing of the Floor below. If you are already in the Basement, place your explorer on the Upper Landing instead and take 1 Mental damage.",
    result: "",
  },
  {
    name: "the deepest closet",
    type: "event",
    todo: "Make a Speed roll",
    result:
      " 4+: Draw an Item card. 1-3: Take 1 Mental damage. 0: Take one die of Physical damage. place your explorer on the Basement Landing.",
  },
  {
    name: "the flowering",
    type: "event",
    todo: "Take one General damage. Place your explorer on any Basement or Ground floor tile. If the Conservatory tile has been discovered, you must place your explorer there.",
    result: "",
  },
  {
    name: "the house is hungry",
    type: "event",
    todo: "If the haunt has not started, you may make a haunt roll.",
    result:
      "5+: Turn to haunt 12 in the TRAITOR'S TOME. This haunt has no traitor. You are the haunt revealer. 0-4: Gain 1 Might. If the haunt has starter or you chose not to make a haunt roll, gain 1 in any trait.",
  },
  {
    name: "the oldest house",
    type: "event",
    todo: "Make a Speed or Might roll",
    result:
      "5+: Place your explorer on any tile. 3-4: Place your explorer on any Ground Floor tile. Take 1 General damage. 0-2: Place your explorer on any Basement tile. Take 1 Mental damage.",
  },
  {
    name: "The stars at night",
    type: "event",
    todo: "Choose a trait to roll",
    result: "5+: Gain 1 in the chosen trait. 4: Lose 1 in the chosen trait. 0-3: Heal the chosen trait.",
  },
  {
    name: "tiny robot",
    type: "event",
    todo: "Make a knowledge roll",
    result: "5+: Draw an Item card 0-4: Take one die of Physical damage.",
  },
  {
    name: "wandering ghost",
    type: "event",
    todo: "You may bury one of your items. If you do, gain 1 in any trait. Otherwise, make a Sanity roll.",
    result: "4+: Draw an Item card 0-3: Take 1 General damage.",
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
