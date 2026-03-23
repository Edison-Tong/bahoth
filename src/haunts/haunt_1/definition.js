const haunt1Definition = {
  id: "haunt_1",
  title: "Haunt 1 - The Restless Dead",
  summary: "A tormented ghost binds itself to the house while the traitor commands the dead.",
  setup: [
    "Determine the traitor.",
    "Place the Ghost token on the Chapel.",
    "Place Might tokens on designated rooms.",
    "Spawn the starting monster for the traitor.",
  ],
  objectives: {
    heroes: "Exorcise the ghost before all heroes fall.",
    traitor: "Overwhelm the heroes and protect the ghost.",
  },
  mechanics: {
    combat: true,
    deathAndRevive: true,
    tokens: ["ghost", "might", "monster"],
    extraMonsterTurnAfterTraitor: true,
  },
};

export default haunt1Definition;
