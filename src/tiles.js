// Tile data for Betrayal at House on the Hill
// Each tile has: id, name, floors it can appear on, door directions, optional card type, description
//
// Door directions: 'N', 'S', 'E', 'W'
// Floors: 'ground', 'upper', 'basement'
// Card types: 'event', 'item', 'omen', or null

export const STARTING_TILES = [
  {
    id: "entrance-hall",
    name: "Entrance Hall",
    floors: ["ground"],
    doors: ["N", "E", "W"],
    cardType: null,
    description: "The front door of the house. There is no turning back.",
  },
  {
    id: "foyer",
    name: "Foyer",
    floors: ["ground"],
    doors: ["N", "S", "E", "W"],
    cardType: null,
    description: "A long hallway stretches before you.",
  },
  {
    id: "grand-staircase",
    name: "Grand Staircase",
    floors: ["ground"],
    doors: ["S", "E", "W"],
    cardType: null,
    description: "A sweeping staircase leads up... and down.",
    special: "staircase",
  },
  {
    id: "upper-landing",
    name: "Upper Landing",
    floors: ["upper"],
    doors: ["N", "S", "E", "W"],
    cardType: null,
    description: "The stairs creak as you reach the second floor.",
  },
  {
    id: "basement-landing",
    name: "Basement Landing",
    floors: ["basement"],
    doors: ["N", "S", "E", "W"],
    cardType: null,
    description: "Cold stone stairs lead down into darkness.",
  },
];

