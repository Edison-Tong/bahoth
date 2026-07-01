// Tile discover-effect coverage. Placing a tile can mutate the board (junk-room
// obstacle), draw a weapon (armory), or grant a stat (chapel etc.). These are
// core exploration-phase rules and were previously untested.
import { applyPlacedTileDiscoverEffects, drawWeaponItem } from "../src/tiles/discoverTileAbility.js";
import { createDrawnItemCard, STAT_LABELS } from "../src/game/gameState.js";
import { applyStatChangeState } from "../src/players/playerState.js";
import { makeGame } from "./harness.mjs";
import { test, assert, report } from "./harness.mjs";

// Build the options bag applyPlacedTileDiscoverEffects expects, with overridable parts.
function discoverOpts(game, overrides = {}) {
  return {
    placedTile: overrides.placedTile,
    player: overrides.player ?? game.players[0],
    currentPlayerIndex: 0,
    board: overrides.board ?? game.board,
    tileStack: game.tileStack,
    itemDeck: overrides.itemDeck ?? game.itemDeck,
    players: overrides.players ?? game.players,
    drawnCard: null,
    turnPhase: "rotate",
    message: "",
    tileEffect: null,
    mysticElevatorUsed: false,
    getPlacementOptions: () => [],
    createDrawnItemCard,
    applyStatChange: applyStatChangeState,
    statLabels: STAT_LABELS,
  };
}

console.log("drawWeaponItem:");
test("removes and returns the first weapon in the deck", () => {
  const deck = [{ name: "Bottle", isWeapon: false }, { name: "Revolver", isWeapon: true }, { name: "Axe", isWeapon: true }];
  const { weaponCard, remainingDeck } = drawWeaponItem(deck);
  assert(weaponCard.name === "Revolver", "first weapon drawn");
  assert(remainingDeck.length === 2, "deck shrank by 1");
  assert(!remainingDeck.some((c) => c.name === "Revolver"), "drawn weapon removed");
  assert(deck.length === 3, "input deck not mutated");
});

test("returns null when the deck holds no weapons", () => {
  const { weaponCard, remainingDeck } = drawWeaponItem([{ name: "Bottle", isWeapon: false }]);
  assert(weaponCard === null, "no weapon");
  assert(remainingDeck.length === 1, "deck unchanged in length");
});

console.log("\napplyPlacedTileDiscoverEffects — junk-room:");
test("places an obstacle token on the discovered tile", () => {
  const game = makeGame({ players: 4 });
  const board = { ground: [{ id: "junk-room", x: 1, y: 0, obstacle: false }], upper: [], basement: [] };
  const placedTile = { id: "junk-room", name: "Junk Room", floor: "ground", x: 1, y: 0, discoverEffect: "junk-room" };
  const result = applyPlacedTileDiscoverEffects(discoverOpts(game, { placedTile, board }));
  const tile = result.board.ground.find((t) => t.x === 1 && t.y === 0);
  assert(tile.obstacle === true, "obstacle token placed");
  assert(result.tileEffect.type === "junk-room", "junk-room tile effect surfaced");
});

console.log("\napplyPlacedTileDiscoverEffects — discover-gain:");
test("grants the tile's stat and reports the amount", () => {
  const game = makeGame({ players: 4 });
  const before = game.players[0].statIndex.sanity;
  const placedTile = { name: "Chapel", floor: "ground", x: 0, y: 1, discoverGain: { stat: "sanity", amount: 1 } };
  const result = applyPlacedTileDiscoverEffects(discoverOpts(game, { placedTile }));
  assert(result.players[0].statIndex.sanity === before + 1, "sanity +1");
  assert(result.tileEffect.type === "discover-gain" && result.tileEffect.gainAmount === 1, "discover-gain effect, amount 1");
});

test("caps the gain at the top of the stat track", () => {
  const game = makeGame({ players: 4 });
  const maxIndex = game.players[0].character.sanity.length - 1;
  const maxed = game.players.map((p, i) => (i === 0 ? { ...p, statIndex: { ...p.statIndex, sanity: maxIndex } } : p));
  const placedTile = { name: "Chapel", floor: "ground", x: 0, y: 1, discoverGain: { stat: "sanity", amount: 1 } };
  const result = applyPlacedTileDiscoverEffects(
    discoverOpts(game, { placedTile, players: maxed, player: maxed[0] })
  );
  assert(result.players[0].statIndex.sanity === maxIndex, "sanity stays at max");
  assert(result.tileEffect.gainAmount === 0, "no gain reported when already maxed");
});

report();
