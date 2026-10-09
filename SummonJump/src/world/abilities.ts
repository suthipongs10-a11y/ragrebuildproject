/** Exploration abilities from the spirit team (Phase 4) + `?abil=` / debug keys for testing. */
export type Ability = 'double' | 'dive' | 'break' | 'cloud' | 'reveal';
export const ABILITIES: readonly Ability[] = ['double', 'dive', 'break', 'cloud', 'reveal'];

/** `?abil=double,dive,break` (debug / owner testing). */
export function abilitiesFromUrl(search: string): Set<Ability> {
  const raw = new URLSearchParams(search).get('abil') ?? '';
  return new Set(raw.split(',').filter((a): a is Ability => (ABILITIES as readonly string[]).includes(a)));
}
