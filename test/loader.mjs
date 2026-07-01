// ESM resolve hook: the engine uses Vite-style extensionless relative imports
// (e.g. `../cards`). Plain Node requires explicit extensions, so we retry any
// failed relative resolution by appending `.js` then `.jsx`. This lets the
// pure-JS engine run headless under Node with no bundler.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";

const CANDIDATE_EXTS = [".js", ".jsx", "/index.js"];

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    // Only attempt to patch relative specifiers that lack an extension.
    const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
    if (!isRelative || /\.[a-z]+$/i.test(specifier)) throw err;

    const parentPath = context.parentURL ? dirname(fileURLToPath(context.parentURL)) : process.cwd();
    for (const ext of CANDIDATE_EXTS) {
      const candidate = resolvePath(parentPath, specifier + ext);
      if (existsSync(candidate)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
    throw err;
  }
}
