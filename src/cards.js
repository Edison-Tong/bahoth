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
    passiveAbility: "Whenever you take physical damage, reduce the damage by one",
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
    activeAbilityRule: { trigger: "trait-roll-required", action: "substitute-knowledge-for-trait" },
    activeAbility:
      "Once during your turn, you may use the book to lose 1 Sanity. On the next trait roll you make this turn that isn't an attack, you may use your knowledge in place of the named trait.",
  },
  {
    id: "dagger",
    name: "Dagger",
    activeAbilityRule: {
      trigger: "attack",
      action: "optional-speed-loss-for-attack-dice",
      costStat: "speed",
      costAmount: 1,
      bonusDice: 2,
    },
    activeAbility: "When you attack, you may lose 1 Speed. If you do, roll 2 extra dice on that attack.",
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
    activeAbilityRule: { trigger: "on-your-turn", action: "dog-remote-trade" },
    activeAbility:
      "Once during your turn, you may use the Dog to trade any number of Items with another explorer up to 4 tiles away, using normal trading rules.",
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
    activeAbilityRule: { trigger: "on-your-turn", action: "holy-symbol-bury-discovered-tile" },
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
    activeAbility: "When you discover a tile with an Event symbol, you may choose to not draw an Event card.", //NOTE: THE OMEN WORKS DIFFERENTLY BY ACTUALLY POPPING UP BEFORE DRAWING AN EVENT CARD INSTEAD OF BEING A USE NOW BUTTON IN THE PLAYERS INVENTORY. THIS WAS DONE JUST BECAUSE THERE IS NOT A CONVINIENT SPOT THAT ALLOWS THE PALYER TO ACTIVATE THE ABILITY ON THEIR OWN
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
    activeAbilityRule: { trigger: "on-your-turn", action: "mask-push-adjacent-players" },
    activeAbility:
      "Once during your turn, you may use the Mask to move everyone else on your tile to an adjacent tile (including linked stair tiles). This effect may not be used to discover new tiles.",
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
    activeAbilityRule: {
      trigger: "attack",
      action: "sanity-combat",
    },
    activeAbility:
      "When you use the ring to attack, you and the defender each roll Sanity instead of Might. The loser takes Mental damage.",
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
  {
    id: "angels-feather",
    name: "Angel's Feather",
    subtype: "trait-roll",
    isWeapon: false,
    activeAbilityRule: {
      trigger: "trait-roll-required",
      action: "set-trait-roll-total",
      valueSelection: "number-0-8",
    },
    activeAbility:
      "When you are required to make a trait roll, you may instead bury Angel's Feather. If you do, choose a number from 0-8. Use that number as the result of the required roll.",
  },
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
  {
    id: "chainsaw",
    name: "Chainsaw",
    isWeapon: true,
    activeAbilityRule: { trigger: "attack", action: "attack-bonus-die" },
    activeAbility: "When you use the Chainsaw to attack, add one die to your attack.",
  },
  {
    id: "creepy-doll",
    name: "Creepy Doll",
    subtype: "trait-roll",
    isWeapon: false,
    activeAbilityRule: { trigger: "trait-roll-just-made", action: "reroll-all-trait-dice" },
    activeAbility: "Once during your turn, you may reroll all dice on a trait roll you just made. Then lose 1 Sanity.",
  },
  {
    id: "crossbow",
    name: "Crossbow",
    isWeapon: true,
    activeAbilityRule: { trigger: "attack", action: "ranged-attack-speed" },
    activeAbility:
      "When you use the Crossbow to attack, you may attack any character on your tile or an adjacent tile. You and the defender each roll Speed. Roll 1 extra die on the attack. If you lose, you take no damage.",
  },
  {
    id: "dynamite",
    name: "Dynamite",
    isWeapon: true,
    activeAbilityRule: { trigger: "on-your-turn", action: "dynamite-aoe-attack" },
    activeAbility:
      "You may use Dynamite in place of a regular attack. To do so, bury it and then choose your tile or an adjacent one. Everyone on the chosen tile must make a Speed roll. 4+: Nothing happens. 0-3: Take 4 Physical damage.",
  },
  {
    id: "first-aid-kit",
    name: "First Aid Kit",
    isWeapon: false,
    activeAbilityRule: {
      trigger: "on-your-turn",
      action: "heal-stats",
      target: "critical",
      consume: "bury-self",
    },
    activeAbility:
      "On your turn, you may bury the First Aid Kit. If you do, heal all of your critical traits. You may also use the First Aid Kit to heal another explorer on your tile.",
  },
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
  {
    id: "gun",
    name: "Gun",
    isWeapon: true,
    activeAbilityRule: { trigger: "attack", action: "gun-ranged-attack" },
    activeAbility:
      "When you use the Gun to attack, you may attack any target in line of sight. You and the defender each roll Speed. If you lose, you take no damage.",
  },
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
  {
    id: "lucky-coin",
    name: "Lucky Coin",
    isWeapon: false,
    activeAbilityRule: { trigger: "trait-roll-just-made", action: "reroll-blank-trait-dice" },
    activeAbility:
      "Once during your turn, you may reroll all blank dice on a trait roll you just made. For each blank die on the reroll, take 1 Mental damage.",
  },
  {
    id: "machete",
    name: "Machete",
    isWeapon: true,
    activeAbilityRule: { trigger: "attack", action: "attack-bonus-total" },
    activeAbility: "When you use the Machete to attack, add 1 to the result of your roll.",
  },
  {
    id: "magic-camera",
    name: "Magic Camera",
    isWeapon: false,
    activeAbilityRule: { trigger: "trait-roll-required", action: "substitute-sanity-for-knowledge" },
    activeAbility: "You may use your Sanity to make Knowledge rolls.",
  },
  {
    id: "map",
    name: "Map",
    isWeapon: false,
    activeAbilityRule: { trigger: "on-your-turn", action: "teleport-any-tile" },
    activeAbility: "On your turn, you may bury the Map. If you do, place your explorer on any tile.",
  },
  {
    id: "mirror",
    name: "Mirror",
    isWeapon: false,
    activeAbilityRule: { trigger: "on-your-turn", action: "heal-knowledge-sanity" },
    activeAbility: "On your turn, you may bury the Mirror. If you do, heal your Knowledge and Sanity.",
  },
  {
    id: "mystical-stopwatch",
    name: "Mystical Stopwatch",
    isWeapon: false,
    activeAbilityRule: { trigger: "on-your-turn", action: "extra-turn-after-current" },
    activeAbility:
      "On your turn, you may bury the Mystical Stopwatch. If you do, take another turn after this one. You may only use this ability after the haunt has started.",
  },
  {
    id: "necklace-of-teeth",
    name: "Necklace of Teeth",
    isWeapon: false,
    passiveEffects: [{ type: "end-turn-gain-critical-trait" }],
    passiveAbility: "At the end of your turn, you may gain 1 in a critical trait of your choice.",
  },
  {
    id: "rabbits-foot",
    name: "Rabbit's Foot",
    isWeapon: false,
    activeAbilityRule: { trigger: "die-just-rolled", action: "reroll-one-die" },
    activeAbility: "Once during your turn, you may reroll 1 die that you just rolled.",
  },
  {
    id: "skeleton-key",
    name: "Skeleton Key",
    isWeapon: false,
    activeAbilityRule: { trigger: "on-your-turn", action: "move-through-walls" },
    activeAbility:
      "You may move through walls. Whenever you do so, roll 1 die. If you roll a blank, bury the Skeleton Key. You may not use the Skeleton Key to discover new rooms.",
  },
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
  {
    id: "strange-medicine",
    name: "Strange Medicine",
    isWeapon: false,
    activeAbilityRule: { trigger: "on-your-turn", action: "heal-might-speed" },
    activeAbility: "On your turn, you may bury the Strange Medicine. If you do, heal your Might and your Speed.",
  },
];

