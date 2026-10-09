/**
 * Tiny safe expression evaluator for content formulas ("2.0+0.4*lv", "ceil(lv/2)", "92+10*lv").
 * Supports + - * / parentheses, numbers, variables and min/max/floor/ceil/round. No eval().
 */
export type Vars = Record<string, number>;
type Tok = { k: 'n'; v: number } | { k: 'id'; v: string } | { k: 'op'; v: string };

const FUNCS: Record<string, (...a: number[]) => number> = { min: Math.min, max: Math.max, floor: Math.floor, ceil: Math.ceil, round: Math.round };
const cache = new Map<string, Tok[]>();

function lex(src: string): Tok[] {
  const hit = cache.get(src);
  if (hit) return hit;
  const out: Tok[] = [];
  const re = /\s*(?:(\d+(?:\.\d+)?|\.\d+)|([a-z_][a-z0-9_]*)|([-+*/(),]))/gy;
  let m: RegExpExecArray | null;
  let pos = 0;
  while (pos < src.length && (m = re.exec(src))) {
    if (m[1] !== undefined) out.push({ k: 'n', v: Number(m[1]) });
    else if (m[2] !== undefined) out.push({ k: 'id', v: m[2] });
    else out.push({ k: 'op', v: m[3] as string });
    pos = re.lastIndex;
  }
  if (src.slice(pos).trim()) throw new Error(`bad formula "${src}"`);
  cache.set(src, out);
  return out;
}

export function evalExpr(src: string | number, vars: Vars = {}): number {
  if (typeof src === 'number') return src;
  const t = lex(src);
  let i = 0;
  const peek = () => t[i];
  const take = (op?: string) => { const x = t[i]; if (op && !(x?.k === 'op' && x.v === op)) throw new Error(`expected "${op}" in "${src}"`); i++; return x; };
  const primary = (): number => {
    const x = take();
    if (!x) throw new Error(`unexpected end of "${src}"`);
    if (x.k === 'n') return x.v;
    if (x.k === 'op' && x.v === '(') { const v = sum(); take(')'); return v; }
    if (x.k === 'op' && x.v === '-') return -primary();
    if (x.k === 'id') {
      const f = FUNCS[x.v];
      if (f && peek()?.k === 'op' && peek()?.v === '(') {
        take('('); const args = [sum()];
        while (peek()?.k === 'op' && peek()?.v === ',') { take(','); args.push(sum()); }
        take(')'); return f(...args);
      }
      if (!(x.v in vars)) throw new Error(`unknown variable "${x.v}" in "${src}"`);
      return vars[x.v] as number;
    }
    throw new Error(`unexpected "${x.v}" in "${src}"`);
  };
  const product = (): number => {
    let v = primary();
    for (let x = peek(); x?.k === 'op' && (x.v === '*' || x.v === '/'); x = peek()) { take(); const r = primary(); v = x.v === '*' ? v * r : v / r; }
    return v;
  };
  const sum = (): number => {
    let v = product();
    for (let x = peek(); x?.k === 'op' && (x.v === '+' || x.v === '-'); x = peek()) { take(); const r = product(); v = x.v === '+' ? v + r : v - r; }
    return v;
  };
  const v = sum();
  if (i < t.length) throw new Error(`trailing tokens in "${src}"`);
  return v;
}

/** Evaluate a JSON effect value (number or formula string) for a skill level. */
export const fx = (v: unknown, lv: number, extra: Vars = {}): number =>
  typeof v === 'number' ? v : typeof v === 'string' ? evalExpr(v, { lv, ...extra }) : 0;
