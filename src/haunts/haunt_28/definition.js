// Full rules content and scenario definition for Haunt 28 "We're Going to Need a Bigger House".
// Scenario Card: Paranormal Investigators | Haunt Trigger: Idol | Traitor: Haunt Revealer
const haunt28Definition = {
  id: "haunt_28",
  title: "Haunt 28 - We're Going to Need a Bigger House",
  rulesBooklet: {
    header: {
      title: "We're Going to Need a Bigger House",
      meta: "Scenario Card: Paranormal Investigators • Haunt Trigger: Idol • Traitor: Haunt Revealer",
      number: "28",
    },
    heroes: {
      readFirst: {
        introduction:
          "You heard about the ghost through the mayor, who hired you to investigate but keep things quiet. The autopsy said that the homeowner was killed in a boating accident, but rumor has it that something more gruesome happened in this sleepy seaside town. As you investigate for signs of paranormal activity, tidal sounds begin to rise from somewhere in the house and your nostrils are flooded with the scent of saltwater.",
        setupSteps: [
          "The heroes have no additional setup steps.",
          "The player to the left of the traitor will take the first turn after setup.",
        ],
      },
      sidebarSections: [
        {
          heading: "Objective",
          paragraphs: ["You win when you blow up the Great White Ghost Shark."],
          bullets: [
            "Find Explosives and/or Dynamite.",
            "Summon the Shark to your space.",
            "Feed Explosives to the Shark.",
          ],
        },
        {
          heading: "Tokens Needed",
          bullets: ["Ghost Shark Token", "5 Trap Tokens — Explosives"],
        },
        {
          heading: "If You Win",
          paragraphs: [
            "You emerge from the house, soaked and covered in shark guts, but alive. Now that you're back on firm land, you're reminded why you never liked the water.",
          ],
        },
      ],
      actionGroup: {
        title: "Hero Once-Per-Turn Actions",
        actions: [
          {
            title: "Search for Explosives",
            lines: [
              "On any tile with an Item symbol, make a Speed roll.",
              "4+: Take a Trap token. These are Explosives.",
              "0–3: Nothing happens.",
            ],
          },
          {
            title: "Force Explosives down the Shark's Throat",
            lines: [
              "While on a tile with the Shark, make a Might roll.",
              "Discard any number of Trap tokens to add 2 to the result of your roll for each token discarded.",
              "If you have Dynamite, add 2 to the result of your roll.",
              "10+: You win! The shark explodes!",
              "0–9: Take 2 Physical damage and end your turn.",
            ],
          },
        ],
      },
      mainSections: [
        {
          heading: "Flipped Tiles",
          paragraphs: [
            "Tiles that have been flipped over are Flooded, and have doorways on all 4 sides. Flooded tiles do not have any symbols on them. Landings cannot be Flooded.",
          ],
        },
        {
          heading: "Explosives",
          paragraphs: ["Volatile. Explosives can be traded between heroes, using the normal trading rules."],
        },
      ],
    },
    traitor: {
      readFirst: {
        introduction:
          "The sound of the rushing tide surrounds you as the room floods with saltwater pouring out of the idol. As you tread water to stay afloat, you notice a ghostly fin emerge from the surface. It begins to circle around you… CHOMP!",
        setupSteps: [
          "Your explorer has been swallowed whole by a spectral shark. Place the Ghost Shark token on your tile. Remove your explorer and the Idol from the game. Bury any Items and Omens that your explorer had before they were swallowed.",
          "Place the Monster Card to your left. The monster will take its turn in place of yours.",
          "Flip over the tile that your explorer was on. Then, flip over {0/1/2/3} tiles in the same region. These tiles are Flooded.",
        ],
      },
      sidebarSections: [
        {
          heading: "Objective",
          paragraphs: ["You win when all of the heroes are dead, or if every tile in the house is Flooded."],
        },
        {
          heading: "Tokens Needed",
          bullets: ["Ghost Shark Token", "5 Trap Tokens — Explosives"],
        },
        {
          heading: "If You Win",
          paragraphs: [
            "You feast on the last morsels of your hot lunch. Your hunger sated, at least for now, you watch as the waters recede once again. With a toothy grin, you're satisfied in the knowledge that you remain Mayor of Shark City.",
          ],
        },
      ],
      actionGroup: {
        title: "Monster Once-Per-Turn Actions",
        isTraitor: true,
        actions: [
          {
            title: "Cue Ominous Music",
            lines: ["Move to any Flooded tile."],
          },
        ],
      },
      mainSections: [
        {
          heading: "At the start of each hero's turn",
          paragraphs: [
            "Flip over a non-landing tile adjacent to another Flooded tile. If you are unable to do so, Flood a tile adjacent to any landing.",
          ],
        },
        {
          heading: "At the end of your turn",
          paragraphs: ["If every tile in the house is Flooded, you win!"],
        },
      ],
      monsterCard: {
        heading: "Monster: Great White Ghost Shark",
        stats: {
          might: 8,
          speed: 2,
          sanity: 4,
          knowledge: 4,
        },
        paragraphs: ["The Shark cannot be stunned."],
      },
    },
  },
  summary:
    "The sound of the rushing tide surrounds you as the room floods with saltwater pouring out of the idol. A ghostly fin emerges from the surface… CHOMP!",
  introduction: {
    heroes:
      "You heard about the ghost through the mayor. Tidal sounds begin to rise from somewhere in the house and your nostrils are flooded with the scent of saltwater.",
    traitor:
      "The sound of the rushing tide surrounds you as the room floods. A ghostly fin emerges from the surface. It begins to circle around you… CHOMP!",
  },
  setup: {
    heroes: [
      "The heroes have no additional setup steps.",
      "The player to the left of the traitor takes the first turn after setup.",
    ],
    traitor: [
      "Place the Ghost Shark token on the haunt revealer's tile. Remove their explorer and the Idol from the game. Bury any Items and Omens they had.",
      "Flood the haunt revealer's starting tile plus {0/1/2/3} additional tiles in the same region based on player count.",
    ],
  },
  objectives: {
    heroes: "Blow up the Great White Ghost Shark by forcing Explosives down its throat.",
    traitor: "Kill all heroes, or Flood every tile in the house.",
  },
  tokens: {
    required: ["ghost-shark", "explosive"],
  },
  mechanics: {
    combat: true,
    monsterIsImmuneToLoss: true,
    floodingBoard: true,
    explosivesSystem: true,
  },
  heroActions: [
    {
      id: "search-for-explosives",
      oncePerTurn: true,
      requiresTileCardType: "item",
      roll: { stat: "speed" },
      outcomes: {
        success: { min: 4, effects: ["gain-explosive-token"] },
        fail: { max: 3, effects: ["no-effect"] },
      },
    },
    {
      id: "force-explosives",
      oncePerTurn: true,
      requiresSameTileAs: "ghost-shark",
      requiresHolding: "explosive",
      roll: {
        stat: "might",
        bonusPerDiscardedToken: { token: "explosive", amount: 2 },
        bonusIfHolding: { item: "dynamite", amount: 2 },
      },
      outcomes: {
        success: { min: 10, effects: ["heroes-win"] },
        fail: { max: 9, effects: ["take-2-physical-damage", "end-turn"] },
      },
    },
  ],
  traitorActions: [
    {
      id: "cue-ominous-music",
      oncePerTurn: true,
      effect: "move-shark-to-any-flooded-tile",
    },
  ],
  monsters: [
    {
      id: "ghost-shark",
      name: "Great White Ghost Shark",
      stats: {
        might: 8,
        speed: 2,
        sanity: 4,
        knowledge: 4,
      },
      statusRules: ["cannot-be-stunned", "takes-no-damage-on-loss"],
    },
  ],
  scaling: {
    initialFloodedTilesByPlayerCount: {
      3: 1,
      4: 2,
      5: 3,
      6: 4,
    },
  },
};

export default haunt28Definition;
