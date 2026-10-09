export type Element = 'neutral' | 'water' | 'fire' | 'earth' | 'wind' | 'holy' | 'dark';

export const ELEMENTS: readonly Element[] = ['neutral', 'water', 'fire', 'earth', 'wind', 'holy', 'dark'];

/** Attacker beats defender (x1.5); reverse matchup is resisted (x0.75). */
const BEATS: Partial<Record<Element, Element>> = { water: 'fire', fire: 'earth', earth: 'wind', wind: 'water' };

export function elementMultiplier(attack: Element, defend: Element): number {
  if (attack === 'holy' && defend === 'dark') return 1.5;
  if (attack === 'dark' && defend === 'holy') return 1.5;
  if (BEATS[attack] === defend) return 1.5;
  if (BEATS[defend] === attack) return 0.75;
  return 1;
}

export function isElement(v: string): v is Element {
  return (ELEMENTS as readonly string[]).includes(v);
}
