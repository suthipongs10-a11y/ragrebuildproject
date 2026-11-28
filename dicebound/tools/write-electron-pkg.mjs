// The root package is ESM, but the Electron main/preload are compiled to CommonJS
// (a sandboxed preload cannot be an ES module), so mark that folder as CommonJS.
import { writeFileSync } from 'node:fs';

writeFileSync(new URL('../dist-electron/package.json', import.meta.url), '{ "type": "commonjs" }\n');
