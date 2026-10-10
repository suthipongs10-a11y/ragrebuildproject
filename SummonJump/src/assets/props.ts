import { ART } from './manifest.generated';

/**
 * P01 World Props / P05 portal art per room object, with the legacy icon as fallback.
 * `h` = height on screen in px (feet on the entity's ground point).
 */
export interface PropLook { key: string; alt?: string; h: number }

const P = (key: string, h: number, alt?: string, legacy?: string): PropLook =>
  ART[key] ? { key, alt: alt && ART[alt] ? alt : undefined, h } : { key: legacy ?? 'icon_chest', h };

export function propLook(type: string, fields: Record<string, unknown>): PropLook | null {
  switch (type) {
    case 'Sign': return P('prop_sign_wood', 64, undefined, 'icon_sign');
    case 'Altar': return P('prop_altar', 74, undefined, 'icon_altar');
    case 'Anvil': return P('prop_anvil', 56, undefined, 'icon_anvil');
    case 'SavePoint': return P('prop_statue_off', 92, 'prop_statue_on', 'icon_fountain');
    case 'Chest': return P('prop_chest_closed', 50, 'prop_chest_open', 'icon_chest');
    case 'Gate': return P(`prop_rune_${({ double: 'wind', dive: 'water', break: 'fire' } as Record<string, string>)[String(fields.ability)] ?? 'wind'}`, 26, undefined,
      ({ double: 'icon_e_wind', dive: 'icon_e_water', break: 'icon_e_fire' } as Record<string, string>)[String(fields.ability)] ?? 'icon_e_wind');
    case 'Npc': { const id = String(fields.npc); return ART[`npc_${id}_idle`] ? { key: `npc_${id}_idle`, alt: ART[`npc_${id}_talk`] ? `npc_${id}_talk` : undefined, h: 108 } : null; }
    default: return null;
  }
}

/** Extra pictures a room's objects need (loaded with the room). */
export function propKeys(entities: readonly { type: string; fields: Record<string, unknown> }[]): string[] {
  const keys = new Set<string>();
  for (const e of entities) {
    const l = propLook(e.type, e.fields);
    if (l) { keys.add(l.key); if (l.alt) keys.add(l.alt); }
    if (e.type === 'Npc' && e.fields.npc === 'portal') keys.add('prop_portal_gate');
  }
  keys.add('prop_rock_debris');
  return [...keys].filter((k) => ART[k]);
}
