// Validates everything under src/data against its schema. Run by `npm run check`.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ContentError, loadContent } from '../src/data/content';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, localeSchema, type LocaleTable } from '../src/data/schema';

const errors: string[] = [];

function load(relativePath: string): unknown {
  const path = fileURLToPath(new URL(`../src/data/${relativePath}`, import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8'));
}

const locales = new Map<string, LocaleTable>();
for (const id of SUPPORTED_LOCALES) {
  const parsed = localeSchema.safeParse(load(`locales/${id}.json`));
  if (parsed.success) locales.set(id, parsed.data);
  else errors.push(`locales/${id}.json: ${parsed.error.message}`);
}

const reference = locales.get(DEFAULT_LOCALE);
if (reference) {
  const referenceKeys = Object.keys(reference);
  for (const [id, table] of locales) {
    for (const key of referenceKeys) {
      if (!(key in table)) errors.push(`locales/${id}.json: missing key "${key}"`);
    }
    for (const key of Object.keys(table)) {
      if (!(key in reference)) errors.push(`locales/${id}.json: unknown key "${key}"`);
    }
  }
}

let gameSummary = '';
try {
  const content = loadContent();
  gameSummary = `, ${Object.keys(content.units).length} units, ${Object.keys(content.monsters).length} monsters, ${Object.keys(content.tiles).length} tiles, ${content.laps.length} laps`;
} catch (error) {
  if (error instanceof ContentError) errors.push(...error.problems);
  else throw error;
}

if (errors.length > 0) {
  console.error(`Data validation failed (${errors.length}):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(`Data OK: ${locales.size} locales, ${reference ? Object.keys(reference).length : 0} keys each${gameSummary}.`);