const createEventEffect = (type, details = {}) => ({ type, ...details });

const createEventOutcome = (when, effects = []) => ({
  when,
  effects: Array.isArray(effects) ? effects : [effects],
});

const createEventStep = (kind, details = {}) => ({ kind, ...details });

const createEventCard = ({ steps, tags, ...card }) => ({
  type: "event",
  ...card,
  ...(tags ? { tags } : {}),
  steps,
});

// // FOR TESTING ONLY
// const TEST_ALL_STATS_ADJUST_OPTIONS = ["gain-any", "lose-any"];

// const createAllStatsAdjustEffects = () => [
//   createEventStep("effect", {
//     onlyIf: { choice: { step: "all-stats-adjustment", equals: "gain-any" } },
//     effects: [
//       createEventEffect("stat-choice", {
//         mode: "gain",
//         options: ["might", "speed", "knowledge", "sanity"],
//         amountType: "up-to-max",
//       }),
//     ],
//   }),
//   createEventStep("effect", {
//     onlyIf: { choice: { step: "all-stats-adjustment", equals: "lose-any" } },
//     effects: [createEventEffect("damage", { damageType: "general", amountType: "up-to-max" })],
//   }),
// ];
// // FOR TESTING ONLY

export const EVENT_CARDS = [
  // createEventCard({
  //   id: "test-event", // FOR TESTING ONLY
  //   name: "Test Event Sandbox",
  //   todo: "Choose a scenario to test.",
  //   result:
  //     "Pick one branch: Trait roll, Dice roll, Trait sequence, Stat choice, Item choice, Move choice, Token choice, Damage sequence, or All-stats adjust.",
  //   steps: [
  //     createEventStep("choice", {
  //       id: "scenario",
  //       prompt: "Choose a test scenario.",
  //       options: [
  //         "trait-roll",
  //         "dice-roll",
  //         "trait-roll-sequence",
  //         "stat-choice",
  //         "item-choice",
  //         "tile-choice-move",
  //         "tile-choice-token",
  //         "damage-sequence",
  //         "all-stats-adjust",
  //       ],
  //     }),
  //     createEventStep("choice", {
  //       id: "all-stats-adjustment",
  //       onlyIf: { choice: { step: "scenario", equals: "all-stats-adjust" } },
  //       prompt: "Choose gain/lose amount (0-8).",
  //       options: TEST_ALL_STATS_ADJUST_OPTIONS,
  //     }),
  //     createEventStep("trait-roll", {
  //       id: "test-trait-roll",
  //       onlyIf: { choice: { step: "scenario", equals: "trait-roll" } },
  //       chooseFrom: ["might", "speed", "knowledge", "sanity"],
  //       outcomes: [
  //         createEventOutcome(
  //           { roll: { min: 4 } },
  //           createEventEffect("stat-change", { mode: "gain", stat: "chosen", amount: 1 })
  //         ),
  //         createEventOutcome(
  //           { roll: { exact: 3 } },
  //           createEventEffect("stat-change", { mode: "lose", stat: "chosen", amount: 1 })
  //         ),
  //         createEventOutcome({ roll: { max: 2 } }, createEventEffect("damage", { damageType: "general", amount: 1 })),
  //       ],
  //     }),
  //     createEventStep("dice-roll", {
  //       onlyIf: { choice: { step: "scenario", equals: "dice-roll" } },
  //       dice: 2,
  //       outcomes: [
  //         createEventOutcome({ roll: { min: 3 } }, createEventEffect("draw-card", { deck: "item", amount: 1 })),
  //         createEventOutcome(
  //           { roll: { max: 2 } },
  //           createEventEffect("damage", { damageType: "mental", amountType: "dice", dice: 1 })
  //         ),
  //       ],
  //     }),
  //     createEventStep("trait-roll-sequence", {
  //       onlyIf: { choice: { step: "scenario", equals: "trait-roll-sequence" } },
  //       stats: ["might", "speed", "sanity", "knowledge"],
  //       outcomes: [
  //         createEventOutcome(
  //           { allRolls: { min: 2 } },
  //           createEventEffect("stat-change", { mode: "gain", stat: "sanity", amount: 1 })
  //         ),
  //       ],
  //     }),
  //     createEventStep("effect", {
  //       onlyIf: { choice: { step: "scenario", equals: "stat-choice" } },
  //       effects: [
  //         createEventEffect("stat-choice", {
  //           mode: "gain",
  //           options: ["might", "speed", "knowledge", "sanity"],
  //           amount: 2,
  //         }),
  //       ],
  //     }),
  //     createEventStep("effect", {
  //       onlyIf: { choice: { step: "scenario", equals: "item-choice" } },
  //       effects: [createEventEffect("bury-item", { filter: "any-item" })],
  //     }),
  //     createEventStep("effect", {
  //       onlyIf: { choice: { step: "scenario", equals: "tile-choice-move" } },
  //       effects: [createEventEffect("move", { destination: "any-tile" })],
  //     }),
  //     createEventStep("effect", {
  //       onlyIf: { choice: { step: "scenario", equals: "tile-choice-token" } },
  //       effects: [createEventEffect("place-token", { token: "obstacle", location: "any-other-tile" })],
  //     }),
  //     createEventStep("effect", {
  //       onlyIf: { choice: { step: "scenario", equals: "damage-sequence" } },
  //       effects: [
  //         createEventEffect("damage", { damageType: "physical", amountType: "dice", dice: 1 }),
  //         createEventEffect("damage", { damageType: "mental", amountType: "dice", dice: 1 }),
  //       ],
  //     }),
  //     ...createAllStatsAdjustEffects(),
  //   ],
  // }),
  createEventCard({
    id: "a-bite",
    name: "A Bite!",
    todo: "Make a Might roll",
    result: "4+: Nothing happens. 2-3: Take 1 Physical damage. 0-1: Take 3 Physical damage.",
    steps: [
      createEventStep("trait-roll", {
        stat: "might",
        outcomes: [
          createEventOutcome({ roll: { min: 4 } }),
          createEventOutcome(
            { roll: { min: 2, max: 3 } },
            createEventEffect("damage", { damageType: "physical", amount: 1 })
          ),
          createEventOutcome({ roll: { max: 1 } }, createEventEffect("damage", { damageType: "physical", amount: 3 })),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "a-cry-for-help",
    name: "A Cry for Help",
    todo: "Make a Knowledge roll",
    result: "4+: Place your explorer on any tile in your region. 0-3: Take 1 Mental damage.",
    steps: [
      createEventStep("trait-roll", {
        stat: "knowledge",
        outcomes: [
          createEventOutcome(
            { roll: { min: 4 } },
            createEventEffect("move", { destination: "any-tile-in-current-region" })
          ),
          createEventOutcome({ roll: { max: 3 } }, createEventEffect("damage", { damageType: "mental", amount: 1 })),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "a-full-table",
    name: "A Full Table",
    todo: "Make a Knowledge or Sanity roll",
    result: "5+: Gain 1 Speed. 0-4: Take 1 General damage.",
    steps: [
      createEventStep("trait-roll", {
        chooseFrom: ["knowledge", "sanity"],
        outcomes: [
          createEventOutcome(
            { roll: { min: 5 } },
            createEventEffect("stat-change", { mode: "gain", stat: "speed", amount: 1 })
          ),
          createEventOutcome({ roll: { max: 4 } }, createEventEffect("damage", { damageType: "general", amount: 1 })),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "alien-geometry",
    name: "Alien Geometry",
    todo: "Make a Knowledge roll",
    result: "4+: Gain 1 Sanity. 0-3: Lose 1 Speed.",
    steps: [
      createEventStep("trait-roll", {
        stat: "knowledge",
        outcomes: [
          createEventOutcome(
            { roll: { min: 4 } },
            createEventEffect("stat-change", { mode: "gain", stat: "sanity", amount: 1 })
          ),
          createEventOutcome(
            { roll: { max: 3 } },
            createEventEffect("stat-change", { mode: "lose", stat: "speed", amount: 1 })
          ),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "a-moment-of-hope",
    name: "A Moment of Hope",
    todo: "Place a blessing token on your tile.",
    result: "A hero on the same tile as the blessing token must roll an extra die on all trait rolls.",
    steps: [
      createEventStep("effect", {
        effects: [
          createEventEffect("place-token", { token: "blessing", location: "current-tile" }),
          createEventEffect("grant-bonus", {
            bonusType: "extra-die",
            amount: 1,
            appliesTo: "trait-rolls",
            whileOnTileWithToken: "blessing",
          }),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "an-eerie-feeling",
    name: "An Eerie Feeling",
    todo: "Roll 2 dice.",
    result: "4: Nothing happens. 3: Lose 1 Speed. 2: Lose 1 Sanity. 1: Lose 1 Knowledge. 0: Lose 1 Might.",
    tags: ["ignore-trait-roll-passives"],
    steps: [
      createEventStep("dice-roll", {
        dice: 2,
        usePassives: false,
        outcomes: [
          createEventOutcome({ roll: { exact: 4 } }),
          createEventOutcome(
            { roll: { exact: 3 } },
            createEventEffect("stat-change", { mode: "lose", stat: "speed", amount: 1 })
          ),
          createEventOutcome(
            { roll: { exact: 2 } },
            createEventEffect("stat-change", { mode: "lose", stat: "sanity", amount: 1 })
          ),
          createEventOutcome(
            { roll: { exact: 1 } },
            createEventEffect("stat-change", { mode: "lose", stat: "knowledge", amount: 1 })
          ),
          createEventOutcome(
            { roll: { exact: 0 } },
            createEventEffect("stat-change", { mode: "lose", stat: "might", amount: 1 })
          ),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "a-secret-passage",
    name: "A Secret Passage",
    todo: "Place a secret passage token on your tile. Make a Knowledge roll.",
    result:
      "5+: Place another Secret Passage token on any other tile and gain 1 Knowledge. 3-4: Place another Secret Passage token on any Ground Floor tile. 0-2: Place another Secret Passage token on any Basement tile and lose 1 Sanity.",
    steps: [
      createEventStep("effect", {
        effects: [createEventEffect("place-token", { token: "secret-passage", location: "current-tile" })],
      }),
      createEventStep("trait-roll", {
        stat: "knowledge",
        outcomes: [
          createEventOutcome({ roll: { min: 5 } }, [
            createEventEffect("place-token", { token: "secret-passage", location: "any-other-tile" }),
            createEventEffect("stat-change", { mode: "gain", stat: "knowledge", amount: 1 }),
          ]),
          createEventOutcome(
            { roll: { min: 3, max: 4 } },
            createEventEffect("place-token", { token: "secret-passage", location: "any-ground-floor-tile" })
          ),
          createEventOutcome({ roll: { max: 2 } }, [
            createEventEffect("place-token", { token: "secret-passage", location: "any-basement-tile" }),
            createEventEffect("stat-change", { mode: "lose", stat: "sanity", amount: 1 }),
          ]),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "a-splash-of-crimson",
    name: "A Splash of Crimson",
    todo: "If the haunt has not started, you may make a haunt roll.",
    result:
      "5+: Turn to haunt 1 in the Traitor's Tome. You are the traitor. 0-4: Gain 1 Speed. If the haunt has started or you choose not to make a haunt roll, take one die of Physical damage.",
    steps: [
      createEventStep("choice", {
        id: "make-haunt-roll",
        prompt: "Make a haunt roll?",
        options: ["yes", "no"],
        onlyIf: { hauntStarted: false },
      }),
      createEventStep("effect", {
        when: {
          anyOf: [{ hauntStarted: true }, { choice: { step: "make-haunt-roll", equals: "no" } }],
        },
        effects: [createEventEffect("damage", { damageType: "physical", amountType: "dice", dice: 1 })],
      }),
      createEventStep("haunt-roll", {
        when: { choice: { step: "make-haunt-roll", equals: "yes" } },
        outcomes: [
          createEventOutcome(
            { roll: { min: 5 } },
            createEventEffect("start-haunt", { hauntNumber: 1, book: "traitors-tome", role: "traitor" })
          ),
          createEventOutcome(
            { roll: { max: 4 } },
            createEventEffect("stat-change", { mode: "gain", stat: "speed", amount: 1 })
          ),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "a-vial-of-dust",
    name: "A Vial of Dust",
    todo: "If the haunt has not started, you may make a haunt roll.",
    result:
      "5+: Turn to haunt 3 in the Traitor's Tome. You are the haunt revealer. 0-4: Gain 1 Sanity. If the haunt has started or you choose not to make a haunt roll, lose 1 Might and gain 1 Sanity.",
    steps: [
      createEventStep("choice", {
        id: "make-haunt-roll",
        prompt: "Make a haunt roll?",
        options: ["yes", "no"],
        onlyIf: { hauntStarted: false },
      }),
      createEventStep("effect", {
        when: {
          anyOf: [{ hauntStarted: true }, { choice: { step: "make-haunt-roll", equals: "no" } }],
        },
        effects: [
          createEventEffect("stat-change", { mode: "lose", stat: "might", amount: 1 }),
          createEventEffect("stat-change", { mode: "gain", stat: "sanity", amount: 1 }),
        ],
      }),
      createEventStep("haunt-roll", {
        when: { choice: { step: "make-haunt-roll", equals: "yes" } },
        outcomes: [
          createEventOutcome(
            { roll: { min: 5 } },
            createEventEffect("start-haunt", { hauntNumber: 3, book: "traitors-tome", role: "haunt-revealer" })
          ),
          createEventOutcome(
            { roll: { max: 4 } },
            createEventEffect("stat-change", { mode: "gain", stat: "sanity", amount: 1 })
          ),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "bat-out-of-hell",
    name: "Bat Out of Hell",
    todo: "Make a Speed roll",
    result: "4+: Place your explorer on an adjacent tile. 0-3: Take 1 Physical damage.",
    steps: [
      createEventStep("trait-roll", {
        stat: "speed",
        outcomes: [
          createEventOutcome({ roll: { min: 4 } }, createEventEffect("move", { destination: "adjacent-tile" })),
          createEventOutcome({ roll: { max: 3 } }, createEventEffect("damage", { damageType: "physical", amount: 1 })),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "behind-you",
    name: "Behind You!",
    todo: "Make a Speed roll",
    result: "4+: Gain 1 Sanity. 0-3: Take 1 Physical damage.",
    steps: [
      createEventStep("trait-roll", {
        stat: "speed",
        outcomes: [
          createEventOutcome(
            { roll: { min: 4 } },
            createEventEffect("stat-change", { mode: "gain", stat: "sanity", amount: 1 })
          ),
          createEventOutcome({ roll: { max: 3 } }, createEventEffect("damage", { damageType: "physical", amount: 1 })),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "brain-food",
    name: "Brain Food",
    todo: "Make a Might roll",
    result: "5+: Gain 1 Might or Speed. 1-4: Gain 1 Speed and lose 1 Sanity. 0: Take 2 General damage.",
    steps: [
      createEventStep("trait-roll", {
        stat: "might",
        outcomes: [
          createEventOutcome(
            { roll: { min: 5 } },
            createEventEffect("stat-choice", { mode: "gain", options: ["might", "speed"], amount: 1 })
          ),
          createEventOutcome({ roll: { min: 1, max: 4 } }, [
            createEventEffect("stat-change", { mode: "gain", stat: "speed", amount: 1 }),
            createEventEffect("stat-change", { mode: "lose", stat: "sanity", amount: 1 }),
          ]),
          createEventOutcome({ roll: { exact: 0 } }, createEventEffect("damage", { damageType: "general", amount: 2 })),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "burning-figure",
    name: "Burning Figure",
    todo: "Make a Sanity roll",
    result:
      "4+: Gain 1 Sanity. 2-3: Place your explorer on the Entrance Hall. 0-1: Take 1 die of Physical damage and 1 die of Mental damage.",
    steps: [
      createEventStep("trait-roll", {
        stat: "sanity",
        outcomes: [
          createEventOutcome(
            { roll: { min: 4 } },
            createEventEffect("stat-change", { mode: "gain", stat: "sanity", amount: 1 })
          ),
          createEventOutcome({ roll: { min: 2, max: 3 } }, createEventEffect("move", { destination: "entrance-hall" })),
          createEventOutcome({ roll: { max: 1 } }, [
            createEventEffect("damage", { damageType: "physical", amountType: "dice", dice: 1 }),
            createEventEffect("damage", { damageType: "mental", amountType: "dice", dice: 1 }),
          ]),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "cassette-player",
    name: "Cassette Player",
    todo: "Make a Sanity roll",
    result: "4+: Gain 1 Knowledge. 0-3: Take 1 Mental damage.",
    steps: [
      createEventStep("trait-roll", {
        stat: "sanity",
        outcomes: [
          createEventOutcome(
            { roll: { min: 4 } },
            createEventEffect("stat-change", { mode: "gain", stat: "knowledge", amount: 1 })
          ),
          createEventOutcome({ roll: { max: 3 } }, createEventEffect("damage", { damageType: "mental", amount: 1 })),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "clown-room",
    name: "Clown Room",
    todo: "Make a Sanity roll",
    result: "4+: Nothing happens. 0-3: Take 2 Mental damage.",
    steps: [
      createEventStep("trait-roll", {
        stat: "sanity",
        outcomes: [
          createEventOutcome({ roll: { min: 4 } }),
          createEventOutcome({ roll: { max: 3 } }, createEventEffect("damage", { damageType: "mental", amount: 2 })),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "creaking-door",
    name: "Creaking Door",
    todo: "Make a Knowledge roll",
    result:
      "6+: Place your explorer on any Upper or Ground Floor tile. 4-5: Place your explorer on any Ground Floor tile. 0-3: Place your explorer on the Basement Landing tile.",
    steps: [
      createEventStep("trait-roll", {
        stat: "knowledge",
        outcomes: [
          createEventOutcome(
            { roll: { min: 6 } },
            createEventEffect("move", { destination: "any-upper-or-ground-floor-tile" })
          ),
          createEventOutcome(
            { roll: { min: 4, max: 5 } },
            createEventEffect("move", { destination: "any-ground-floor-tile" })
          ),
          createEventOutcome({ roll: { max: 3 } }, createEventEffect("move", { destination: "basement-landing" })),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "dark-and-stormy-night",
    name: "Dark and Stormy Night",
    todo: "Make a Knowledge roll",
    result: "4+: Gain 1 Sanity. 0-3: Take 1 Mental damage.",
    steps: [
      createEventStep("trait-roll", {
        stat: "knowledge",
        outcomes: [
          createEventOutcome(
            { roll: { min: 4 } },
            createEventEffect("stat-change", { mode: "gain", stat: "sanity", amount: 1 })
          ),
          createEventOutcome({ roll: { max: 3 } }, createEventEffect("damage", { damageType: "mental", amount: 1 })),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "eerie-mirror",
    name: "Eerie Mirror",
    todo: "If the haunt has not started, you may make a haunt roll.",
    result:
      "5+: Turn to haunt 7 in the Secrets of Survival book. This haunt has no traitor. You are the haunt revealer. 0-4: Gain 1 Sanity. If the haunt has started or you choose not to make a haunt roll, draw an Item card.",
    steps: [
      createEventStep("choice", {
        id: "make-haunt-roll",
        prompt: "Make a haunt roll?",
        options: ["yes", "no"],
        onlyIf: { hauntStarted: false },
      }),
      createEventStep("effect", {
        when: {
          anyOf: [{ hauntStarted: true }, { choice: { step: "make-haunt-roll", equals: "no" } }],
        },
        effects: [createEventEffect("draw-card", { deck: "item", amount: 1 })],
      }),
      createEventStep("haunt-roll", {
        when: { choice: { step: "make-haunt-roll", equals: "yes" } },
        outcomes: [
          createEventOutcome(
            { roll: { min: 5 } },
            createEventEffect("start-haunt", {
              hauntNumber: 7,
              book: "secrets-of-survival",
              role: "haunt-revealer",
              hasTraitor: false,
            })
          ),
          createEventOutcome(
            { roll: { max: 4 } },
            createEventEffect("stat-change", { mode: "gain", stat: "sanity", amount: 1 })
          ),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "flickering-lights",
    name: "Flickering Lights",
    todo: "Make a Speed or Might roll",
    result: "5+: Gain 1 Speed. 0-4: Take one die of Physical damage.",
    steps: [
      createEventStep("trait-roll", {
        chooseFrom: ["speed", "might"],
        outcomes: [
          createEventOutcome(
            { roll: { min: 5 } },
            createEventEffect("stat-change", { mode: "gain", stat: "speed", amount: 1 })
          ),
          createEventOutcome(
            { roll: { max: 4 } },
            createEventEffect("damage", { damageType: "physical", amountType: "dice", dice: 1 })
          ),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "forbidden-knowledge",
    name: "Forbidden Knowledge",
    todo: "Make a Sanity roll",
    result: "4+: Gain 1 Knowledge. 2-3: Gain 1 Knowledge and lose 1 Sanity. 0-1: Take 2 Mental damage.",
    steps: [
      createEventStep("trait-roll", {
        stat: "sanity",
        outcomes: [
          createEventOutcome(
            { roll: { min: 4 } },
            createEventEffect("stat-change", { mode: "gain", stat: "knowledge", amount: 1 })
          ),
          createEventOutcome({ roll: { min: 2, max: 3 } }, [
            createEventEffect("stat-change", { mode: "gain", stat: "knowledge", amount: 1 }),
            createEventEffect("stat-change", { mode: "lose", stat: "sanity", amount: 1 }),
          ]),
          createEventOutcome({ roll: { max: 1 } }, createEventEffect("damage", { damageType: "mental", amount: 2 })),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "funeral",
    name: "Funeral",
    todo: "Make a Sanity roll",
    result:
      "4+: Gain 1 Sanity. 2-3: Lose 1 Sanity. 0-1: Lose 1 Sanity and 1 Might. If the Graveyard or Catacombs tiles have been discovered, place your explorer on one of those tiles.",
    steps: [
      createEventStep("trait-roll", {
        stat: "sanity",
        outcomes: [
          createEventOutcome(
            { roll: { min: 4 } },
            createEventEffect("stat-change", { mode: "gain", stat: "sanity", amount: 1 })
          ),
          createEventOutcome(
            { roll: { min: 2, max: 3 } },
            createEventEffect("stat-change", { mode: "lose", stat: "sanity", amount: 1 })
          ),
          createEventOutcome({ roll: { max: 1 } }, [
            createEventEffect("stat-change", { mode: "lose", stat: "sanity", amount: 1 }),
            createEventEffect("stat-change", { mode: "lose", stat: "might", amount: 1 }),
          ]),
        ],
      }),
      createEventStep("effect", {
        when: { discoveredAny: ["graveyard", "catacombs"] },
        effects: [createEventEffect("move", { destination: "graveyard-or-catacombs" })],
      }),
    ],
  }),
  createEventCard({
    id: "hanged-man",
    name: "Hanged Man",
    todo: "Roll each trait, one at a time.",
    result: "2+: Nothing happens. 0-1: Lose 1 from that trait. If you roll 2+ on all four rolls, gain 1 in any trait.",
    steps: [
      createEventStep("trait-roll", {
        id: "hanged-roll-1",
        chooseFrom: ["might", "speed", "knowledge", "sanity"],
        excludeSelectedStats: true,
        outcomes: [
          createEventOutcome({ roll: { max: 1 } }, [
            createEventEffect("stat-change", { mode: "lose", stat: "rolled-trait", amount: 1 }),
            createEventEffect("record-context", { key: "hanged-man-any-failed", value: "yes" }),
          ]),
        ],
      }),
      createEventStep("trait-roll", {
        id: "hanged-roll-2",
        chooseFrom: ["might", "speed", "knowledge", "sanity"],
        excludeSelectedStats: true,
        outcomes: [
          createEventOutcome({ roll: { max: 1 } }, [
            createEventEffect("stat-change", { mode: "lose", stat: "rolled-trait", amount: 1 }),
            createEventEffect("record-context", { key: "hanged-man-any-failed", value: "yes" }),
          ]),
        ],
      }),
      createEventStep("trait-roll", {
        id: "hanged-roll-3",
        chooseFrom: ["might", "speed", "knowledge", "sanity"],
        excludeSelectedStats: true,
        outcomes: [
          createEventOutcome({ roll: { max: 1 } }, [
            createEventEffect("stat-change", { mode: "lose", stat: "rolled-trait", amount: 1 }),
            createEventEffect("record-context", { key: "hanged-man-any-failed", value: "yes" }),
          ]),
        ],
      }),
      createEventStep("trait-roll", {
        id: "hanged-roll-4",
        chooseFrom: ["might", "speed", "knowledge", "sanity"],
        excludeSelectedStats: true,
        outcomes: [
          createEventOutcome({ roll: { max: 1 } }, [
            createEventEffect("stat-change", { mode: "lose", stat: "rolled-trait", amount: 1 }),
            createEventEffect("record-context", { key: "hanged-man-any-failed", value: "yes" }),
          ]),
        ],
      }),
      createEventStep("effect", {
        when: { choiceAbsent: "hanged-man-any-failed" },
        effects: [
          createEventEffect("stat-choice", {
            mode: "gain",
            options: ["might", "speed", "knowledge", "sanity"],
            amount: 1,
          }),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "impossible-architecture",
    name: "Impossible Architecture",
    todo: "Make a Sanity roll",
    result: "4+: Nothing happens. 0-3: Take 1 die of Mental damage.",
    steps: [
      createEventStep("trait-roll", {
        stat: "sanity",
        outcomes: [
          createEventOutcome({ roll: { min: 4 } }),
          createEventOutcome(
            { roll: { max: 3 } },
            createEventEffect("damage", { damageType: "mental", amountType: "dice", dice: 1 })
          ),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "jar-of-organs",
    name: "Jar of Organs",
    todo: "Make a Sanity roll",
    result: "4+: Draw an Item card. 0-3: Lose 1 Might.",
    steps: [
      createEventStep("trait-roll", {
        stat: "sanity",
        outcomes: [
          createEventOutcome({ roll: { min: 4 } }, createEventEffect("draw-card", { deck: "item", amount: 1 })),
          createEventOutcome(
            { roll: { max: 3 } },
            createEventEffect("stat-change", { mode: "lose", stat: "might", amount: 1 })
          ),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "jonahs-turn",
    name: "Jonah's Turn",
    todo: "You may discard any Item card that is not a weapon.",
    result: "If you do, gain 1 Sanity. Otherwise, take one die of Mental damage.",
    steps: [
      createEventStep("choice", {
        id: "discard-item",
        prompt: "Discard a non-weapon Item card?",
        options: ["yes", "no"],
        disableIfEmpty: { yes: "non-weapon-item" },
      }),
      createEventStep("effect", {
        when: { choice: { step: "discard-item", equals: "yes" } },
        effects: [
          createEventEffect("discard-item", { filter: "non-weapon-item" }),
          createEventEffect("stat-change", { mode: "gain", stat: "sanity", amount: 1 }),
        ],
      }),
      createEventStep("effect", {
        when: { choice: { step: "discard-item", equals: "no" } },
        effects: [createEventEffect("damage", { damageType: "mental", amountType: "dice", dice: 1 })],
      }),
    ],
  }),
  createEventCard({
    id: "meat-moss",
    name: "Meat Moss",
    todo: "You may inhale the scent. If you do, roll 2 dice.",
    result: "3-4: Gain 1 in any trait. 0-2: Take one die of Mental damage.",
    steps: [
      createEventStep("choice", {
        id: "inhale-scent",
        prompt: "Inhale the scent?",
        options: ["yes", "no"],
      }),
      createEventStep("dice-roll", {
        when: { choice: { step: "inhale-scent", equals: "yes" } },
        dice: 2,
        outcomes: [
          createEventOutcome(
            { roll: { min: 3 } },
            createEventEffect("stat-choice", {
              mode: "gain",
              options: ["might", "speed", "knowledge", "sanity"],
              amount: 1,
            })
          ),
          createEventOutcome(
            { roll: { max: 2 } },
            createEventEffect("damage", { damageType: "mental", amountType: "dice", dice: 1 })
          ),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "mysterious-fluid",
    name: "Mysterious Fluid",
    todo: "You may drink the fluid. If you do, roll 3 dice.",
    result:
      "6: Gain 1 in each trait. 5: Gain 1 Might and 1 Speed. 4: Gain 1 Knowledge and 1 Sanity. 3: Gain 1 Knowledge and lose 1 Might. 2: Lose 1 Knowledge and 1 Sanity. 1: Lose 1 Might and 1 Speed. 0: Lose 1 in each trait.",
    steps: [
      createEventStep("choice", {
        id: "drink-fluid",
        prompt: "Drink the fluid?",
        options: ["yes", "no"],
      }),
      createEventStep("dice-roll", {
        when: { choice: { step: "drink-fluid", equals: "yes" } },
        dice: 3,
        outcomes: [
          createEventOutcome(
            { roll: { exact: 6 } },
            createEventEffect("stat-change", { mode: "gain", stat: "all", amount: 1 })
          ),
          createEventOutcome({ roll: { exact: 5 } }, [
            createEventEffect("stat-change", { mode: "gain", stat: "might", amount: 1 }),
            createEventEffect("stat-change", { mode: "gain", stat: "speed", amount: 1 }),
          ]),
          createEventOutcome({ roll: { exact: 4 } }, [
            createEventEffect("stat-change", { mode: "gain", stat: "knowledge", amount: 1 }),
            createEventEffect("stat-change", { mode: "gain", stat: "sanity", amount: 1 }),
          ]),
          createEventOutcome({ roll: { exact: 3 } }, [
            createEventEffect("stat-change", { mode: "gain", stat: "knowledge", amount: 1 }),
            createEventEffect("stat-change", { mode: "lose", stat: "might", amount: 1 }),
          ]),
          createEventOutcome({ roll: { exact: 2 } }, [
            createEventEffect("stat-change", { mode: "lose", stat: "knowledge", amount: 1 }),
            createEventEffect("stat-change", { mode: "lose", stat: "sanity", amount: 1 }),
          ]),
          createEventOutcome({ roll: { exact: 1 } }, [
            createEventEffect("stat-change", { mode: "lose", stat: "might", amount: 1 }),
            createEventEffect("stat-change", { mode: "lose", stat: "speed", amount: 1 }),
          ]),
          createEventOutcome(
            { roll: { exact: 0 } },
            createEventEffect("stat-change", { mode: "lose", stat: "all", amount: 1 })
          ),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "phone-call",
    name: "Phone Call",
    todo: "Roll 2 dice.",
    result:
      "4+: Gain 1 Sanity. 3: Gain 1 Knowledge. 1-2: Take one die of Mental damage. 0: Take two dice of Physical damage.",
    steps: [
      createEventStep("dice-roll", {
        dice: 2,
        outcomes: [
          createEventOutcome(
            { roll: { min: 4 } },
            createEventEffect("stat-change", { mode: "gain", stat: "sanity", amount: 1 })
          ),
          createEventOutcome(
            { roll: { exact: 3 } },
            createEventEffect("stat-change", { mode: "gain", stat: "knowledge", amount: 1 })
          ),
          createEventOutcome(
            { roll: { min: 1, max: 2 } },
            createEventEffect("damage", { damageType: "mental", amountType: "dice", dice: 1 })
          ),
          createEventOutcome(
            { roll: { exact: 0 } },
            createEventEffect("damage", { damageType: "physical", amountType: "dice", dice: 2 })
          ),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "poor-yorick",
    name: "Poor Yorick",
    todo: "Make a Sanity roll.",
    result: "4+: Gain 1 Knowledge. 0-3: Take 1 Mental damage.",
    steps: [
      createEventStep("trait-roll", {
        stat: "sanity",
        outcomes: [
          createEventOutcome(
            { roll: { min: 4 } },
            createEventEffect("stat-change", { mode: "gain", stat: "knowledge", amount: 1 })
          ),
          createEventOutcome({ roll: { max: 3 } }, createEventEffect("damage", { damageType: "mental", amount: 1 })),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "radio-broadcast",
    name: "Radio Broadcast",
    todo: "Roll 2 dice.",
    result: "3-4: Gain 1 Knowledge. 0-2: Take one die of Mental damage.",
    steps: [
      createEventStep("dice-roll", {
        dice: 2,
        outcomes: [
          createEventOutcome(
            { roll: { min: 3 } },
            createEventEffect("stat-change", { mode: "gain", stat: "knowledge", amount: 1 })
          ),
          createEventOutcome(
            { roll: { max: 2 } },
            createEventEffect("damage", { damageType: "mental", amountType: "dice", dice: 1 })
          ),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "say-cheese",
    name: "Say Cheese",
    todo: "If the haunt has not started, you may make a haunt roll.",
    result:
      "5+: Turn to haunt 33 in the Traitor's Tome. If a hero has the Magic Camera, they are the traitor. Otherwise, you are the traitor. 0-4: Draw an Item card. If the haunt has started or you choose not to make a haunt roll, draw an Item card.",
    steps: [
      createEventStep("choice", {
        id: "make-haunt-roll",
        prompt: "Make a haunt roll?",
        options: ["yes", "no"],
        onlyIf: { hauntStarted: false },
      }),
      createEventStep("effect", {
        when: {
          anyOf: [{ hauntStarted: true }, { choice: { step: "make-haunt-roll", equals: "no" } }],
        },
        effects: [createEventEffect("draw-card", { deck: "item", amount: 1 })],
      }),
      createEventStep("haunt-roll", {
        when: { choice: { step: "make-haunt-roll", equals: "yes" } },
        outcomes: [
          createEventOutcome(
            { roll: { min: 5 } },
            createEventEffect("start-haunt", {
              hauntNumber: 33,
              book: "traitors-tome",
              role: "traitor",
              specialTraitorRule: "hero-with-magic-camera-if-present", // NOTE: CHECK IF HAVING THE MAGIC CAMERA MAKES YOU TRAITOR
            })
          ),
          createEventOutcome({ roll: { max: 4 } }, createEventEffect("draw-card", { deck: "item", amount: 1 })),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "secret-elevator",
    name: "Secret Elevator",
    todo: "You find a dumbwaiter. You may choose to crawl inside.",
    result: "If you do, you may place yourself on any tile in a different region.",
    steps: [
      createEventStep("choice", {
        id: "crawl-inside",
        prompt: "Crawl inside?",
        options: ["yes", "no"],
      }),
      createEventStep("effect", {
        when: { choice: { step: "crawl-inside", equals: "yes" } },
        effects: [createEventEffect("move", { destination: "any-tile-in-different-region" })],
      }),
    ],
  }),
  createEventCard({
    id: "severed-hand",
    name: "Severed Hand",
    todo: "You may take 2 Physical damage.",
    result: "If you do, draw an Item card.",
    steps: [
      createEventStep("choice", {
        id: "take-damage",
        prompt: "Take 2 Physical damage?",
        options: ["yes", "no"],
      }),
      createEventStep("effect", {
        when: { choice: { step: "take-damage", equals: "yes" } },
        effects: [
          createEventEffect("damage", { damageType: "physical", amount: 2 }),
          createEventEffect("draw-card", { deck: "item", amount: 1 }),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "spiders",
    name: "Spiders",
    todo: "Make a Sanity roll",
    result:
      "4+: Gain 1 Sanity or Speed, then place your explorer on an adjacent tile. 2-3: Gain 1 Speed and lose 1 Sanity. 0-1: Lose 1 Speed.",
    steps: [
      createEventStep("trait-roll", {
        stat: "sanity",
        outcomes: [
          createEventOutcome({ roll: { min: 4 } }, [
            createEventEffect("stat-choice", { mode: "gain", options: ["sanity", "speed"], amount: 1 }),
            createEventEffect("move", { destination: "adjacent-tile" }),
          ]),
          createEventOutcome({ roll: { min: 2, max: 3 } }, [
            createEventEffect("stat-change", { mode: "gain", stat: "speed", amount: 1 }),
            createEventEffect("stat-change", { mode: "lose", stat: "sanity", amount: 1 }),
          ]),
          createEventOutcome(
            { roll: { max: 1 } },
            createEventEffect("stat-change", { mode: "lose", stat: "speed", amount: 1 })
          ),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "taxidermy",
    name: "Taxidermy",
    todo: "Make a Might roll",
    result: "5+: Gain 1 Sanity. 0-4: Take 1 Physical damage and place an Obstacle token on this tile.",
    steps: [
      createEventStep("trait-roll", {
        stat: "might",
        outcomes: [
          createEventOutcome(
            { roll: { min: 5 } },
            createEventEffect("stat-change", { mode: "gain", stat: "sanity", amount: 1 })
          ),
          createEventOutcome({ roll: { max: 4 } }, [
            createEventEffect("damage", { damageType: "physical", amount: 1 }),
            createEventEffect("place-token", { token: "obstacle", location: "current-tile" }),
          ]),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "technical-difficulties",
    name: "Technical Difficulties",
    todo: "Place your explorer on the Landing of the floor below. If you are already in the Basement, place your explorer on the Upper Landing instead and take 1 Mental damage.",
    result:
      "Upper Floor: place your explorer on the Entrance Hall. Ground Floor: place your explorer on the Basement Landing. Basement: place your explorer on the Upper Landing and take 1 Mental damage.",
    steps: [
      createEventStep("effect", {
        when: { currentFloor: "upper" },
        effects: [createEventEffect("move", { destination: "entrance-hall" })],
      }),
      createEventStep("effect", {
        when: { currentFloor: "ground" },
        effects: [createEventEffect("move", { destination: "basement-landing" })],
      }),
      createEventStep("effect", {
        when: { currentFloor: "basement" },
        effects: [
          createEventEffect("move", { destination: "upper-landing" }),
          createEventEffect("damage", { damageType: "mental", amount: 1 }),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "the-deepest-closet",
    name: "The Deepest Closet",
    todo: "Make a Speed roll",
    result:
      "4+: Draw an Item card. 1-3: Take 1 Mental damage. 0: Take one die of Physical damage and place your explorer on the Basement Landing.",
    steps: [
      createEventStep("trait-roll", {
        stat: "speed",
        outcomes: [
          createEventOutcome({ roll: { min: 4 } }, createEventEffect("draw-card", { deck: "item", amount: 1 })),
          createEventOutcome(
            { roll: { min: 1, max: 3 } },
            createEventEffect("damage", { damageType: "mental", amount: 1 })
          ),
          createEventOutcome({ roll: { exact: 0 } }, [
            createEventEffect("damage", { damageType: "physical", amountType: "dice", dice: 1 }),
            createEventEffect("move", { destination: "basement-landing" }),
          ]),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "the-flowering",
    name: "The Flowering",
    todo: "Take one General damage.",
    result:
      "If the Conservatory has been discovered, place your explorer there. Otherwise, place your explorer on any Basement or Ground Floor tile.",
    steps: [
      createEventStep("effect", {
        effects: [createEventEffect("damage", { damageType: "general", amount: 1 })],
      }),
      createEventStep("effect", {
        when: { discovered: "conservatory" },
        effects: [createEventEffect("move", { destination: "conservatory" })],
      }),
      createEventStep("effect", {
        when: { notDiscovered: "conservatory" },
        effects: [createEventEffect("move", { destination: "any-basement-or-ground-floor-tile" })],
      }),
    ],
  }),
  createEventCard({
    id: "the-house-is-hungry",
    name: "The House Is Hungry",
    todo: "If the haunt has not started, you may make a haunt roll.",
    result:
      "5+: Turn to haunt 12 in the Traitor's Tome. This haunt has no traitor. You are the haunt revealer. 0-4: Gain 1 Might. If the haunt has started or you choose not to make a haunt roll, gain 1 in any trait.",
    steps: [
      createEventStep("choice", {
        id: "make-haunt-roll",
        prompt: "Make a haunt roll?",
        options: ["yes", "no"],
        onlyIf: { hauntStarted: false },
      }),
      createEventStep("effect", {
        when: {
          anyOf: [{ hauntStarted: true }, { choice: { step: "make-haunt-roll", equals: "no" } }],
        },
        effects: [
          createEventEffect("stat-choice", {
            mode: "gain",
            options: ["might", "speed", "knowledge", "sanity"],
            amount: 1,
          }),
        ],
      }),
      createEventStep("haunt-roll", {
        when: { choice: { step: "make-haunt-roll", equals: "yes" } },
        outcomes: [
          createEventOutcome(
            { roll: { min: 5 } },
            createEventEffect("start-haunt", {
              hauntNumber: 12,
              book: "traitors-tome",
              role: "haunt-revealer",
              hasTraitor: false,
            })
          ),
          createEventOutcome(
            { roll: { max: 4 } },
            createEventEffect("stat-change", { mode: "gain", stat: "might", amount: 1 })
          ),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "the-oldest-house",
    name: "The Oldest House",
    todo: "Make a Speed or Might roll",
    result:
      "5+: Place your explorer on any tile. 3-4: Place your explorer on any Ground Floor tile and take 1 General damage. 0-2: Place your explorer on any Basement tile and take 1 Mental damage.",
    steps: [
      createEventStep("trait-roll", {
        chooseFrom: ["speed", "might"],
        outcomes: [
          createEventOutcome({ roll: { min: 5 } }, createEventEffect("move", { destination: "any-tile" })),
          createEventOutcome({ roll: { min: 3, max: 4 } }, [
            createEventEffect("move", { destination: "any-ground-floor-tile" }),
            createEventEffect("damage", { damageType: "general", amount: 1 }),
          ]),
          createEventOutcome({ roll: { max: 2 } }, [
            createEventEffect("move", { destination: "any-basement-tile" }),
            createEventEffect("damage", { damageType: "mental", amount: 1 }),
          ]),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "the-stars-at-night",
    name: "The Stars at Night",
    todo: "Choose a trait to roll",
    result: "5+: Gain 1 in the chosen trait. 4: Lose 1 in the chosen trait. 0-3: Heal the chosen trait.",
    steps: [
      createEventStep("trait-roll", {
        chooseFrom: ["might", "speed", "knowledge", "sanity"],
        outcomes: [
          createEventOutcome(
            { roll: { min: 5 } },
            createEventEffect("stat-change", { mode: "gain", stat: "chosen", amount: 1 })
          ),
          createEventOutcome(
            { roll: { exact: 4 } },
            createEventEffect("stat-change", { mode: "lose", stat: "chosen", amount: 1 })
          ),
          createEventOutcome({ roll: { max: 3 } }, createEventEffect("stat-change", { mode: "heal", stat: "chosen" })),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "tiny-robot",
    name: "Tiny Robot",
    todo: "Make a Knowledge roll",
    result: "5+: Draw an Item card. 0-4: Take one die of Physical damage.",
    steps: [
      createEventStep("trait-roll", {
        stat: "knowledge",
        outcomes: [
          createEventOutcome({ roll: { min: 5 } }, createEventEffect("draw-card", { deck: "item", amount: 1 })),
          createEventOutcome(
            { roll: { max: 4 } },
            createEventEffect("damage", { damageType: "physical", amountType: "dice", dice: 1 })
          ),
        ],
      }),
    ],
  }),
  createEventCard({
    id: "wandering-ghost",
    name: "Wandering Ghost",
    todo: "You may bury one of your Items. If you do, gain 1 in any trait. Otherwise, make a Sanity roll.",
    result:
      "If you bury an Item, gain 1 in any trait. Otherwise, make a Sanity roll: 4+ draw an Item card, 0-3 take 1 General damage.",
    steps: [
      createEventStep("choice", {
        id: "bury-item",
        prompt: "Bury one of your Items?",
        options: ["yes", "no"],
        disableIfEmpty: { yes: "item" },
      }),
      createEventStep("effect", {
        when: { choice: { step: "bury-item", equals: "yes" } },
        effects: [
          createEventEffect("bury-item", { filter: "any-item" }),
          createEventEffect("stat-choice", {
            mode: "gain",
            options: ["might", "speed", "knowledge", "sanity"],
            amount: 1,
          }),
        ],
      }),
      createEventStep("trait-roll", {
        when: { choice: { step: "bury-item", equals: "no" } },
        stat: "sanity",
        outcomes: [
          createEventOutcome({ roll: { min: 4 } }, createEventEffect("draw-card", { deck: "item", amount: 1 })),
          createEventOutcome({ roll: { max: 3 } }, createEventEffect("damage", { damageType: "general", amount: 1 })),
        ],
      }),
    ],
  }),
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
