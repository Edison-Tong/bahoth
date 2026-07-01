# Adding a haunt

Each haunt is two files in a `haunt_<N>/` folder:

- **`definition.js`** — pure data: rulebook text, setup, objectives, tokens, and declarative action specs.
- **`runtime.js`** — the game logic: pure state functions (hooks) that take `game` and return the next `game`.

Generic helpers (`getCurrentPlayer`, `getHeroIndexes`, `createUsageKey`, action-roll helpers, …) come from `../core/hauntBase` — never re-implement them. Only scenario-specific helpers (like `getScenarioState`) live in the haunt's own runtime.

## Steps

1. **Copy this folder** to `haunt_<N>/` (e.g. `haunt_5/`). Delete the leading-underscore name — `_template` is intentionally *not* registered.
2. **Fill in `definition.js`** from the rulebook photos. Set `id` to `"haunt_<N>"` (must match the folder name). See `../haunt_47/definition.js` for a complete, filled-out example.
3. **Implement `runtime.js`**: set `HAUNT_ID`, flesh out `createInitialScenarioState`, and implement only the hooks this haunt needs. The template stubs the common ones and lists every optional hook with its signature. Good references by complexity:
   - `haunt_47` — simplest (no monster movement, no board mutation).
   - `haunt_28` — flooding + monster (shark) + explosives.
   - `haunt_1` — dead-traitor spirit, knowledge/exorcism tokens.
4. **Register it** — add one line to `../registry.js`:
   ```js
   import haunt5Definition from "./haunt_5/definition";
   import * as haunt5Runtime from "./haunt_5/runtime";
   // ...then in IMPLEMENTED_HAUNTS:
   { definition: haunt5Definition, runtime: haunt5Runtime },
   ```
   Every function exported from `runtime.js` is auto-collected as a hook — no per-hook wiring, and a duplicate/missing `id` throws at load.
5. **Test it**:
   - Headless: add the id to `test/haunts.smoke.mjs`'s `IMPLEMENTED` list; run `npm test`. This drives it to active and runs its read hooks — catches setup/hook crashes instantly.
   - In-app: `npm run dev`, open the debug panel (**Shift+D**), pick your haunt from **Start Haunt**, choose a traitor, and jump straight in. New haunts appear here automatically.

## Contract notes

- Hooks are **optional**: the engine calls each with `?.`, so only export what you use.
- Never mutate `game`; always return a new object (`{ ...game, ... }`).
- `onHauntBegin(game)` runs once when the haunt goes active — return the next `game`.
- Read-only display hooks (`getTileTokenLabelsState`, `getPlayerHauntTokensState`, `getActionButtonsState`, …) must be **pure and cheap**: they run every render.
- Enforce once-per-turn actions with `createUsageKey(game, actionId)` + `markHauntActionUsed(hauntState, key)` and `hauntState.oncePerTurnUsage`.
