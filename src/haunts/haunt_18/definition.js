// Full rules content and scenario definition for Haunt 18 "A Nice Ring to It".
// Scenario Card: Paranormal Investigators | Haunt Trigger: Ring | Traitor: Haunt Revealer
const haunt18Definition = {
  id: "haunt_18",
  title: "Haunt 18 - A Nice Ring to It",
  rulesBooklet: {
    header: {
      title: "A Nice Ring to It",
      meta: "Scenario Card: Paranormal Investigators • Haunt Trigger: Ring • Traitor: Haunt Revealer",
      number: "18",
    },
    heroes: {
      readFirst: {
        introduction:
          "One of your friends starts to mutter. They simultaneously take one step to the left and one to the right. But… how? Clones? Reflections? Everywhere you look there's another one. All you can catch is one word: 'Precious.'",
        setupSteps: [
          "The heroes have no additional setup steps.",
          "The player to the left of the traitor will take the first turn after setup.",
        ],
      },
      sidebarSections: [
        {
          heading: "Objective",
          paragraphs: ["You win when you kill the traitor."],
        },
        {
          heading: "Tokens Needed",
          bullets: ["Number Tokens – Illusions"],
        },
        {
          heading: "If You Win",
          paragraphs: [
            "With their last breath, your former friend begins to fade. They and all their possessions waft into the air like smoke, leaving behind nothing but the ring. The smoke hangs in the air for a brief moment before it is drawn into the ring. You spot some movement in the trinket and pick it up to have a closer look… is that your friend's face, trapped in the smooth metal? As you ask yourself the question, you realize that you really don't care. Turning the ring in your fingers, one word echoes in your mind: 'Precious.' You feel a driving need to go somewhere, anywhere, everywhere. You must protect the ring.",
          ],
        },
      ],
      actionGroup: {
        title: "Hero Once-Per-Turn Actions",
        actions: [
          {
            title: "Confront an Illusion",
            lines: [
              "While on a tile with an Illusion, make a Knowledge roll. If you have the Mirror, add 2 to the result of your roll.",
              "5+: Dispel the Illusion as described above.",
              "0–4: Take one die of Mental damage.",
            ],
          },
          {
            title: "Call to the Ring",
            lines: [
              "You hear a thrum. The ring wants to come home.",
              "While on the Vault tile, make a Sanity roll. For each Omen you have, add 1 to the result of your roll.",
              "8+: Deal one die of Mental damage to the traitor (if they are revealed), or dispel any Illusion (as described above). End your turn.",
              "0–7: End your turn.",
            ],
          },
        ],
      },
      mainSections: [
        {
          heading: "The Ring of Illusions",
          bullets: [
            "The traitor can hide among their Illusions. The Number Token labeled '1' is the real traitor.",
            "The traitor will take their turn as either the Illusions (tokens) or their true self (explorer figure), but never both.",
            "You may dispel Illusions to try to reveal the traitor.",
          ],
        },
        {
          heading: "When You Dispel an Illusion",
          bullets: [
            "Flip that Illusion face-up and return it to the traitor's character board.",
            "If the revealed token is the '1,' the traitor has been revealed. They must place their explorer on the tile where that token was located and return all Number Tokens in the house to their character board. Then, they must return the highest-numbered Illusion token to the game box.",
          ],
        },
        {
          heading: "When You Attack an Illusion",
          paragraphs: [
            "If you win, the Illusion is dispelled as described above. If an attack reveals the traitor, that attack does no damage.",
          ],
        },
      ],
    },
    traitor: {
      readFirst: {
        introduction:
          "As you pick up the ring, you are immediately taken by its exquisite design and craftsmanship. A word begins to echo in your mind: 'Precious.' As you caress the ring with your fingertips, you are suddenly aware of many eyes looking at you. Friends? Bah! They can't take it from you. They outnumber you, but the ring will let you fix that. You caress it again, and a different set of eyes comes into view. Familiar eyes. Your eyes. Both of you. All of you.",
        setupSteps: [
          "Remove your explorer from the house. You are the traitor.",
          "Heal all of your traits.",
          "Place the Monster Card to your left. Any monsters in the house will take their turn in place of yours.",
          "Find one of each Number Token labeled 1 through (3/4/5/6). These are your Illusions. The '1' token is the real you.",
          "Shuffle the Illusions tokens face-down (you may look at them at any time) and place one on your tile. Then place the rest of the Illusions around the house, on tiles no farther away than the value of your Speed stat. If possible, you must place each Illusion on a different tile. Remove your explorer from the game, you are now Hidden.",
        ],
      },
      sidebarSections: [
        {
          heading: "Objective",
          paragraphs: ["You win when all of the heroes are dead."],
        },
        {
          heading: "Tokens Needed",
          bullets: ["Number Tokens – Illusions"],
        },
        {
          heading: "If You Win",
          paragraphs: [
            "The ring is yours and yours alone. Retreating into the darkest reaches of the house, you vow to protect your treasure from the outside world. Your only company now are your own reflections, whispering in your mind as they plot against each other.",
          ],
        },
      ],
      mainSections: [
        {
          heading: "The Ring of Illusions",
          paragraphs: [
            "The Ring lets you break your form into many Illusions. You may turn either as the Illusions or as yourself, but never both.",
            "Keep the Illusion tokens face-down until instructed otherwise. You may look at the numbers on those tokens at any time. The Illusion labeled '1' is the real you.",
            "Heroes may attempt to dispel your Illusions in order to reveal your explorer.",
          ],
        },
        {
          heading: "If You Are Hidden Among Illusions, Take Your Turn as the Illusions",
          subheading: "Monster: Illusion",
          bullets: [
            "Illusions share your current traits: Might ✦ Speed ✦ Sanity ✦ Knowledge",
            "Illusions may move a number of tiles equal to your Speed. They do not need to roll for movement.",
            "Illusions may use your items and Omens. (The Dagger and the Creepy Doll still cause a loss of traits.)",
            "Illusions cannot be stunned, but the heroes may have ways to dispel them.",
            "Illusions cannot explore new tiles.",
          ],
        },
        {
          heading: "When an Illusion Is Dispelled",
          bullets: [
            "Flip that token face-up and return it to your character board.",
            "Return all Illusions in the house to your character board.",
            "Return the highest-numbered Illusion token to the game box.",
            "If it's the '1,' you have been revealed. Return your explorer to the house, on the same tile that the '1' token was on.",
          ],
        },
        {
          heading: "If You Have Been Revealed, Take Your Turn as the Traitor",
          bullets: [
            "Keep the Illusion tokens face-down until instructed otherwise. You may turn either as the Illusions or as yourself, but never both.",
            "Look at the numbers on those tokens at any time. The Illusion labeled '1' is the real you.",
          ],
        },
        {
          heading: "Summon Illusions",
          tag: "Once during your turn, you may",
          bullets: [
            "You may not take this action if there are no Illusion tokens on your character board.",
            "Shuffle all Illusion tokens on your character board face-down and place them as described in setup step 5. Remove your explorer from the house and end your turn. The Illusions will be able to move and attack on your next turn.",
          ],
        },
      ],
    },
  },
  summary:
    "The traitor hides among illusory reflections of themselves. Heroes must dispel Illusions to find the real traitor, then kill them.",
  introduction: {
    heroes:
      "One of your friends starts to mutter, taking a step left and right at once. Everywhere you look there's another one. All you can catch is one word: 'Precious.'",
    traitor:
      "The ring is yours. They can't take it. The ring will let you fix that — split yourself into many reflections to confound and destroy them.",
  },
  setup: {
    heroes: [
      "The heroes have no additional setup steps.",
      "The player to the left of the traitor takes the first turn after setup.",
    ],
    traitor: [
      "Remove your explorer from the house. You are the traitor.",
      "Heal all of your traits.",
      "Place the Monster Card to your left. Any monsters in the house will take their turn in place of yours.",
      "Find one of each Number Token labeled 1 through (3/4/5/6). These are your Illusions. The '1' token is the real you.",
      "Shuffle the Illusions tokens face-down and place one on your tile. Place the rest of the Illusions around the house, on tiles no farther away than your Speed. If possible, place each Illusion on a different tile. Remove your explorer from the game, you are now Hidden.",
    ],
  },
  objectives: {
    heroes: "Kill the traitor.",
    traitor: "Kill all of the heroes.",
  },
  tokens: {
    required: ["number-token"],
  },
  mechanics: {
    combat: true,
    traitorCanHide: true,
    illusionTokens: true,
  },
  heroActions: [
    {
      id: "confront-illusion",
      oncePerTurn: true,
      requiresTileToken: "illusion",
      roll: {
        stat: "knowledge",
        bonusIfHasMirror: 2,
      },
      outcomes: {
        success: { min: 5, effects: ["dispel-illusion"] },
        fail: { max: 4, effects: ["take-1-die-mental-damage"] },
      },
    },
    {
      id: "call-to-ring",
      oncePerTurn: true,
      requiresTile: "vault",
      roll: {
        stat: "sanity",
        bonusPerOmen: 1,
      },
      outcomes: {
        success: {
          min: 8,
          effects: ["deal-1-die-mental-damage-to-traitor-or-dispel-illusion", "end-turn"],
        },
        fail: { max: 7, effects: ["end-turn"] },
      },
    },
  ],
  traitorActions: [
    {
      id: "summon-illusions",
      description:
        "Once per turn (when revealed and have tokens on character board): place all tokens face-down, remove explorer, become Hidden. End your turn.",
    },
    {
      id: "select-illusion",
      description: "Choose which Illusion to move this turn.",
    },
  ],
  scaling: {
    illusionCountByPlayerCount: {
      3: 3,
      4: 4,
      5: 5,
      6: 6,
    },
  },
};

export default haunt18Definition;
