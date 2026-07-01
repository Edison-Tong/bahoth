import haunt1Definition from "./haunt_1/definition";
import haunt18Definition from "./haunt_18/definition";
import haunt28Definition from "./haunt_28/definition";
import haunt47Definition from "./haunt_47/definition";
import * as haunt1Runtime from "./haunt_1/runtime";
import * as haunt18Runtime from "./haunt_18/runtime";
import * as haunt28Runtime from "./haunt_28/runtime";
import * as haunt47Runtime from "./haunt_47/runtime";
import { SCENARIO_CARDS } from "./scenarioCards";

// Single source of truth for implemented haunts. To wire up a new haunt, add
// one line here — its runtime module's exported hook functions ARE the hook
// bundle (auto-collected below), so there is no per-hook aliasing to maintain
// and no way to forget to register an exported hook.
const IMPLEMENTED_HAUNTS = [
  { definition: haunt1Definition, runtime: haunt1Runtime },
  { definition: haunt18Definition, runtime: haunt18Runtime },
  { definition: haunt28Definition, runtime: haunt28Runtime },
  { definition: haunt47Definition, runtime: haunt47Runtime },
];

// Used until every scenario→haunt mapping resolves to an implemented haunt.
const FALLBACK_HAUNT_DEFINITION = haunt1Definition;

const HAUNT_REGISTRY = {};
const HAUNT_RUNTIME_REGISTRY = {};

for (const { definition, runtime } of IMPLEMENTED_HAUNTS) {
  if (!definition?.id) {
    throw new Error("[haunts] An implemented haunt is missing a definition.id.");
  }
  if (HAUNT_REGISTRY[definition.id]) {
    throw new Error(`[haunts] Duplicate haunt id "${definition.id}" in the registry.`);
  }
  // Collect every exported function from the runtime namespace as a hook. Named
  // exports of a haunt runtime are exactly its hooks, so this reproduces the
  // old hand-maintained bundle without the boilerplate.
  const hooks = {};
  for (const [name, value] of Object.entries(runtime)) {
    if (typeof value === "function") hooks[name] = value;
  }
  HAUNT_REGISTRY[definition.id] = definition;
  HAUNT_RUNTIME_REGISTRY[definition.id] = hooks;
}

/* [HAUNT-SETUP] [LOOKUP] Look up a haunt's static definition (scenario text, win conditions, etc.) by ID. */
export function getHauntDefinitionById(id) {
  if (!id) return null;
  return HAUNT_REGISTRY[id] || null;
}

/* [HAUNT-SETUP] [LOOKUP] Returns all registered haunt definitions (used to build the haunt-selection list). */
export function getAllHauntDefinitions() {
  return Object.values(HAUNT_REGISTRY);
}

/* [HAUNT-SETUP] [LOOKUP] Returns the runtime hook bundle for a haunt (movement overrides, combat hooks, etc.) by ID. */
export function getHauntRuntimeHooksById(id) {
  if (!id) return null;
  return HAUNT_RUNTIME_REGISTRY[id] || null;
}

/* [HAUNT-SETUP] Picks the correct haunt after a triggered omen haunt roll using the selected reason card's omen→haunt mapping. Warns and falls back to the fallback haunt if the mapped haunt isn't implemented yet. */
export function selectTriggeredHauntDefinition(game) {
  const scenarioCardId = game?.selectedScenarioCardId;
  const omenId = game?.hauntRoll?.triggeringOmenId;

  if (scenarioCardId && omenId) {
    const scenarioCard = SCENARIO_CARDS.find((c) => c.id === scenarioCardId);
    const hauntId = scenarioCard?.hauntsByOmen?.[omenId];
    if (hauntId && HAUNT_REGISTRY[hauntId]) {
      return HAUNT_REGISTRY[hauntId];
    }
    if (hauntId) {
      // Not a silent fallback: surface that a mapped haunt is still unimplemented.
      console.warn(
        `[haunts] Scenario "${scenarioCardId}" maps omen "${omenId}" to "${hauntId}", ` +
          `which is not implemented yet — falling back to "${FALLBACK_HAUNT_DEFINITION.id}".`
      );
    }
  }

  return FALLBACK_HAUNT_DEFINITION;
}
