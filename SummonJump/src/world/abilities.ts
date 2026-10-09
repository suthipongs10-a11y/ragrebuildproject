/** Team abilities that open gates. Phase 4 spirits will provide them; until then a debug set is used. */
export type Ability = 'double' | 'dive' | 'break';
export const ABILITIES: readonly Ability[] = ['double', 'dive', 'break'];

/** `?abil=double,dive,break` (debug / owner testing). */
export function abilitiesFromUrl(search: string): Set<Ability> {
  const raw = new URLSearchParams(search).get('abil') ?? '';
  return new Set(raw.split(',').filter((a): a is Ability => (ABILITIES as readonly string[]).includes(a)));
}
