// TEMPLATE — copy this folder to `haunt_<N>/` and fill in the blanks.
// This file is NOT registered (the leading underscore keeps it out of the game).
//
// The definition is pure DATA: rules-booklet text, setup steps, objectives,
// tokens, player-count scaling, and declarative action specs. All live game
// LOGIC goes in runtime.js. Keep this file free of functions.

const hauntTemplateDefinition = {
  id: "haunt_TEMPLATE", // e.g. "haunt_5" — must match the folder name and the registry key.
  title: "Haunt N - Title Here",

  // Shown in the in-game rules viewer (Heroes / Traitor tabs). Copy the wording
  // straight from the rulebook photos. See haunt_47/definition.js for a full example.
  rulesBooklet: {
    header: { title: "Title Here", meta: "Scenario Card • Trigger • Traitor", number: "N" },
    heroes: {
      readFirst: { introduction: "TODO hero intro", setupSteps: ["TODO"] },
      sidebarSections: [{ heading: "Objective", paragraphs: ["TODO"] }],
      // actionGroup: once-per-turn hero actions (optional).
      mainSections: [{ heading: "TODO", paragraphs: ["TODO"] }],
    },
    traitor: {
      readFirst: { introduction: "TODO traitor intro", setupSteps: ["TODO"] },
      sidebarSections: [{ heading: "Objective", paragraphs: ["TODO"] }],
      mainSections: [{ heading: "TODO", paragraphs: ["TODO"] }],
    },
  },

  summary: "One-sentence summary shown on the haunt card.",
  introduction: { heroes: "Short hero blurb.", traitor: "Short traitor blurb." },

  // Setup steps applied/read during HAUNT_SETUP (before the haunt goes active).
  setup: {
    heroes: ["TODO"],
    traitor: ["Your explorer is still in the game. You are the traitor.", "Heal all of your traits.", "TODO"],
  },

  objectives: {
    heroes: "TODO win condition.",
    traitor: "TODO win condition.",
  },

  // Physical tokens this haunt needs (drives token placement UI/labels).
  tokens: { required: [] },

  // Feature flags read by the engine/UI. Add only what this haunt uses.
  mechanics: {
    combat: true,
    // traitorIsInvincible: true,
    // deathAndRevive: true,
    // traitorCanHide: true,
  },

  // Declarative once-per-turn action specs. The actual resolution lives in
  // runtime.js (resolveActionState); these describe the buttons/rolls.
  heroActions: [
    // { id: "example-action", oncePerTurn: true, requiresTileToken: "portal",
    //   roll: { stat: "knowledge" }, outcomes: { success: { min: 6 }, fail: { max: 5 } } },
  ],
  traitorActions: [
    // { id: "example-attack", description: "..." },
  ],

  // Player-count scaling. `traitorPhysicalBonusByPlayerCount` is applied
  // automatically at setup by completeHauntSetupState; other keys are read by
  // your runtime (e.g. how many tokens to place).
  scaling: {
    // traitorPhysicalBonusByPlayerCount: { 3: 2, 4: 1, 5: 1, 6: 0 },
  },
};

export default hauntTemplateDefinition;
