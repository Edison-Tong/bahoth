// Loaded via `node --import ./test/setup.mjs` BEFORE any engine code.
// 1) Registers the extensionless-import resolver (runs in a loader thread).
// 2) Replaces Math.random with a seeded PRNG in the main thread, so every
//    harness run is deterministic — the prerequisite for golden-snapshot
//    parity testing across refactors.
import { register } from "node:module";

register("./loader.mjs", import.meta.url);

// mulberry32 — small, fast, deterministic 32-bit PRNG.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = Number(process.env.HARNESS_SEED ?? 12345);
globalThis.__harnessRng = mulberry32(SEED);
Math.random = () => globalThis.__harnessRng();
