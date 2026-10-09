import {
  awaken, equipRune, familyOf, teamAbilities, fodderNeeded, sellRune, setTeam, spiritOf, starUp, summon, unequipRune, upgradeCost, upgradeRune,
  type Element, type Rng,
} from '@shared/index';
import { t } from '../../i18n';
import type { MenuHost } from './Menu';
import type { SpiritMenuState } from './spiritTabs';

/**
 * Spirit / rune / summon menu actions. Returns null if the verb isn't ours, else the note to show ('' = none).
 * Every change goes through shared rules; the host then saves and refreshes the world (team, abilities, leader).
 */
export function spiritAct(verb: string, x: string, y: string, st: SpiritMenuState, h: MenuHost, rng: Rng): string | null {
  const s = h.session, b = s.box, c = s.content;
  const rune = (uid: string) => b.runes.find((r) => r.uid === Number(uid));
  let note = '';
  switch (verb) {
    case 'spsel': st.sel = Number(x); st.mode = 'info'; st.fodder = []; return '';
    case 'spmode': st.mode = x as SpiritMenuState['mode']; st.fodder = []; st.slot = null; return '';
    case 'spteam': case 'spout': {
      const before = teamAbilities(b, c);
      if (verb === 'spteam') setTeam(b, Number(x), Number(y));
      else { const i = b.team.indexOf(Number(x)); if (i >= 0) setTeam(b, i, null); }
      const lost = [...before].filter((a) => !teamAbilities(b, c).has(a));
      if (lost.length) note = t('sp.lostAbility').replace('{a}', lost.map((a) => t(`ability.${a}`)).join(', '));
      break;
    }
    case 'spfod': {
      const uid = Number(x), sel = spiritOf(b, st.sel);
      if (st.fodder.includes(uid)) st.fodder = st.fodder.filter((u) => u !== uid);
      else if (sel && st.fodder.length < fodderNeeded(sel)) st.fodder.push(uid);
      return '';
    }
    case 'spstar': {
      const sel = st.sel;
      if (sel !== null && starUp(b, sel, st.fodder)) { const sp = spiritOf(b, sel); note = t('sp.starDone').replace('{n}', String(sp?.star ?? 0)); st.mode = 'info'; st.fodder = []; }
      break;
    }
    case 'spawk': if (awaken(b, c, s.data, Number(x))) note = t('sp.awakenDone').replace('{name}', t(familyOf(c, spiritOf(b, Number(x))?.id ?? '')?.name_key ?? '')); break;
    case 'runeslot': st.slot = Number(x) || null; return '';
    case 'runeon': if (st.sel !== null) equipRune(b, Number(x), st.sel); break;
    case 'runeoff': unequipRune(b, Number(x)); break;
    case 'runesell': h.save.zeny += sellRune(b, Number(x)); break;
    case 'runeup': {
      const r = rune(x);
      if (!r) break;
      const cost = upgradeCost(c, r);
      if (h.save.zeny < cost) break;
      h.save.zeny -= cost;
      note = upgradeRune(c, r, rng) ? t('rune.upOk').replace('{n}', String(r.lv)) : t('rune.upFail');
      break;
    }
    case 'sumel': st.pickEl = x; return '';
    case 'sum': {
      st.results = [];
      for (let i = 0; i < Number(y); i++) {
        const r = summon(b, c, s.data, x, rng, st.pickEl as Element);
        if (!r) break;
        st.results.push({ uid: r.spirit.uid, star: r.star, pity: r.pity });
      }
      st.anim++;
      const best = Math.max(0, ...st.results.map((r) => r.star));
      note = st.results.length ? t('sum.got').replace('{n}', String(st.results.length)).replace('{s}', String(best)) : '';
      break;
    }
    default: return null;
  }
  h.flush();
  h.onSpiritsChanged();
  return note;
}
