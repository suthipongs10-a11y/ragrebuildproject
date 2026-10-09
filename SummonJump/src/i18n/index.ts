import th from './th.json';

const table: Record<string, string> = th;

/** Translate a key; returns the key itself if missing so gaps are visible. */
export function t(key: string): string {
  return table[key] ?? key;
}
