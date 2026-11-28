import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { CONFIG } from './config';

export type Background = 'alpha' | 'magenta' | 'black' | 'scene' | 'tile';

export type SliceSpec =
  | { kind: 'row'; count: number; names: string[] | null }
  | { kind: 'grid'; cols: number; rows: number; names: string[] | null }
  | { kind: 'rows'; count: number }
  | { kind: 'single' }
  | { kind: 'reference' };

/** null = keep the native (trimmed) size. */
export type FinalSize = { width: number; height: number | null } | null;

export interface ManifestEntry {
  pack: string;
  file: string;
  /** File name without extension and without the `_sheet` suffix. */
  baseId: string;
  title: string;
  background: Background;
  slice: SliceSpec;
  sliceText: string;
  finalSize: FinalSize;
  finalSizeText: string;
  promptFile: string;
  rawPath: string;
  exists: boolean;
}

export interface PackListing {
  pack: string;
  entries: ManifestEntry[];
  /** PNG files present in the pack folder that the manifest does not mention. */
  unlisted: string[];
  manifestFound: boolean;
}

/** Minimal RFC-4180 reader: the manifests quote fields that contain commas. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  // Excel-style manifests start with a byte-order mark.
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((cell) => cell !== '')) rows.push(row);
  return rows;
}

export function parseSlice(text: string): SliceSpec {
  if (/^reference only/.test(text)) return { kind: 'reference' };
  if (/^(single image|tileable)/.test(text)) return { kind: 'single' };
  const rows = /^slice (\d+) rows/.exec(text);
  if (rows) return { kind: 'rows', count: Number(rows[1]) };
  const grid = /^slice (\d+)x(\d+)/.exec(text);
  if (grid) {
    const cols = Number(grid[1]);
    const rowCount = Number(grid[2]);
    const range = /→ (\w+?)_(\d+)\.\.\w+?_(\d+)/.exec(text);
    let names: string[] | null = null;
    if (range) {
      const first = Number(range[2]);
      const last = Number(range[3]);
      names = Array.from({ length: last - first + 1 }, (_, i) => `${range[1]}_${first + i}`);
    }
    return { kind: 'grid', cols, rows: rowCount, names };
  }
  const row = /^slice (\d+) (?:frames|cells)[^:]*(?::\s*(.+))?$/.exec(text);
  if (row) {
    const names = row[2] ? row[2].split(',').map((name) => name.trim()) : null;
    return { kind: 'row', count: Number(row[1]), names };
  }
  throw new Error(`Unrecognised slice spec: "${text}"`);
}

export function parseFinalSize(text: string): FinalSize {
  // "~420x110" and "varies" describe a rough native size, not a target to scale to.
  if (/~|varies|—/.test(text)) return null;
  const box = /(\d+)x(\d+)/.exec(text);
  if (box) return { width: Number(box[1]), height: Number(box[2]) };
  const wide = /(\d+) wide/.exec(text);
  if (wide) return { width: Number(wide[1]), height: null };
  throw new Error(`Unrecognised final_size: "${text}"`);
}

export function readPack(root: string, pack: string): PackListing {
  const dir = path.join(root, CONFIG.rawDir, pack);
  const manifestPath = path.join(dir, 'manifest.csv');
  const present = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.png')) : [];
  if (!existsSync(manifestPath)) return { pack, entries: [], unlisted: present, manifestFound: false };

  const [header, ...rows] = parseCsv(readFileSync(manifestPath, 'utf8'));
  if (!header) throw new Error(`${manifestPath} is empty`);
  const column = (row: string[], name: string): string => {
    const index = header.indexOf(name);
    if (index < 0) throw new Error(`${manifestPath}: missing column "${name}"`);
    return row[index] ?? '';
  };

  const entries = rows.map((row): ManifestEntry => {
    const file = column(row, 'save_as');
    return {
      pack,
      file,
      baseId: file.replace(/\.png$/, '').replace(/_sheet$/, ''),
      title: column(row, 'title_th'),
      background: column(row, 'background') as Background,
      slice: parseSlice(column(row, 'slice')),
      sliceText: column(row, 'slice'),
      finalSize: parseFinalSize(column(row, 'final_size')),
      finalSizeText: column(row, 'final_size'),
      promptFile: column(row, 'prompt_file'),
      rawPath: path.join(dir, file),
      exists: present.includes(file),
    };
  });
  const listed = new Set(entries.map((entry) => entry.file));
  return { pack, entries, unlisted: present.filter((name) => !listed.has(name)), manifestFound: true };
}