export const TILES = [
  // Ground / Upper tiles
  {
    id: "bloody-room",
    name: "Bloody Room",
    floors: ["ground", "upper"],
    doors: ["N", "S", "E"],
    cardType: "event",
    description: "The walls are smeared with something dark and wet.",
  },
  {
    id: "creaky-hallway",
    name: "Creaky Hallway",
    floors: ["ground", "upper"],
    doors: ["N", "S"],
    cardType: null,
    description: "The floorboards groan beneath your feet.",
  },
  {
    id: "organ-room",
    name: "Organ Room",
    floors: ["ground", "upper"],
    doors: ["S", "E"],
    cardType: "event",
    description: "A massive pipe organ dominates the room.",
  },
  {
    id: "chapel",
    name: "Chapel",
    floors: ["ground", "upper"],
    doors: ["N", "E"],
    cardType: "event",
    description: "Stained glass windows cast eerie colored light.",
  },
  {
    id: "library",
    name: "Library",
    floors: ["ground", "upper"],
    doors: ["N", "W"],
    cardType: "item",
    description: "Shelves of ancient, moldering books line every wall.",
  },
  {
    id: "dusty-hallway",
    name: "Dusty Hallway",
    floors: ["ground", "upper", "basement"],
    doors: ["N", "S"],
    cardType: null,
    description: "Thick dust coats every surface.",
  },
  {
    id: "charred-room",
    name: "Charred Room",
    floors: ["ground", "upper"],
    doors: ["N", "S", "E", "W"],
    cardType: "omen",
    description: "Something burned here. The walls are blackened and cracked.",
  },
  {
    id: "game-room",
    name: "Game Room",
    floors: ["ground", "upper", "basement"],
    doors: ["N", "S", "E", "W"],
    cardType: "event",
    description: "Dusty game boards are scattered across tables.",
  },
  {
    id: "abandoned-room",
    name: "Abandoned Room",
    floors: ["ground", "upper", "basement"],
    doors: ["N", "S", "E", "W"],
    cardType: null,
    description: "Broken furniture and scattered debris fill this room.",
  },
  {
    id: "servants-quarters",
    name: "Servant's Quarters",
    floors: ["ground", "upper", "basement"],
    doors: ["N", "E"],
    cardType: "omen",
    description: "Small, cramped rooms with narrow beds.",
  },
  {
    id: "operating-laboratory",
    name: "Operating Laboratory",
    floors: ["ground", "upper", "basement"],
    doors: ["N", "S"],
    cardType: "event",
    description: "Rusted surgical tools gleam on metal trays.",
  },
  {
    id: "conservatory",
    name: "Conservatory",
    floors: ["ground", "upper"],
    doors: ["N", "W"],
    cardType: "event",
    description: "Dead plants fill crumbling pots along the windows.",
  },
  // Ground-only tiles
  {
    id: "kitchen",
    name: "Kitchen",
    floors: ["ground", "basement"],
    doors: ["N", "E", "W"],
    cardType: "omen",
    description: "Something is cooking... and it smells terrible.",
  },
  {
    id: "dining-room",
    name: "Dining Room",
    floors: ["ground"],
    doors: ["N", "S"],
    cardType: "item",
    description: "A long table set for a feast that never happened.",
  },
  {
    id: "gardens",
    name: "Gardens",
    floors: ["ground"],
    doors: ["N", "S", "E", "W"],
    cardType: "omen",
    description: "Overgrown and wild, with strange plants.",
  },
  {
    id: "patio",
    name: "Patio",
    floors: ["ground"],
    doors: ["N", "S", "E", "W"],
    cardType: "event",
    description: "Cracked flagstones and a dry fountain.",
  },
  {
    id: "graveyard",
    name: "Graveyard",
    floors: ["ground"],
    doors: ["N", "S", "E"],
    cardType: "event",
    description: "Crooked headstones jut from the earth.",
  },
  // Upper floor tiles
  {
    id: "master-bedroom",
    name: "Master Bedroom",
    floors: ["upper"],
    doors: ["N", "E"],
    cardType: "omen",
    description: "The bed is unmade. Someone left in a hurry.",
  },
  {
    id: "attic",
    name: "Attic",
    floors: ["upper"],
    doors: ["S"],
    cardType: "event",
    description: "Cobwebs hang from every beam.",
  },
  {
    id: "bedroom",
    name: "Bedroom",
    floors: ["upper"],
    doors: ["N", "E", "S"],
    cardType: "event",
    description: "A child's bedroom. Something is wrong with the dolls.",
  },
  {
    id: "balcony",
    name: "Balcony",
    floors: ["upper"],
    doors: ["N", "S"],
    cardType: "omen",
    description: "A dizzying view of the grounds below.",
  },
  {
    id: "gallery",
    name: "Gallery",
    floors: ["upper"],
    doors: ["N", "S", "W"],
    cardType: "item",
    description: "Portraits with eyes that seem to follow you.",
  },
  // Basement tiles
  {
    id: "furnace-room",
    name: "Furnace Room",
    floors: ["basement"],
    doors: ["N", "E"],
    cardType: "omen",
    description: "The furnace glows red hot, though no one lit it.",
  },
  {
    id: "crypt",
    name: "Crypt",
    floors: ["basement"],
    doors: ["N", "S"],
    cardType: "event",
    description: "Stone coffins line the walls.",
  },
  {
    id: "underground-lake",
    name: "Underground Lake",
    floors: ["basement"],
    doors: ["S", "W"],
    cardType: "event",
    description: "Dark water stretches into the blackness.",
  },
  {
    id: "pentagram-chamber",
    name: "Pentagram Chamber",
    floors: ["basement"],
    doors: ["N", "S", "E", "W"],
    cardType: "omen",
    description: "A pentagram is carved into the stone floor.",
  },
  {
    id: "stairs-from-basement",
    name: "Stairs from Basement",
    floors: ["basement"],
    doors: ["N", "S", "E", "W"],
    cardType: null,
    description: "Narrow stairs lead upward.",
    special: "stairs-up",
  },
  {
    id: "wine-cellar",
    name: "Wine Cellar",
    floors: ["basement"],
    doors: ["N", "S"],
    cardType: "item",
    description: "Racks of dusty bottles line the walls.",
  },
  {
    id: "coal-chute",
    name: "Coal Chute",
    floors: ["basement", "ground"],
    doors: ["N", "E", "S"],
    cardType: "event",
    description: "A dark chute leads somewhere you don't want to go.",
  },
  {
    id: "junk-room",
    name: "Junk Room",
    floors: ["ground", "upper", "basement"],
    doors: ["N", "S", "E", "W"],
    cardType: "item",
    description: "Piles of discarded objects fill every corner.",
  },
  {
    id: "research-laboratory",
    name: "Research Laboratory",
    floors: ["ground", "upper", "basement"],
    doors: ["N", "E"],
    cardType: "event",
    description: "Bubbling beakers and strange apparatus.",
  },
  {
    id: "larder",
    name: "Larder",
    floors: ["ground", "basement"],
    doors: ["N", "S"],
    cardType: "item",
    description: "Shelves of preserved foods... some are moving.",
  },
  {
    id: "storeroom",
    name: "Storeroom",
    floors: ["ground", "upper", "basement"],
    doors: ["N", "S"],
    cardType: "item",
    description: "Crates and barrels fill this room.",
  },
];

// Shuffle an array (Fisher-Yates)
function shuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function createTileStack() {
  return shuffle(TILES);
}
