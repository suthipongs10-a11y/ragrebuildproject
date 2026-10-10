import { canChangeJob, skillDef, type JobId } from '@shared/index';
import { t } from '../../i18n';
import { ART } from '../../assets/manifest.generated';
import type { HeroSession } from '../../hero/HeroSession';
import './job.css';

/** Job change: one card per job with rating bars, strengths ✓ / weaknesses ✗, weapon and skills (owner request). */
const ICON: Record<string, string> = { swordsman: '⚔️', mage: '🪄', archer: '🏹', acolyte: '✝️' };
const RATINGS = ['dmg', 'tank', 'range', 'support', 'ease'];

const bar = (k: string, n: number) => `<div class="jb-bar"><span>${t(`jobrate.${k}`)}</span><i>${'<b class="on"></b>'.repeat(n)}${'<b></b>'.repeat(5 - n)}</i></div>`;
const list = (key: string, mark: string, cls: string) => t(key).split('|').map((x) => `<li class="${cls}">${mark} ${x}</li>`).join('');

export function jobTab(s: HeroSession, ask = ''): string {
  const h = s.data, c = s.content;
  const jobs = c.jobs.filter((j) => j.from_job === h.job);
  if (!jobs.length) return `<div class="mn-h">${t('menu.jobTitle')}</div><div class="mn-note">${t('menu.jobDone')}</div>`;
  const need = jobs[0]?.job_lv_req ?? 10, basic = h.skills.basic_skill ?? 0;
  const req = `<div class="jb-req">${t('jobreq.joblv').replace('{n}', String(h.jobLv)).replace('{max}', String(need))}${h.jobLv >= need ? ' ✓' : ''}
    ${h.job === 'novice' ? ` · ${t('jobreq.basic').replace('{n}', String(basic))}${basic >= 9 ? ' ✓' : ''}` : ''}</div>`;
  const cards = jobs.map((j) => {
    const why = canChangeJob(h, c, j.id as JobId);
    const skills = j.skills.map((id) => skillDef(c, id)).filter((d) => d && d.type === 'active').map((d) => `<span class="jb-chip">${t(d?.name_key ?? '')}</span>`).join('');
    return `<div class="jb-card">
      <div class="jb-top">${ART[`job_${j.id}_design`] ? `<span class="jb-icon art" style="background-image:url(${ART[`job_${j.id}_design`]?.url})"></span>` : `<span class="jb-icon">${ICON[j.id] ?? '⭐'}</span>`}<span class="grow"><b>${t(j.name_key)}</b><small>${t(`job.${j.id}.desc`)}</small></span></div>
      <div class="jb-bars">${RATINGS.map((k) => bar(k, j.ratings[k] ?? 0)).join('')}</div>
      <ul class="jb-pc">${list(`job.${j.id}.pros`, '✓', 'pro')}${list(`job.${j.id}.cons`, '✗', 'con')}</ul>
      <div class="jb-skills"><small>${t('jobinfo.weapon')}: ${j.weapons.map((w) => t(`wtype.${w}`)).join(', ')} · ${t('jobinfo.skills')}</small>${skills}</div>
      ${ask === j.id && !why ? `<div class="jb-ask">${t('job.confirm').replace('{job}', t(j.name_key))}
        <div class="jb-ask-btns"><button class="mn-btn" data-act="job:${j.id}">${t('job.yes')}</button><button class="mn-btn sec" data-act="jobno">${t('job.no')}</button></div></div>`
      : `<button class="mn-btn jb-go" data-act="jobask:${j.id}"${why ? ' disabled' : ''}>${why ? t(`jobwhy.${why}`) : `${t('menu.become')}${t(j.name_key)}`}</button>`}
    </div>`;
  }).join('');
  return `<div class="mn-h">${t('menu.jobTitle')}</div>${req}<div class="jb-grid">${cards}</div>`;
}
