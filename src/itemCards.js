const ITEM_CARDS = [
  {
    id: "revolver",
    name: "Revolver",
    description: "A heavy revolver with a few rounds left.",
    flavor: "The metal is cold, but comforting.",
    isWeapon: true,
  },
  {
    id: "axe",
    name: "Axe",
    description: "An old fire axe. Still sharp enough to matter.",
    flavor: "A practical answer to an impractical house.",
    isWeapon: true,
  },
  {
    id: "spear",
    name: "Spear",
    description: "A ceremonial spear with a wicked point.",
    flavor: "Someone wanted this close at hand.",
    isWeapon: true,
  },
  {
    id: "amulet-of-the-ages",
    name: "Amulet of the Ages",
    description: "A strange amulet glowing with an eerie light.",
    flavor: "It hums softly in your palm.",
    isWeapon: false,
  },
  {
    id: "adrenaline-shot",
    name: "Adrenaline Shot",
    description: "A cracked injector filled with suspicious stimulant.",
    flavor: "You hope you won't need it.",
    isWeapon: false,
  },
  {
    id: "dusty-tome",
    name: "Dusty Tome",
    description: "A leatherbound volume packed with occult notes.",
    flavor: "Several pages are stuck together.",
    isWeapon: false,
  },
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
