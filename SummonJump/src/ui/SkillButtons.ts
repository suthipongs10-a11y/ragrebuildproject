import { cooldownLeft, type SkillDef } from '@shared/index';
import type { HeroSession } from '../hero/HeroSession';
import { t } from '../i18n';
import { ART } from '../assets/manifest.generated';

/** Shows the slotted skill's icon (P03 art) + short name on S1–S3 and a cooldown curtain. Cheap: touches the DOM only when values change. */
export class SkillButtons {
  private readonly btns = [...document.querySelectorAll<HTMLButtonElement>('.pb.sk')];
  private last = '';

  update(session: HeroSession): void {
    const d = session.data, rt = session.rt;
    const state = d.slots.map((id) => `${id}:${id ? Math.ceil(cooldownLeft(rt, id) * 4) : 0}`).join('|');
    if (state === this.last) return;
    this.last = state;
    this.btns.forEach((b, i) => {
      const id = d.slots[i] ?? null;
      const def = id ? (session.content.skills.find((s) => s.id === id) as SkillDef) : null;
      b.classList.toggle('empty', !def);
      const name = def ? t(`skill.${def.id}`) : `S${i + 1}`;
      const left = def ? cooldownLeft(rt, def.id) : 0;
      const pct = def && def.cd > 0 ? Math.min(100, (left / def.cd) * 100) : 0;
      const icon = def ? ART[def.icon] : undefined;
      b.classList.toggle('icon', !!icon);
      b.style.backgroundImage = icon ? `url(${icon.url})` : '';
      b.innerHTML = `<span class="nm">${short(name)}</span>${pct > 0 ? `<span class="cd" style="height:${pct}%"></span>` : ''}`;
    });
  }
}

const short = (s: string) => (s.length > 10 ? `${s.slice(0, 9)}…` : s);
