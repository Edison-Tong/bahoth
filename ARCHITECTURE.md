# Architecture

A digital implementation of *Betrayal at House on the Hill*: React 19 + Vite
front end, a small Express/WebSocket relay for online play, and a **pure
game-engine layer** that holds all rules logic.

## Layers

```
src/
  App.jsx              Lobby, online connection, character/scenario select, screen routing
  GameBoard.jsx        The live game: holds the `game` state object, wires the engine to the UI
  components/          Board, sidebar, dice, overlays, debug panel (presentation)
  hooks/, config/      Online sync hook, API base URL

  ── engine (pure, no React) ──────────────────────────────────
  game/gameState.js    initGameState(): decks, board, the initial `game` object; core constants
  players/             stats, damage, trade, turn control        (barrel: playerDomain.js)
  movement/            grid movement, tile traversal, placement
  tiles/               tile data + discover/end-of-turn effects
  cards.js             item / omen / event card definitions
  items/ omens/        active + passive card abilities
  events/              event card resolution engine (eventEngine, eventActions)
  haunts/              the 50 scenarios (see below)
  shared/              cross-cutting pure helpers (playerHelpers, format, tileRotation)

server/index.js        In-memory room relay; host broadcasts the full game state
test/                  Headless harness (see Testing)
```

### The `game` object
One plain object is the entire game state. Every rules operation is a **pure
function** `(game, ...args) => nextGame` (or `=> { game, ... }`). Nothing mutates
`game` in place. `GameBoard` holds it in `useState` and calls these functions;
online play just serializes and broadcasts it. This "functions take `game`,
return `game`" discipline is what makes the engine testable without a browser.

## Haunts

After exploration, a haunt (scenario) begins and usually turns one player into
the traitor. Each haunt is a folder under `src/haunts/`:

- **`definition.js`** — pure data: rulebook text, setup, objectives, tokens,
  player-count scaling, declarative action specs. No logic.
- **`runtime.js`** — the logic: ~25 optional lifecycle **hooks** (onHauntBegin,
  resolveAfterDamageState, getCombatBonus, resolveActionState, board/token
  render, …). A haunt implements only the hooks it needs.

`core/hauntRuntime.js` owns the lifecycle: `PRE_HAUNT → HAUNT_SETUP →
HAUNT_ACTIVE`. `core/hauntBase.js` provides the generic helpers every runtime
shares. `registry.js` auto-collects each runtime's exported functions into its
hook bundle — **adding a haunt is one line** in `IMPLEMENTED_HAUNTS`.

### Adding a haunt
1. Copy `src/haunts/_template/` to `haunt_<N>/`.
2. Fill `definition.js` from the rulebook; set `id` to `"haunt_<N>"`.
3. Implement the hooks in `runtime.js` (import shared helpers from `hauntBase`).
4. Add one line to `registry.js`'s `IMPLEMENTED_HAUNTS`.
5. Test: add the id to `test/haunts.smoke.mjs`'s `IMPLEMENTED` list and run
   `npm test`; in-app, open the debug panel (**Shift+D**) → **Start Haunt**.

See `src/haunts/_template/README.md` for the full contract.

## Testing

`npm test` runs a **headless, deterministic** suite (seeded `Math.random`) that
drives the real engine under Node — no browser. It covers game/haunt setup,
every event effect branch, and the stat/damage primitives. Because the engine is
React-free, refactors are verified here instead of by hand.

Out of headless scope (needs manual/browser testing): everything in
`GameBoard.jsx` and `components/` (rendering, the combat state machine, dice
animation), and multiplayer (`server/`, online sync).

## Online play

Host-authoritative relay: the host's `game` object is broadcast on change and
other clients overwrite their local copy. The server (`server/index.js`) keeps
rooms in memory and forwards messages; it does not yet validate game state.
