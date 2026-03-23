const haunt1Definition = {
  id: "haunt_1",
  title: "Haunt 1 - Jack Is Back",
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
    heroesChecklist: ["Kill the traitor to release Jack's Spirit.", "Exorcise Jack's Spirit."],
    traitor: "Win when all heroes are dead.",
  },
  tokens: {
    required: ["jacks-spirit", "exorcism", "knowledge-of-jack"],
  },
  combatModifiers: [
    {
      id: "knowledge-of-jack-attack-bonus",
      appliesWhen: "attacking-traitor-or-defending-vs-jacks-spirit",
      condition: "actor-has-knowledge-of-jack-token",
      bonusType: "flat-roll-bonus",
      amount: 2,
    },
  ],
  mechanics: {
    combat: true,
    deathAndRevive: true,
    extraMonsterTurnAfterTraitor: true,
    hiddenObjectives: true,
    traitorCorpseTracking: true,
  },
  traitorRules: {
    deathBehavior: {
      description:
        "When the traitor dies, place Jack's Spirit on the omen tile farthest from the traitor's corpse. Repeat each time the traitor dies.",
      spawn: {
        actorId: "jacks-spirit",
        locationRule: "farthest-omen-tile-from-traitor-corpse",
      },
    },
    turnStartBehavior: {
      ifDead: "take-turn-with-jacks-spirit",
    },
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
      3: 2,
      4: 2,
      5: 3,
      6: 3,
    },
  },
};

export default haunt1Definition;
