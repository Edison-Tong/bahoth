// Full rules content and scenario definition for Haunt 47 "A Knight to Remember".
// Scenario Card: Paranormal Investigators | Haunt Trigger: Armor | Traitor: Haunt Revealer
const haunt47Definition = {
  id: "haunt_47",
  title: "Haunt 47 - A Knight to Remember",
  rulesBooklet: {
    header: {
      title: "A Knight to Remember",
      meta: "Scenario Card: Paranormal Investigators • Haunt Trigger: Armor • Traitor: Haunt Revealer",
      number: "47",
    },
    heroes: {
      readFirst: {
        introduction:
          "Many ghost hunters before you have tried to unlock the mysteries of this place, but they were never heard from again. As you theorize with your colleagues about what might have happened to those lost souls you hear the dulcet tones of a recorder, playing a medieval tune. A portal opens up, tearing through the fabric of time itself. Huh. That might explain it. As you ponder this development, your friend cackles. On the other side of the portal, a knight laughs in the exact same way.",
        setupSteps: [
          "The heroes have no additional setup steps.",
          "The player to the left of the traitor will take the first turn after setup.",
        ],
      },
      sidebarSections: [
        {
          heading: "Objective",
          paragraphs: ["You win when all of the Portals have been closed."],
          bullets: ["Escape the Portals.", "Close the Portals."],
        },
        {
          heading: "Tokens Needed",
          bullets: ["Hero Tokens – Trapped Heroes", "Portal Tokens – Dimensional Portals"],
        },
        {
          heading: "If You Win",
          paragraphs: [
            "The last of the portals closes, ending the knight's reign of terror on this side of existence. As you exit the house, you take a moment to think of those poor souls forever lost to another time.",
          ],
        },
      ],
      actionGroup: {
        title: "Hero Once-Per-Turn Actions",
        actions: [
          {
            title: "Escape the Portal",
            lines: [
              "While on a tile with a Portal token (and you are Trapped), make a Knowledge roll.",
              "If there is a non-Trapped hero on your tile, add 2 to your roll.",
              "6+: Give the traitor your Hero token. You are no longer Trapped. Made it!",
              "0–5: Gain 1 Knowledge. Not quite, but you gained some insight...",
            ],
          },
          {
            title: "Close the Portal",
            lines: [
              "While on a tile with a Portal token (and you are not Trapped), make a Knowledge or Sanity roll.",
              "4+: You close the Portal. Remove that Portal from the house. If this was the last Portal, you win!",
              "0–3: Take one die of Mental damage.",
            ],
          },
        ],
      },
      mainSections: [
        {
          heading: "Another Dimension",
          paragraphs: ["A hero with a Hero token is Trapped. Trapped heroes may not trade with non-Trapped heroes."],
        },
        {
          heading: "Leap Through a Portal",
          paragraphs: [
            "At the start of your turn, make a Speed roll to determine how far you are able to move (minimum 1 tile).",
          ],
        },
      ],
    },
    traitor: {
      readFirst: {
        introduction:
          'Ghosts of yore haunt this place — of that, you\'re certain. So many others have sought them out, only to disappear without a trace. As you wonder what happened to the last investigators to come here, you peek into a suit of armor. A portal suddenly yawns open, swallowing you whole. On the other side, you come face-to-face with a knight and the point of his blade. "You will be my body in the other realm. Send them here and I will finish them." You have no choice but to agree.',
        setupSteps: [
          "Your explorer is still in the game. You are the traitor.",
          "Heal all of your traits.",
          "Find {2/3/4/5} Portal tokens. For each hero, place a Portal token in that hero's region on the tile farthest from that hero.",
          "Give each hero their Hero matching token. A hero who has their Hero token is Trapped.",
        ],
      },
      sidebarSections: [
        {
          heading: "Objective",
          paragraphs: ["You win when all of the heroes are dead."],
        },
        {
          heading: "Tokens Needed",
          bullets: ["Hero Tokens – Trapped Heroes", "Portal Tokens – Dimensional Portals"],
        },
        {
          heading: "If You Win",
          paragraphs: [
            "The knight sighs, sheathing his sword. Time to rest again — but for a short spell. You are now, and forever, his squire.",
          ],
        },
      ],
      mainSections: [
        {
          heading: "Another Dimension",
          paragraphs: [
            "A hero who has their Hero token is Trapped. Trapped heroes cannot trade with heroes who are not Trapped.",
          ],
        },
        {
          heading: "What a Cruel Knight",
          paragraphs: [
            "You may attack once on your turn for each living hero, but you may not attack any hero more than once per turn. The type of attack you make is determined by whether or not the hero is Trapped.",
          ],
          bullets: [
            "Trapped Heroes – Sanity Attack: Add 2 to the result of your roll. If you win, the hero takes Physical damage.",
            "Non-Trapped Heroes – Might Attack: If you win, you do not deal damage. Instead, give your target their Trapped token. That hero is Trapped. You do not take damage if you lose this attack.",
          ],
        },
        {
          heading: "If You Would Die",
          paragraphs: ["Heal all of your traits, instead. The cruel knight is invincible."],
        },
      ],
    },
  },
  summary:
    "A portal has opened. All heroes are Trapped in another dimension — escape the portals and close them before the cruel knight strikes.",
  introduction: {
    heroes:
      "Many ghost hunters before you have tried to unlock the mysteries of this place. A portal opens up, tearing through the fabric of time itself. On the other side, a knight laughs.",
    traitor: "You have no choice but to agree — you will be the knight's body in this realm.",
  },
  setup: {
    heroes: [
      "The heroes have no additional setup steps.",
      "The player to the left of the traitor takes the first turn after setup.",
    ],
    traitor: [
      "Your explorer is still in the game. You are the traitor.",
      "Heal all of your traits.",
      "Find {2/3/4/5} Portal tokens. For each hero, place a Portal token in that hero's region on the tile farthest from that hero.",
      "Give each hero their Hero matching token. A hero who has their Hero token is Trapped.",
    ],
  },
  objectives: {
    heroes: "Close all Portal tokens.",
    traitor: "Win when all heroes are dead.",
  },
  tokens: {
    required: ["hero-token", "portal"],
  },
  mechanics: {
    combat: true,
    traitorIsInvincible: true,
    trappedHeroes: true,
    portalTokens: true,
  },
  heroActions: [
    {
      id: "escape-portal",
      oncePerTurn: true,
      requiresTrapped: true,
      requiresTileToken: "portal",
      roll: {
        stat: "knowledge",
        bonusIfNonTrappedHeroOnTile: 2,
      },
      outcomes: {
        success: { min: 6, effects: ["remove-trapped-status"] },
        fail: { max: 5, effects: ["gain-1-knowledge"] },
      },
    },
    {
      id: "close-portal",
      oncePerTurn: true,
      requiresNotTrapped: true,
      requiresTileToken: "portal",
      roll: { stat: "knowledge-or-sanity" },
      outcomes: {
        success: { min: 4, effects: ["remove-portal-token", "heroes-win-if-last"] },
        fail: { max: 3, effects: ["take-1-die-mental-damage"] },
      },
    },
  ],
  traitorActions: [
    {
      id: "attack-trapped-hero",
      description: "Sanity attack vs Trapped hero, +2 bonus, deal Physical damage on win.",
    },
    {
      id: "attack-non-trapped-hero",
      description:
        "Might attack vs non-Trapped hero. On win, give target their Hero token (Trapped). No damage to traitor on loss.",
    },
  ],
  scaling: {
    portalTokensByPlayerCount: {
      3: 2,
      4: 3,
      5: 4,
      6: 5,
    },
  },
};

export default haunt47Definition;
