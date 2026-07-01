// Small cross-cutting formatting helpers shared across engine modules.

/** Pluralizes a move count, e.g. 1 → "1 move", 3 → "3 moves". No trailing text. */
export function movesLabel(count) {
  return `${count} move${count !== 1 ? "s" : ""}`;
}
