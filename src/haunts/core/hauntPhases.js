// Enumeration of top-level game phase strings used throughout the state machine.
export const GAME_PHASES = {
  PRE_HAUNT: "preHaunt",
  HAUNT_SETUP: "hauntSetup",
  HAUNT_ACTIVE: "hauntActive",
  GAME_OVER: "gameOver",
};

// Team labels used in hauntState.teams to distinguish heroes, traitor, and monsters.
export const HAUNT_TEAMS = {
  HEROES: "heroes",
  TRAITOR: "traitor",
  MONSTERS: "monsters",
};

export const HAUNT_ACTION_LIMIT_SCOPE = {
  TURN: "turn",
  GAME: "game",
};
