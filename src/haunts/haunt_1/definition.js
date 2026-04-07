const haunt1Definition = {
  id: "haunt_1",
  title: "Haunt 1 - Jack Is Back",
  rulesBooklet: {
    header: {
      title: "Stacked Like Cordwood 2: Crimson Jack Returns",
      meta: "Scenario Card: None • Haunt Trigger: A Splash of Crimson • Traitor: Haunt Revealer",
      number: "1",
    },
    heroes: {
      readFirst: {
        introduction: "A smile flickers across your friend's lips. It seems... he was out after dark.",
        setupSteps: [
          "The heroes have no additional setup steps.",
          "The player to the left of the traitor takes the first turn after setup.",
        ],
      },
      sidebarSections: [
        {
          heading: "Objective",
          paragraphs: ["You win when you exorcise Jack's Spirit."],
        },
        {
          heading: "Tokens Needed",
          bullets: ["Jack's Spirit token", "2 Sanity tokens (Exorcism Circle)", "2 Might tokens (Knowledge of Jack)"],
        },
        {
          heading: "If You Win",
          paragraphs: ["Jack's Spirit fades. For now, the house is yours again."],
        },
      ],
      actionGroup: {
        title: "Hero Once-Per-Turn Actions",
        actions: [
          {
            title: "Learn about Jack",
            lines: [
              "While on the Library tile, make a Knowledge roll.",
              "5+: Give a Knowledge of Jack token to a hero who does not have one.",
              "0-4: Nothing happens.",
            ],
          },
          {
            title: "Study the Exorcism",
            lines: [
              "While on an Event symbol tile, make a Knowledge roll.",
              "5+: Place or move the Exorcism Circle token.",
              "0-4: Take 2 Mental damage.",
            ],
          },
          {
            title: "Exorcise Jack's Spirit",
            lines: [
              "While on Jack's Spirit tile, make a Sanity roll.",
              "Add 1 for each Exorcism Circle token on your floor.",
              "7+: You win.",
              "0-6: Each hero takes 1 Physical damage.",
            ],
          },
        ],
      },
      mainSections: [
        {
          heading: "When You Attack the Traitor or Are Attacked by Jack's Spirit",
          paragraphs: ["If you have a Knowledge of Jack token, add 2 to your roll result."],
        },
        {
          heading: "When the Traitor Dies",
          paragraphs: ["Place Jack's Spirit on the omen tile farthest from the traitor's corpse."],
        },
      ],
    },
    traitor: {
      readFirst: {
        introduction: "You smile. Jack is back.",
        setupSteps: [
          "Your explorer is still in the game. You are the traitor.",
          "Heal all traits. Gain (number) in each of your physical traits.",
        ],
      },
      sidebarSections: [
        {
          heading: "Objective",
          paragraphs: ["You win when all heroes are dead."],
        },
        {
          heading: "Tokens Needed",
          bullets: ["Jack's Spirit token", "2 Sanity tokens (Exorcism Circle)", "2 Might tokens (Knowledge of Jack)"],
        },
        {
          heading: "If You Win",
          paragraphs: ["The house belongs to you again, and no one leaves alive."],
        },
      ],
      actionGroup: {
        title: "Traitor Once-Per-Turn Actions",
        isTraitor: true,
        actions: [
          {
            title: "Stalk the Prey",
            lines: [
              "If you have not attacked and no hero is in line of sight, move to any upper/ground tile out of line of sight.",
            ],
          },
        ],
      },
      mainSections: [
        {
          heading: "If You Die",
          paragraphs: ["Place Jack's Spirit on the omen tile farthest from your corpse. Repeat each time you die."],
        },
        {
          heading: "At the Start of Your Turn If You Are Dead",
          paragraphs: ["Take your turn with Jack's Spirit instead of your explorer."],
        },
      ],
      monsterCard: {
        heading: "Monster: Jack's Spirit",
        stats: {
          might: 5,
          speed: 3,
          sanity: 4,
          knowledge: 4,
        },
        paragraphs: [
          "Jack's Spirit may move between adjacent tiles without doorway connections.",
          "Jack's Spirit cannot be stunned.",
        ],
        turnHeading: "At the Start of the Monster Turn",
        turnParagraphs: [
          "If Jack's Spirit is on your corpse tile, heal all traits, retake your explorer, and remove Jack's Spirit from the house.",
        ],
      },
    },
  },
  summary: "A smile flickers across your friend's lips. It seems... he was out after dark.",
  introduction: {
    heroes: "A smile flickers across your friend's lips. It seems... he was out after dark.",
    traitor: "You smile. Jack is back.",
  },
  setup: {
    heroes: ["No additional setup.", "The player to the left of the traitor takes the first turn after setup."],
    traitor: [
      "Your explorer is still in the game. You are the traitor.",
      "Heal all of your traits.",
      "Gain extra points in both physical traits based on player count.",
    ],
  },
  objectives: {
    heroes: "Exorcise Jack's Spirit.",
    traitor: "Win when all heroes are dead.",
  },
  tokens: {
    required: ["jacks-spirit", "exorcism", "knowledge-of-jack"],
  },
  mechanics: {
    combat: true,
    deathAndRevive: true,
    hiddenObjectives: true,
    traitorCorpseTracking: true,
  },
  heroActions: [
    {
      id: "learn-about-jack",
      oncePerTurn: true,
      requiresTile: "library",
      roll: { stat: "knowledge" },
      outcomes: {
        success: {
          min: 5,
          effects: ["give-knowledge-of-jack-token-to-any-hero-without-one"],
        },
        fail: {
          max: 4,
          effects: ["no-effect"],
        },
      },
    },
    {
      id: "study-the-exorcism",
      oncePerTurn: true,
      requiresTileSymbol: "event",
      roll: { stat: "knowledge" },
      outcomes: {
        success: {
          min: 5,
          effects: ["place-or-move-exorcism-token-to-current-tile"],
        },
        fail: {
          max: 4,
          effects: ["take-2-mental-damage"],
        },
      },
    },
    {
      id: "exorcise-jacks-spirit",
      oncePerTurn: true,
      requiresSameTileAs: "jacks-spirit",
      roll: {
        stat: "sanity",
        bonusPerTokenOnCurrentFloor: {
          token: "exorcism",
          amount: 1,
        },
      },
      outcomes: {
        success: {
          min: 7,
          effects: ["heroes-win"],
        },
        fail: {
          max: 6,
          effects: ["each-hero-takes-1-physical-damage"],
        },
      },
    },
  ],
  traitorActions: [
    {
      id: "stalk-prey",
      oncePerTurn: true,
      restrictions: ["has-not-attacked-this-turn", "no-line-of-sight-to-any-hero"],
      effect: "move-traitor-to-any-upper-or-ground-tile-out-of-hero-line-of-sight",
    },
  ],
  monsters: [
    {
      id: "jacks-spirit",
      name: "Jack's Spirit",
      stats: {
        might: 5,
        speed: 3,
        sanity: 4,
        knowledge: 4,
      },
      movementRules: ["can-move-to-adjacent-tiles-without-doorway-connection"],
      statusRules: ["cannot-be-stunned"],
      turnStartBehavior: {
        ifOnTraitorCorpseTile: [
          "heal-traitor-all-traits",
          "return-control-to-traitor-explorer",
          "remove-jacks-spirit-from-house",
        ],
      },
    },
  ],
  scaling: {
    traitorPhysicalBonusByPlayerCount: {
      3: 1,
      4: 1,
      5: 2,
      6: 2,
    },
  },
};

export default haunt1Definition;
