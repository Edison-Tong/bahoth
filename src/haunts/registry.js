import haunt1Definition from "./haunt_1/definition";

const HAUNT_REGISTRY = {
  [haunt1Definition.id]: haunt1Definition,
};

export function getHauntDefinitionById(id) {
  if (!id) return null;
  return HAUNT_REGISTRY[id] || null;
}

export function getAllHauntDefinitions() {
  return Object.values(HAUNT_REGISTRY);
}

// Temporary behavior: always pick Haunt 1 after a triggered haunt roll.
export function selectTriggeredHauntDefinition() {
  return haunt1Definition;
}
