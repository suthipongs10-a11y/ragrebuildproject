// @ts-nocheck
// App shell: scenes (idle / battle / hatch), DOM screens, input, save.
import { SPECIES, STAGES, ZONES, ZONE_PLAN, planOf, starbornOf, rareFormChance, DIFFS, stageKey, parseStage, stageOf, ENERGY_MAX, ENERGY_REFILL_GEMS, ENERGY_REFILL_DAILY, STAR_SHARDS_TO_CRAFT, STAR_SHARD_CHANCE, STARTERS, ELEM_NAME, ROLE_NAME, RARITY_NAME, statAt, spdAt, expToNext, levelCap, LOOT_GRADES, EGG_TIERS, EGG_TIER_ORDER, EGG_DROP, NAMED_RARE_FORM, RARE_FORM_MULT, NAT_STARS, MAX_STARS, natStars, EVO_GOLD, SKILL_MAX, SKILL_STEP, FEED_MAX, GEM_GOLD_EGG, formOf } from './core/data';
import { Battle } from './core/battle';
import { drawShowcase, showcaseTap } from './render/showcase';
import { loadAssets, portrait, eggURL, eggURLOf, eggOf, TIER_COL, PAL, IMG, lookOf, starHTML, uiSrc, masterURL, rareMasterURL, ensureArt, artReady, prefetchExt, EXT_STAT } from './render/assets';
import { audioInit, setSound, sfx } from './render/audio';
import { E, initCanvas, toWorld, updScripts, updParts, tickEngine, clearAll, worldTransform, drawGround, drawDecals, drawLanternPools, drawParts, drawFlies, drawLantern, drawBush, LANTERNS, BUSHES, drawOverlays, clamp } from './render/engine';
import { setLocation, clearLocation, prefetchPlates, plateStat, LOC_IDS } from './render/locations';
import { BattleView } from './render/battleView';
import { HatchView } from './render/hatchView';
import { HomeView } from './render/homeView';
import { showChest } from './render/chestView';
import { home, BDEF, upgrade, upgradeCost, maxLevelNow, mineStored, mineCap, collectMine, MINE_RATE, MINE_CAP_MIN, TURTLE_SCALE, CASTLE_COST, BUILDINGS, ELEMS, shrineCost, shrineUp, shrineMax, SHRINE_ATK, SHRINE_REACT, RELICS, buyRelic, equipRelic, homeMods, unlocked, needsIncub, incubSlots, incubOf, incubMs, startIncub, canHatch, HATCH_SPEED } from './game/home';
import { loadSave, writeSave, resetSave, newMon } from './game/save';
import { grantRewards, stageUnlocked, craftEgg, craftStarEgg, hatchEgg, FRAGS_TO_CRAFT, eggOdds, rollMysteryEgg, lootOf, monOf, copiesOf, teamHasSpecies, feedPreview, feed, feedValue, evoCheck, evolve, skillUp, skillMaxed } from './game/progression';
import { EvolveView } from './render/evolveView';
import { energyNow, energyNext, payAuto, autoCost, buyEnergy, refillsLeft } from './game/energy';
import { QUESTS, CHAPTERS, questsIn, chapterDone, chapterClaimable, claimable, claimQuest, bookGems, buyGoldEgg, rushCost, rushEgg, rushPrice, rushesToday } from './game/quests';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let S = loadSave();
const save = () => writeSave(S);
setSound(S.settings.sound); E.quality = { low: .35, mid: .7, high: 1 }[S.settings.quality];

// ---------- scenes ----------
const idleScene = {
  update(dt) { E.camT.x = Math.sin(E.time * .08) * 160; E.camT.y = -20; E.zoomT = 1; },
  render() { worldTransform(); drawGround(); drawDecals(); drawLanternPools(); const ents = []; for (const L of LANTERNS) ents.push({ y: L.y, d: () => drawLantern(L) }); for (const b of BUSHES) ents.push({ y: b.y, d: () => drawBush(b) }); ents.sort((a, b) => a.y - b.y); for (const e of ents) e.d(); drawParts(); drawFlies(); drawOverlays(); },
};
let scene = idleScene, battle = null, hatch = null, homeV = null;
function baseFor(sc) { if (sc === homeV && homeV) return homeV.fit(); if (sc === battle) return E.W < E.H ? clamp(Math.min(E.W / 540, (E.H - 230) / 700), .34, 1.25) : clamp(Math.min(E.W / 1000, (E.H - 190) / 720), .34, 1.25); return clamp(Math.min(E.W * 1.3, E.H) / 760, .55, 1.25); }

// ---------- nav & screens ----------
const NAV = [['home', 'บ้านเต่า', '<path d="M4 15c0-4 3.6-7 8-7s8 3 8 7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 11l2 2 2-2 2 2 2-2" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="20.5" cy="14" r="1.8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 15l-1 3M18 15l1 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'],
  ['map', 'แผนที่', '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 4v14M15 6v14" stroke="currentColor" stroke-width="1.8"/>'],
  ['team', 'ทีม', '<circle cx="8" cy="9" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="16" cy="9" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 19c1-3 3-4 5-4s4 1 5 4M11 19c1-3 3-4 5-4s4 1 5 4" fill="none" stroke="currentColor" stroke-width="1.8"/>'],
  ['mons', 'มอน', '<path d="M5 18c0-6 3-11 7-11s7 5 7 11z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 7l-2-3M16 7l2-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="12" r="1" fill="currentColor"/><circle cx="14" cy="12" r="1" fill="currentColor"/>'],
  ['hatch', 'ฟักไข่', '<path d="M12 3c-4 0-7 6-7 10a7 7 0 0014 0c0-4-3-10-7-10z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 13l2 1.5 2-2 2 2 2-1.5" fill="none" stroke="currentColor" stroke-width="1.6"/>'],
  ['settings', 'ตั้งค่า', '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>']];
let mapRealm = null, cur = 'home', teamCtx = null, selMon = null, confirmReset = false, monMode = null, food = [], skFlash = -1, monTab = 'mine', dexSel = null, dexEl = 'all';
function renderNav() {
  $('#nav').innerHTML = NAV.map(([id, l, svg]) => `<button type="button" data-nav="${id}" ${cur === id ? 'aria-current="page"' : ''}><svg viewBox="0 0 24 24">${svg}</svg>${l}${id === 'hatch' && actionableEggs() ? `<span class="badge">${actionableEggs()}</span>` : ''}</button>`).join('');
}
function actionableEggs() { const free = incubSlots(S) - home(S).incub.length; let n = 0, inc = 0; for (const e of S.eggs) { if (canHatch(S, e)) n++; else if (!incubOf(S, e.id)) inc++; } return n + Math.min(free, inc); }
function show(id) { cur = id; teamCtx = id === 'team' ? teamCtx : null; render(); }
const starStr = (n, max = MAX_STARS) => Array.from({ length: max }, (_, i) => i < n ? '★' : '<span class="off">★</span>').join('');
const elDot = el => `<span class="ed" style="background:${PAL[el].aura}" title="${ELEM_NAME[el]}"></span>`;
/** small message at the bottom of the screen */
function toast(msg) { document.querySelector('.toast')?.remove(); const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.classList.add('out'), 2200); setTimeout(() => t.remove(), 2700); }
function render() {
  document.querySelector('.zpanel')?.remove(); // the zone sheet lives on <body> (above the nav bar)
  const el = $('#screens'); renderNav(); $('#nav').hidden = false; $('#bhud').hidden = true;
  if (cur === 'home') { if (!homeV) homeV = new HomeView(S, { onSelect: id => { selB = id; renderPanel(); } }); homeV.S = S; homeV.syncMons(); if (!battle && !hatch) scene = homeV; el.innerHTML = homeHTML(); renderPanel(); return; }
  if (!battle && !hatch) scene = idleScene; selB = null; if (homeV) homeV.sel = null;
  if (cur === 'map') { el.innerHTML = mapHTML(); placeMap(); } else if (cur === 'team') el.innerHTML = teamHTML(); else if (cur === 'mons') el.innerHTML = monsHTML(); else if (cur === 'hatch') el.innerHTML = hatchHTML(); else if (cur === 'settings') el.innerHTML = settingsHTML(); else if (cur === 'book') el.innerHTML = bookHTML();
}
const mmss = ms => { const t = Math.ceil(ms / 1000); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
function enLabel() { const v = energyNow(S), n = energyNext(S); return `${v}/${ENERGY_MAX}` + (n ? ` <small>+1 ${mmss(n)}</small>` : ''); }
/** separate-file art status for the settings screen (Starborn sprites + painted battle plates) */
const extLine = () => { const p = plateStat(), x = EXT_STAT; return `ฉากต่อสู้ ${p.ok}/${p.total} · ตำนานดารา ${x.ok}/${x.total}${x.way ? ` (โหลดแบบ ${x.way})` : ''}${x.fail ? ` · โหลดไม่ได้ ${x.fail} ครั้ง: ${esc(x.err)}` : ''}`; };
const enPill = () => `<button class="gold en" type="button" data-en="open" title="พลังงาน — ใช้เฉพาะตอนเปิด AUTO · เล่นเองไม่ใช้ · แตะเพื่อเติมด้วยเพชร"><b>⚡</b><span class="enTxt">${enLabel()}</span><em class="enplus">+</em></button>`;
/** gem energy refill sheet (owner 2026-10-13: ENERGY_REFILL_DAILY per local day); `need` = the AUTO cost that brought the player here */
let enNeed = 0;
function enCard() {
  const v = energyNow(S), nx = energyNext(S), left = refillsLeft(S), poor = S.gems < ENERGY_REFILL_GEMS;
  return `<div class="card encard"><h2>⚡ พลังงาน AUTO</h2><p class="ennow"><b>${v}</b>/${ENERGY_MAX}${nx ? ` <small>+1 ใน ${mmss(nx)}</small>` : ''}</p>` +
    `<p class="note" style="text-align:center;margin:0">${enNeed ? `เปิด AUTO ด่านนี้ใช้ ⚡${enNeed} (มี ${v})` : 'ใช้เฉพาะตอนเปิด AUTO'} · เล่นเองไม่ใช้พลังงาน · ฟื้น 1 แต้มทุก 5 นาที</p>` +
    `<div class="enbuy"><span>เติม <b>+${ENERGY_MAX}</b> ⚡</span><span class="gold gem sm"><i></i>${ENERGY_REFILL_GEMS}</span></div>` +
    `<p class="note" style="text-align:center;margin:0">วันนี้เติมได้อีก <b>${left}/${ENERGY_REFILL_DAILY}</b> ครั้ง (เริ่มใหม่เที่ยงคืน) · เติมเกินหลอดได้${left && poor ? ` · <b>เพชรไม่พอ</b> (มี ${S.gems})` : ''}</p>` +
    `<div class="row"><button class="go" type="button" data-en="buy" ${left && !poor ? '' : 'disabled'}>${left ? 'เติมด้วยเพชร' : 'ครบลิมิตวันนี้แล้ว'}</button><button class="alt" type="button" data-en="close">ปิด</button></div></div>`;
}
function enModal(need = 0) {
  enNeed = need; document.querySelector('#enModal')?.remove();
  const m = document.createElement('div'); m.className = 'modal'; m.id = 'enModal'; m.innerHTML = enCard(); document.body.appendChild(m);
}
function enAct(k) {
  if (k === 'open') { sfx.click(); enModal(); return; }
  document.querySelector('#enModal')?.remove();
  if (k !== 'buy' || !buyEnergy(S)) return;
  save(); sfx.coin(); toast(`เติมพลังงาน +${ENERGY_MAX} ⚡ · วันนี้เติมได้อีก ${refillsLeft(S)} ครั้ง`);
  if (battle) { // came from the AUTO button: switch AUTO on now that it can be paid
    if (enNeed && !battle.auto && !battle.autoPaid && payAuto(S, battle.stage)) { battle.autoPaid = true; battle.auto = S.settings.auto = true; save(); renderBattleButtons(); hudBattle(battle); }
  } else if (!hatch && cur !== 'home') render();
  else { const l = enLabel(); for (const e of document.querySelectorAll('.enTxt')) e.innerHTML = l; for (const e of document.querySelectorAll('.topbar .gold.gem')) e.innerHTML = `<i></i>${S.gems.toLocaleString()}`; }
}
function topbar(title, sub) { return `<div class="topbar"><div class="realm"><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="row" style="flex:0 0 auto;align-items:center"><span class="proto">P0 PROTOTYPE</span>${bookBtn()}${enPill()}<span class="gold gem"><i></i>${S.gems.toLocaleString()}</span><span class="gold"><i></i>${S.gold.toLocaleString()}</span></div></div>`; }
/** realms (one map each): name + tagline; a realm opens when its first stage unlocks */
const REALMS = { '1': ['ทุ่งไข่ป่วน', 'ภพที่ 1 · บ้านเกิดของเผ่าไข่ป่วน'], '2': ['สุวรรณภูมิ', 'ภพที่ 2 · ดินแดนทองแห่งตำนานไทย นาค กินรี คชสีห์'], '3': ['สวรรค์บูรพา', 'ภพที่ 3 · สวรรค์ตะวันออก ปี่เซียะ จิ้งจอกเก้าหาง ราชาอสูรวัว'] };
const realmOf = id => stageOf(id)?.realm || id.split('-')[0];
const realmOpen = r => stageUnlocked(S, STAGES.find(st => st.realm === r).id);
/** world map (2026-10-13): each realm is a sea-of-clouds chart our turtle sails; zones are islands (their painted arena in
 *  a round frame) joined by a dotted route. Positions are % of a 16:9 chart, tuned to the BATCH18 painting when it lands. */
/** landmark centres on the painted realm charts (BATCH18 v2, % of the 16:9 image) — the route and pins follow them */
const MAP_POS = {
  meadow: [22, 56], stream: [54.5, 45], rootnest: [79.5, 23],
  goldforest: [13.5, 59], ricefield: [30, 35], village: [41.5, 65], kinnari: [59, 32], temple: [71, 57], nagapool: [85, 29],
  jade: [17.5, 59], palace: [28.5, 26], foxvalley: [44.5, 71], toadbridge: [57, 37], heaven: [72.5, 12], firecave: [80, 53],
};
const ART_BG = typeof __BG__ !== 'undefined' ? __BG__ : [];
const zoneStagesOf = zid => STAGES.filter(st => st.zone === zid);
const zoneOpen = z => stageUnlocked(S, z.id + '-1');
const zoneStars = z => zoneStagesOf(z.id).reduce((a, st) => a + (S.stages[st.id] || 0), 0);
const zoneBoss = z => STAGES.find(st => st.id === z.id + '-5').waves.flat().find(m => m.boss || SPECIES[m.sid]?.boss);
// difficulties (ง่าย · ปานกลาง · ยาก): stars, unlock and clear state per zone; stage keys come from stageKey()
const zoneDiffStars = (z, d) => zoneStagesOf(z.id).reduce((a, st) => a + (S.stages[stageKey(st.id, d)] || 0), 0);
const zoneDiffOpen = (z, d) => stageUnlocked(S, stageKey(z.id + '-1', d));
const zoneDiffCleared = (z, d) => (S.stages[stageKey(z.id + '-5', d)] || 0) > 0;
/** the next stage after this one at the same difficulty, when it is open */
const nextStageKey = key => { const { id, d } = parseStage(key), i = STAGES.findIndex(x => x.id === id), n = STAGES[i + 1]; if (!n) return null; const k = stageKey(n.id, d); return stageUnlocked(S, k) ? k : null; };
const stageLabel = key => { const st = stageOf(key); return st ? `${st.name} ${st.n}${st.diff ? ' · ' + DIFFS[st.diff].name : ''}` : key; };
const diffPips = z => DIFFS.map((D, d) => `<i class="dp ${zoneDiffCleared(z, d) ? 'on' : zoneDiffOpen(z, d) ? 'open' : ''}" style="--dc:${D.col}" title="${D.name}${zoneDiffCleared(z, d) ? ' · ชนะบอสแล้ว' : ''}"></i>`).join('');
let mapZone = null, mapScroll = null, mapDiff = 0; // mapScroll: [realm, scrollLeft] kept across re-renders
/** keep the chart where the player left it; first visit of a realm centres on the island the turtle is at */
function placeMap() {
  if (mapZone) document.body.insertAdjacentHTML('beforeend', zonePanel(ZONES.find(z => z.id === mapZone)));
  const w = $('.wmap'); if (!w) return;
  w.addEventListener('scroll', () => { mapScroll = [mapRealm, w.scrollLeft]; }, { passive: true });
  if (mapScroll && mapScroll[0] === mapRealm) { w.scrollLeft = mapScroll[1]; return; }
  const p = $('.pin.here') || [...document.querySelectorAll('.pin:not(.locked)')].pop();
  if (p) w.scrollLeft = Math.max(0, p.offsetLeft - w.clientWidth / 2);
}
function mapHTML() {
  const realms = [...new Set(ZONES.map(z => z.realm))];
  if (!mapRealm || !realmOpen(mapRealm)) mapRealm = [...realms].reverse().find(realmOpen) || '1';
  const [title, sub] = REALMS[mapRealm] || ['ภพที่ ' + mapRealm, ''], zones = ZONES.filter(z => z.realm === mapRealm);
  const tabs = `<div class="seg realms">${realms.map(r => { const op = realmOpen(r), zs = ZONES.filter(z => z.realm === r), done = zs.filter(z => (S.stages[z.id + '-5'] || 0) > 0).length;
    return `<button type="button" class="${r === mapRealm ? 'on' : ''}" data-realm="${r}" ${op ? '' : 'disabled'}>${op ? '' : '🔒 '}${r}. ${REALMS[r]?.[0] || ''} <small>${done}/${zs.length}</small></button>`; }).join('')}</div>`;
  const here = zones.find(z => zoneOpen(z) && zoneStagesOf(z.id).some(st => !(S.stages[st.id] > 0))) || null; // where the turtle is
  const route = zones.map(z => MAP_POS[z.id]).map(([x, y]) => `${x * 16},${y * 9}`).join(' ');
  const pins = zones.map(z => {
    const [x, y] = MAP_POS[z.id], op = zoneOpen(z), st = zoneStars(z), b = zoneBoss(z), bs = SPECIES[b.sid], star = bs?.starborn, art = ART_BG.includes(z.loc);
    const cleared = (S.stages[z.id + '-5'] || 0) > 0;
    return `<button type="button" class="pin ${op ? '' : 'locked'} ${z === here ? 'here' : ''} ${cleared ? 'clear' : ''} ${star ? 'starborn' : ''}" style="left:${x}%;top:${y}%" data-zone="${z.id}" ${op ? '' : 'disabled'}>
      <span class="isle loc-${z.loc}" ${art ? `style="background-image:url('bg/${z.loc}.webp')"` : ''}></span>
      ${op ? `<span class="bossb"><img src="${portrait(b.sid)}" alt=""></span>` : '<span class="lock">🔒</span>'}
      <span class="lbl"><b>${esc(z.name)}</b><small>${op ? `<span class="dps">${diffPips(z)}</span> <span class="stars">★</span> ${DIFFS.reduce((a, D, d) => a + zoneDiffStars(z, d), 0)}/${DIFFS.length * 15}${star ? ' · ✦' : ''}` : 'ยังไม่ปลดล็อก'}</small></span></button>`;
  }).join('');
  const chart = `<div class="wmap"><div class="wmap-in realm${mapRealm} ${ART_BG.includes('map' + mapRealm) ? 'art' : ''}" ${ART_BG.includes('map' + mapRealm) ? `style="background-image:url('bg/map${mapRealm}.webp')"` : ''}>
    <svg viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true"><polyline points="${route}" /></svg>${pins}</div></div>`;
  return `<section class="scr dim mapscr"><div class="wrap">${topbar(title, sub)}${tabs}${chart}<p class="note">แตะเกาะเพื่อดูด่าน · แต่ละโซนมี 5 ด่าน ด่านที่ 5 เป็นบอส · บอสตำนานดารา (✦) มีโอกาสดรอปเศษไข่ดารา ${STAR_SHARD_CHANCE * 100}% ต่อรอบ ครบ ${STAR_SHARDS_TO_CRAFT} ชิ้นประกอบเป็นไข่ได้ · เล่นเองไม่ใช้พลังงาน เปิด AUTO ใช้พลังงาน ⚡ ตามด่าน (ฟื้น 1 แต้มทุก 5 นาที เต็ม ${ENERGY_MAX}) · ดาวของด่าน: ★ ผ่านด่าน · ★ ไม่มีมอนตาย · ★ ทำปฏิกิริยาธาตุได้อย่างน้อย 1 ครั้ง</p>
  </div></section>`;
}
/** a zone's sheet: painted header, its boss (and Starborn shard progress) and the five stages */
function zonePanel(z) {
  if (!z) return '';
  const b = zoneBoss(z), bs = SPECIES[b.sid], art = ART_BG.includes(z.loc), shards = S.starShards?.[b.sid] || 0;
  while (mapDiff > 0 && !zoneDiffOpen(z, mapDiff)) mapDiff--; // the sheet opens on the last chosen difficulty this zone allows
  const dd = mapDiff, D = DIFFS[dd];
  const dtabs = `<div class="dtabs">${DIFFS.map((X, d) => { const op = zoneDiffOpen(z, d); return `<button type="button" class="dtab ${d === dd ? 'on' : ''} ${zoneDiffCleared(z, d) ? 'clear' : ''}" style="--dc:${X.col}" data-zdiff="${d}" ${op ? '' : 'disabled'}><b>${op ? '' : '🔒 '}${X.name}</b><small>${op ? `<span class="stars">★</span> ${zoneDiffStars(z, d)}/15` : `ชนะบอส${DIFFS[d - 1].name}ก่อน`}</small></button>`; }).join('')}</div>
    <p class="dnote">${dd ? `ศัตรู ★+${D.stars} แข็งแรงขึ้น · ทอง ×${D.gold} · EXP ×${D.exp} · ไข่ปริศนาลายดีขึ้น · เศษไข่ +${D.frag}${bs.starborn ? ` · เศษไข่ดารา ${D.shard * 100}%` : ''}` : 'ระดับเริ่มต้น · ชนะบอสโซนนี้เพื่อเปิดระดับปานกลาง'}</p>`;
  const rows = zoneStagesOf(z.id).map(base => {
    const key = stageKey(base.id, dd), st = stageOf(key), un = stageUnlocked(S, key), stars = S.stages[key] || 0, boss = st.n === 5, [pl, ps] = planOf(st);
    const els = [...new Set(st.waves.flat().map(m => formOf(m.sid, !!m.rare).elem))];
    return `<div class="stage ${un ? '' : 'locked'} ${boss ? 'boss' : ''}"><div class="num">${boss ? `<img src="${portrait(b.sid)}" alt="">` : st.n}</div><div style="min-width:0"><div class="nm">${boss ? 'บอส · ' + esc(b.name || bs.name) : 'ด่าน ' + st.n}</div><div class="meta"><span class="stars">${starStr(stars, 3)}</span><span>แนะนำ ★${ps} Lv.${pl}</span><span title="พลังงานที่ใช้ตอนเปิด AUTO">AUTO ⚡${autoCost(st)}</span><span>ธาตุ ${els.map(elDot).join(' ')}</span></div></div><button class="go" type="button" data-stage="${key}" ${un ? '' : 'disabled'}>${un ? 'สู้' : 'ล็อก'}</button></div>`;
  }).join('');
  return `<div class="zpanel" data-zclose="1"><div class="zsheet" role="dialog" aria-label="${esc(z.name)}">
    <div class="zhead loc-${z.loc}" ${art ? `style="background-image:linear-gradient(180deg,rgba(10,10,14,0) 30%,rgba(10,10,14,.9)),url('bg/${z.loc}.webp')"` : ''}><button type="button" class="zx" data-zclose="1" aria-label="ปิด">✕</button><h2>${esc(z.name)}</h2><p>${esc(z.desc)}</p></div>
    ${bs.starborn ? `<div class="zstar"><img src="${eggURL(b.sid)}" alt=""><div><b>ตำนานดารา · ${esc(bs.name)}</b><div class="bar fr"><i style="transform:scaleX(${Math.min(1, shards / STAR_SHARDS_TO_CRAFT)})"></i></div><small>เศษไข่ดารา ${shards}/${STAR_SHARDS_TO_CRAFT} · ชนะบอสครั้งแรกได้ 1 ชิ้น หลังจากนั้น ${STAR_SHARD_CHANCE * 100}% ต่อรอบ (ปานกลาง ${DIFFS[1].shard * 100}% · ยาก ${DIFFS[2].shard * 100}%)</small></div></div>` : ''}
    ${dtabs}<div class="stages">${rows}</div></div></div>`;
}
/** rarity colour (shared with the chest/hatch colour language) as a CSS var; common stays neutral */
const rcVar = s => s.rarity === 'common' ? '' : `--rc:${LOOT_GRADES[s.rarity].col}`;
const rarChip = s => `<span class="chip rar" style="${rcVar(s)}">${RARITY_NAME[s.rarity]}</span>`;
const look = m => lookOf(m.sid, m.stars, !!m.rare);
/** owned units, strongest first */
const units = () => [...S.mons].sort((a, b) => b.stars - a.stars || b.lvl - a.lvl || a.sid.localeCompare(b.sid) || a.uid - b.uid);
function monCard(uid, opts = {}) {
  const m = monOf(S, uid), s = SPECIES[m.sid];
  return `<button type="button" class="mcard ${opts.on ? 'on' : ''} ${opts.pick ? 'pick' : ''} ${opts.dup ? 'dup' : ''} ${s.rarity}" style="${rcVar(s)}" data-mon="${uid}">${opts.tag ? `<span class="tag">${opts.tag}</span>` : ''}${m.rare ? '<span class="rf" title="ร่างหายาก">✦</span>' : ''}<span class="pic ${m.rare ? 'rfp' : ''}"><img src="${portrait(look(m))}" alt=""></span><span class="n">${esc(s.name)}</span><span class="stars" style="font-size:.7rem">${starStr(m.stars)}</span><span class="lv">Lv.${m.lvl} ${elDot(formOf(m.sid, !!m.rare).elem)}</span></button>`;
}
function teamHTML() {
  const owned = units(), lm = monOf(S, S.team[0]), lead = lm && SPECIES[lm.sid].leader;
  return `<section class="scr dim"><div class="wrap">${topbar('จัดทีม', teamCtx ? `${esc(stageLabel(teamCtx))} · เลือก 4 ตัว ตัวแรกเป็นผู้นำ` : 'เลือก 4 ตัว ตัวแรกเป็นผู้นำ')}
  <div class="slots">${[0, 1, 2, 3].map(i => { const m = monOf(S, S.team[i]); return m ? `<button type="button" class="slot fill" data-slot="${i}">${i === 0 ? '<b>ผู้นำ</b>' : '<b>&nbsp;</b>'}<span class="pic"><img src="${portrait(look(m))}" alt=""></span>${esc(SPECIES[m.sid].name)}<span class="stars" style="font-size:.66rem">${starStr(m.stars)}</span></button>` : `<div class="slot">${i === 0 ? '<b>ผู้นำ</b>' : ''}ว่าง</div>`; }).join('')}</div>
  <div class="lead">สกิลผู้นำ: <b>${lead ? esc(lead.text) : '—'}</b></div>
  <h2 class="sec">มอนของคุณ (แตะเพื่อเพิ่ม/เอาออก · ชนิดเดียวกันลงได้ 1 ตัว)</h2><div class="mgrid">${owned.map(m => { const inT = S.team.includes(m.uid), dup = !inT && teamHasSpecies(S, m.sid); return monCard(m.uid, { on: inT, dup, tag: S.team[0] === m.uid ? 'ผู้นำ' : inT ? S.team.indexOf(m.uid) + 1 : dup ? 'ซ้ำ' : '' }); }).join('')}</div>
  <div class="row sticky">${teamCtx ? `<button class="go" type="button" data-act="fight" ${S.team.length === 4 ? '' : 'disabled'}>เริ่มต่อสู้</button><button class="alt" type="button" data-nav="map">กลับ</button>` : `<button class="alt" type="button" data-nav="map">เสร็จ</button>`}</div>
  ${S.team.length < 4 ? '<p class="note">ทีมต้องมีครบ 4 ตัว</p>' : ''}</div></section>`;
}
function stats(m, stars = m.stars, lvl = m.lvl) { const s = SPECIES[m.sid]; return { hp: statAt(s.base.hp, lvl, stars), atk: statAt(s.base.atk, lvl, stars), def: statAt(s.base.def, lvl, stars), spd: spdAt(s.base.spd, lvl, stars) }; }
const skLv = (m, i) => `<span class="sklv ${m.sk[i] >= SKILL_MAX[i] ? 'max' : ''} ${skFlash === i ? 'up' : ''}">Lv.${m.sk[i]}/${SKILL_MAX[i]}</span>`;
const monTabs = () => { const d = dexAll(), all = d.length, got = d.filter(dexHas).length; return `<div class="seg mtabs"><button type="button" class="${monTab === 'mine' ? 'on' : ''}" data-mt="mine">คลังของฉัน</button><button type="button" class="${monTab === 'dex' ? 'on' : ''}" data-mt="dex">สารบัญมอน ${got}/${all}</button></div>`; };
const REALM = { A: 'ทุ่งไข่ป่วน', B: 'สุวรรณภูมิ', C: 'สวรรค์บูรพา', S: 'ตำนานดารา' };
/** ★5 evolved-form preview (BATCH08 art) — shown in the book and the monster detail so the evolution can be seen before reaching it */
const evoRow = (s, reached, rare = false) => s.art && IMG[s.art + 'e_front_idle'] && natStars(s.id, rare) < 5 ? `<div class="evorow ${reached ? 'on' : ''}"><img src="${portrait(s.id + '~5' + (rare ? 'r' : ''))}" alt=""><div><b>✦ ร่างวิวัฒน์ ★5</b>${reached ? 'ปลดล็อกแล้ว — ร่างนี้ใช้ในสนามรบตอน ★5 ขึ้นไป' : 'อัปดาวถึง ★5 เพื่อเปลี่ยนเป็นร่างนี้ (หน้าตาและท่าทางใหม่ทั้งหมด)'}</div></div>` : '';
/** rare-form passive row: shown in full when unlocked, otherwise a locked "???" teaser */
const rareRow = (s, open, lockTxt) => s.rarePassive ? `<div class="rpas ${open ? '' : 'lock'}"><b>✦ สกิลร่างหายาก · ${open ? esc(s.rarePassive.name) : '???'}</b>${open ? esc(s.rarePassive.desc) : lockTxt}</div>` : '';
/** monster book (owner 2026-10-14): ONE slot per monster family — every form drawn from the same art (its normal element,
 *  the light/dark rare form, later a special edition) sits in that slot behind element buttons, each with its own data.
 *  Nothing is hidden: every form shows its art, skills and where to find it, so players know what to chase. */
const dexForms = s => [false, ...(s.rareForm ? [true] : [])].map(rare => ({ s, rare, key: s.id + (rare ? 'r' : ''), elem: formOf(s.id, rare).elem }));
const dexFams = () => Object.values(SPECIES).filter(x => !x.boss).sort((a, b) => a.id.localeCompare(b.id)).map(s => ({ s, forms: dexForms(s) }));
const dexAll = () => dexFams().flatMap(f => f.forms);
const dexHas = e => (e.rare ? S.dexRare : S.dex).includes(e.s.id);
const dexPic = e => portrait(e.rare ? lookOf(e.s.id, natStars(e.s.id, true), true) : e.s.id);
const pct = v => (v >= .1 ? Math.round(v * 1000) / 10 : Math.round(v * 10000) / 100) + '%';
/** chance that one mystery egg of each shell hatches this species (its rarity's share split over that rarity's species) */
const eggChances = (s, rare) => { const pool = Object.values(SPECIES).filter(x => !x.boss && !x.starborn), n = pool.filter(x => x.rarity === s.rarity).length || 1;
  return EGG_TIER_ORDER.map(t => { const T = EGG_TIERS[t], c = (T.rarityW[s.rarity] || 0) / 100 / n * (rare ? rareFormChance(T.rareForm, s.id) : 1); return c > 0 ? `${T.name.replace('ลาย', '')} ${pct(c)}` : ''; }).filter(Boolean).join(' · '); };
/** where to find a form: eggs, fragments from the zones it fights in, or (Starborn) shards from its boss zone */
function dexSources(e) {
  const { s, rare } = e, zoneName = id => ZONES.find(z => z.id === id)?.name || id;
  if (s.starborn) { const st = STAGES.find(x => starbornOf(x) === s.id); return [`เศษไข่ดาราจากบอส${st ? ' ' + esc(zoneName(st.zone)) : ''} · ชนะครั้งแรกได้ 1 ชิ้น แล้ว ${STAR_SHARD_CHANCE * 100}% ต่อรอบ · ครบ ${STAR_SHARDS_TO_CRAFT} ชิ้นประกอบเป็นไข่`, 'ไม่ออกจากไข่ปริศนา'];
  }
  const zones = [...new Set(STAGES.filter(st => st.waves.flat().some(m => m.sid === s.id)).map(st => st.zone))].map(zoneName);
  const out = [`ไข่ปริศนา${rare ? ' (ออกเป็นร่างหายาก)' : ''}: ${eggChances(s, rare)} ต่อฟอง`];
  out.push(`ไข่ระบุชื่อ (เศษไข่ ${FRAGS_TO_CRAFT} ชิ้น)${rare ? `: โอกาสเป็นร่างหายาก ${pct(rareFormChance(NAMED_RARE_FORM, s.id))} สูงสุดในเกม` : ''} · เศษไข่ได้จากการชนะ${zones.length ? ' ' + zones.map(esc).join(', ') : 'ด่านที่มีตัวนี้ (ยังไม่มีในแผนที่)'}`);
  return out;
}
function dexHTML() {
  const fams = dexFams(), all = fams.flatMap(f => f.forms), nGot = all.filter(dexHas).length;
  const list = dexEl === 'all' ? fams : fams.filter(f => f.forms.some(x => x.elem === dexEl));
  const elChips = `<button type="button" class="chip ${dexEl === 'all' ? 'on' : ''}" data-dexel="all">ทั้งหมด ${nGot}/${all.length}</button>` + Object.keys(ELEM_NAME).map(el => { const a = all.filter(x => x.elem === el); return a.length ? `<button type="button" class="chip ${dexEl === el ? 'on' : ''}" data-dexel="${el}">${elDot(el)} ${ELEM_NAME[el]} ${a.filter(dexHas).length}/${a.length}</button>` : ''; }).join('');
  const roles = Object.keys(ROLE_NAME).map(r => { const a = all.filter(x => x.s.role === r); return a.length ? `<span class="chip">${ROLE_NAME[r]} ${a.filter(dexHas).length}/${a.length}</span>` : ''; }).join('');
  const rars = ['common', 'rare', 'epic', 'legendary'].map(r => { const a = all.filter(x => x.s.rarity === r); return a.length ? `<span class="chip rar" style="${rcVar({ rarity: r })}">${RARITY_NAME[r]} ${a.filter(dexHas).length}/${a.length}</span>` : ''; }).join('');
  let det = '';
  const e = dexSel && all.find(x => x.key === dexSel);
  if (e) {
    const { s, rare } = e, has = dexHas(e), f = formOf(s.id, rare), nat = natStars(s.id, rare), img = (rare ? rareMasterURL(s.id) : masterURL(s.id)) || dexPic(e);
    const own = S.mons.filter(m => m.sid === s.id && !!m.rare === rare).length, forms = dexForms(s);
    const lo = { hp: statAt(s.base.hp, 1, nat), atk: statAt(s.base.atk, 1, nat), def: statAt(s.base.def, 1, nat) }, hi = { hp: statAt(s.base.hp, 40, 6), atk: statAt(s.base.atk, 40, 6), def: statAt(s.base.def, 40, 6) };
    const tabs = forms.length > 1 ? `<div class="ftabs">${forms.map(x => `<button type="button" class="ftab ${x.key === e.key ? 'on' : ''} ${x.rare ? 'rf' : ''}" data-dex="${x.key}">${elDot(x.elem)} ${ELEM_NAME[x.elem]}<small>${x.rare ? '✦ ร่างหายาก' : 'ร่างปกติ'} · ★${natStars(s.id, x.rare)}</small>${dexHas(x) ? '<i>✓</i>' : ''}</button>`).join('')}</div>` : '';
    det = `<div class="detail dexd">${tabs}<span class="dbig ${rare ? 'rfp' : ''}"><img src="${img}" alt=""></span><div style="min-width:0"><h3>${esc(s.name)} <small class="note">${esc(s.nameEn)}</small></h3>
    <div class="row" style="gap:6px;flex:0 0 auto;margin:6px 0"><span class="chip">${elDot(f.elem)} ${ELEM_NAME[f.elem]}</span><span class="chip">${ROLE_NAME[s.role]}</span>${rarChip(s)}${rare ? '<span class="chip rfc">✦ ร่างหายาก</span>' : ''}<span class="chip">${REALM[s.id[0]] || ''}</span></div>
    <div class="stars">${starStr(nat)}</div><div class="note">${has ? '<b style="color:#8fe39a">✓ ได้มาแล้ว</b>' : '<b style="color:#e8b0a0">ยังไม่ได้</b>'}${own ? ` · มีอยู่ ${own} ตัว` : ''}</div>
    <div class="stat"><div>HP<b>${lo.hp}</b><small>★6 เต็ม ${hi.hp}</small></div><div>ATK<b>${lo.atk}</b><small>★6 เต็ม ${hi.atk}</small></div><div>DEF<b>${lo.def}</b><small>★6 เต็ม ${hi.def}</small></div><div>SPD<b>${s.base.spd}</b><small>ฐาน</small></div></div></div>
    <div class="skl">${f.skills.map((k, i) => `<div><b>${i === 2 ? 'สุดยอด' : 'สกิล ' + (i + 1)} · ${esc(k.name)}</b>${esc(k.desc)}${k.cd ? `<em>คูลดาวน์ ${k.cd}</em>` : ''}</div>`).join('')}${s.leader ? `<div><b>ผู้นำ</b>${esc(s.leader.text)}</div>` : ''}${rare ? rareRow(s, true, '') : ''}${evoRow(s, S.mons.some(m => m.sid === s.id && !!m.rare === rare && m.stars >= 5), rare)}
    <div class="srcs"><b>หาได้จาก</b>${dexSources(e).map(t => `<span>${t}</span>`).join('')}</div>
    <div class="row" style="align-items:center;gap:10px"><img src="${eggURL(s.id)}" alt="" style="width:44px;height:44px;flex:0 0 auto;object-fit:contain"><span class="note">ไข่ของ${esc(s.name)}</span><button class="alt" type="button" data-dex="" style="margin-left:auto">ปิด</button></div></div></div>`;
  }
  const cards = list.map(({ s, forms }) => {
    const pick = (dexEl !== 'all' && forms.find(x => x.elem === dexEl)) || forms[0], got = forms.filter(dexHas).length, on = e && e.s.id === s.id;
    return `<button type="button" class="mcard dexc ${got ? '' : 'unseen'} ${on ? 'on' : ''} ${s.rarity}" style="${rcVar(s)}" data-dex="${pick.key}"><span class="tag">${s.id}</span><span class="fc ${got === forms.length ? 'all' : ''}">${got}/${forms.length}</span><span class="pic ${pick.rare ? 'rfp' : ''}"><img src="${dexPic(pick)}" alt=""></span><span class="n">${esc(s.name)}</span><span class="lv">${forms.map(x => `<i class="fd ${dexHas(x) ? 'got' : ''}" title="${ELEM_NAME[x.elem]}${x.rare ? ' (ร่างหายาก)' : ''}">${elDot(x.elem)}</i>`).join('')} ${ROLE_NAME[s.role]}</span></button>`;
  }).join('');
  return `<section class="scr dim"><div class="wrap">${topbar('สารบัญมอน', `ค้นพบแล้ว ${nGot} จาก ${all.length} ร่าง · ${fams.length} สายพันธุ์ (ทุกธาตุของตัวเดียวกันอยู่ช่องเดียว)`)}${monTabs()}
  <div class="bar" style="margin:4px 0 10px"><i style="transform:scaleX(${nGot / all.length})"></i></div>
  <div class="dexsum"><div class="row">${elChips}</div><div class="row">${roles}</div><div class="row">${rars}</div></div>
  ${det}
  <div class="mgrid">${cards}</div></div></section>`;
}
/** monster screen (SW style): left = a stage with the monster standing full-body + tabs (info / level / stars / skills),
 *  right = the monster box, always on screen and scrolling on its own — in the level/star/skill tabs tapping a monster in
 *  the box picks it as food, so nothing pops up and nothing needs scrolling. On phones the box sits under the stage. */
function monsHTML() {
  if (monTab === 'dex') return dexHTML();
  const owned = units(); if (!selMon || !monOf(S, selMon)) { selMon = owned[0].uid; monMode = null; food = []; }
  const m = monOf(S, selMon), s = SPECIES[m.sid], fe = formOf(m.sid, !!m.rare).elem, cap = levelCap(m.stars), copies = copiesOf(S, m.sid) - 1, mode = monMode || 'info';
  const tabs = [['info', 'ข้อมูล'], ['feed', '⬆ เลเวล'], ['evo', '★ อัปดาว'], ['skill', '✦ สกิล' + (copies > 0 ? ` (${copies})` : '')]];
  const hint = {
    info: `แตะมอนเพื่อดู · ${owned.length} ตัว`,
    feed: `เลือกอาหาร ${food.length}/${FEED_MAX} · แตะซ้ำเพื่อเอาออก`,
    evo: m.stars >= MAX_STARS ? 'ดาวเต็มแล้ว' : `เลือกมอน ★${m.stars} ${food.length}/${m.stars} ตัว`,
    skill: `เลือก${esc(s.name)}ตัวซ้ำ 1 ตัว`,
  }[mode];
  const usable = u => mode === 'info' ? true : u.uid === m.uid || S.team.includes(u.uid) ? false : mode === 'evo' ? u.stars === m.stars : mode === 'skill' ? u.sid === m.sid : true;
  const cards = owned.map(u => { const pick = food.includes(u.uid), me = u.uid === m.uid;
    return monCard(u.uid, { on: me, pick, dup: !me && !pick && !usable(u), tag: pick ? 'อาหาร' : me && mode !== 'info' ? 'ตัวนี้' : S.team.includes(u.uid) ? 'ทีม' : '' }); }).join('');
  return `<section class="scr dim mscr"><div class="wrap mwrap">${topbar('คลังมอน', owned.length + ' ตัว')}${monTabs()}
  <div class="mlay ${mode !== 'info' ? 'picking' : ''}">
    <div class="mleft">
      <div class="mstage ${m.rare ? 'rf' : ''}">
        <button type="button" class="mshow-btn" data-show="1" aria-label="แตะให้${esc(s.name)}โชว์ท่า"><canvas id="mshow" data-look="${look(m)}" data-elem="${fe}" data-rar="${s.rarity}" data-rare="${m.rare ? 1 : 0}" data-stars="${m.stars}"></canvas></button>
        <div class="ms-name"><h3>${esc(s.name)}</h3><div class="ms-chips"><span class="chip">${elDot(fe)} ${ELEM_NAME[fe]}</span><span class="chip">${ROLE_NAME[s.role]}</span>${rarChip(s)}${parseInt(look(m).split('~')[1] || '0') >= 5 ? '<span class="chip evc">ร่างวิวัฒน์</span>' : ''}${m.rare ? '<span class="chip rfc">✦ ร่างหายาก</span>' : ''}</div>
          <div class="ms-foot"><span class="stars">${starStr(m.stars)}</span><span class="ms-lv">Lv.<b>${m.lvl}</b>/${cap}</span><span class="bar"><i style="transform:scaleX(${m.lvl >= cap ? 1 : m.exp / expToNext(m.lvl)})"></i></span></div></div>
        <span class="ms-tip">แตะเพื่อให้โชว์ท่า</span>
      </div>
      <div class="seg mtabs2">${tabs.map(([k, l]) => `<button type="button" class="${mode === k ? 'on' : ''}" data-mm="${k}" ${k === 'evo' && m.stars >= MAX_STARS ? 'disabled' : ''}>${l}</button>`).join('')}</div>
      <div class="mpane">${mode === 'info' ? infoPane(m) : growHTML(m)}</div>
    </div>
    <div class="mright"><div class="mbox-h">${hint}</div><div class="mgrid mbox">${cards}</div></div>
  </div></div></section>`;
}
/** info tab: stats, skills, leader, rare-form passive, evolved form, egg shards */
function infoPane(m) {
  const s = SPECIES[m.sid], st = stats(m), fr = S.frags[m.sid] || 0;
  return `<div class="stat"><div>HP<b>${st.hp}</b></div><div>ATK<b>${st.atk}</b></div><div>DEF<b>${st.def}</b></div><div>SPD<b>${st.spd}</b></div></div>
  <div class="skl">${formOf(m.sid, !!m.rare).skills.map((k, i) => `<div><b>${i === 2 ? 'สุดยอด' : 'สกิล ' + (i + 1)} · ${esc(k.name)} ${skLv(m, i)}</b>${esc(k.desc)}${k.cd ? `<em>คูลดาวน์ ${k.cd - (m.sk[i] >= SKILL_MAX[i] && k.cd > 2 ? 1 : 0)}</em>` : ''}${m.sk[i] > 1 ? `<em>พลัง +${Math.round((m.sk[i] - 1) * SKILL_STEP * 100)}%</em>` : ''}</div>`).join('')}${s.leader ? `<div><b>ผู้นำ</b>${esc(s.leader.text)}</div>` : ''}${m.rare ? rareRow(s, true, '') : s.rareForm ? `<div class="rpas lock"><b>✦ ร่างหายาก · ธาตุ${ELEM_NAME[s.rareForm.elem]}</b>มอนอีกตัว ชื่อเดิม สกิล 2–3 ของตัวเอง + สกิลร่างหายาก (ดูในสารบัญ)</div>` : ''}${evoRow(s, m.stars >= 5, !!m.rare)}
  <div><b>เศษไข่</b>${fr}/${FRAGS_TO_CRAFT} <div class="bar fr" style="margin-top:6px"><i style="transform:scaleX(${Math.min(1, fr / FRAGS_TO_CRAFT)})"></i></div></div></div>`;
}
/** picked food as slots (tap one to put it back) */
const foodSlots = n => `<div class="fslots">${Array.from({ length: n }, (_, i) => { const f = monOf(S, food[i]); return f ? `<button type="button" class="fslot on" data-unfood="${f.uid}" title="เอาออก"><img src="${portrait(look(f))}" alt=""><span>Lv.${f.lvl}</span></button>` : '<span class="fslot">＋</span>'; }).join('')}</div>`;
/** level / star / skill tabs: food is picked in the monster box next to (or under) this panel */
function growHTML(m) {
  if (monMode === 'feed') {
    const p = feedPreview(S, m.uid, food), cap = levelCap(m.stars), full = m.lvl >= cap;
    return `<div class="grow-p"><h4>เพิ่มเลเวล · ป้อนมอน</h4>
    ${full ? `<p class="note"><b>เลเวลเต็มของ ★${m.stars} แล้ว</b> — ไปที่แท็บ ★ อัปดาว เพื่อเพิ่มดาวและเพดานเลเวล</p>` : `${foodSlots(FEED_MAX)}
    <div class="cmp">Lv.${m.lvl} → <b>Lv.${p.toLvl}</b> / ${cap} · EXP +${p.gain.toLocaleString()} · <span style="${S.gold >= p.gold ? '' : 'color:#ffb3a8'}">ทอง ${p.gold.toLocaleString()}</span>${p.wasted ? ` · <span style="color:#ffb3a8">เกินเพดาน ${p.wasted.toLocaleString()} จะหายไป</span>` : ''}</div>
    <div class="row"><button class="go" type="button" data-feed="go" ${p.ok ? '' : 'disabled'}>${p.ok ? 'ป้อนเลย!' : esc(p.why)}</button><button class="alt" type="button" data-auto="feed">เลือกอัตโนมัติ</button>${food.length ? '<button class="alt" type="button" data-clear="1">ล้าง</button>' : ''}</div>
    <p class="note">แตะมอนในคลัง (สูงสุด ${FEED_MAX} ตัว) · เลเวล/ดาวสูงให้ EXP มาก · อาหารจะหายไป · มอนในทีมใช้เป็นอาหารไม่ได้</p>`}</div>`;
  }
  if (monMode === 'evo') {
    const c = evoCheck(S, m.uid, food), cap = levelCap(m.stars), now = stats(m, m.stars, cap), nx = stats(m, m.stars + 1, levelCap(m.stars + 1));
    return `<div class="grow-p"><h4>อัปดาว ★${m.stars} → ★${m.stars + 1}</h4>
    ${foodSlots(m.stars)}
    <div class="req"><span class="${m.lvl >= cap ? 'ok' : ''}">เลเวลเต็ม ${m.lvl}/${cap}</span><span class="${food.length === c.need ? 'ok' : ''}">มอน ★${m.stars} ${food.length}/${c.need}</span><span class="${S.gold >= c.gold ? 'ok' : ''}">ทอง ${c.gold.toLocaleString()}</span></div>
    <div class="row"><button class="go" type="button" data-evo="go" ${c.ok ? '' : 'disabled'}>${c.ok ? 'วิวัฒน์!' : esc(c.why)}</button><button class="alt" type="button" data-auto="evo">เลือกอัตโนมัติ</button>${food.length ? '<button class="alt" type="button" data-clear="1">ล้าง</button>' : ''}</div>
    <div class="cmp">เลเวลเต็ม: ATK ${now.atk} → <b>${nx.atk}</b> · HP ${now.hp} → <b>${nx.hp}</b> · เพดาน Lv.${levelCap(m.stars + 1)}${m.stars + 1 === 4 ? ' · ร่างเปลี่ยนสี' : ''}${m.stars + 1 === 5 ? ' · <b>ร่างวิวัฒน์!</b>' : ''}</div>
    <p class="note">ใช้มอน ★${m.stars} ตัวไหนก็ได้ ${m.stars} ตัว (อาหารจะหายไป) · หลังอัปดาวกลับเป็น Lv.1 แต่ค่าพลังสูงขึ้นมาก</p></div>`;
  }
  const same = S.mons.filter(x => x.sid === m.sid && x.uid !== m.uid && !S.team.includes(x.uid)), maxed = skillMaxed(m), pick = food[0] && same.some(x => x.uid === food[0]) ? food[0] : same[0]?.uid;
  return `<div class="grow-p"><h4>อัปสกิล</h4>
  <div class="sklv-list">${formOf(m.sid, !!m.rare).skills.map((k, i) => `<span>${i === 2 ? 'สุดยอด' : 'สกิล ' + (i + 1)} ${skLv(m, i)}</span>`).join('')}</div>
  ${maxed ? '<p class="note"><b>สกิลเต็มทุกขั้นแล้ว</b></p>' : `${foodSlots(1)}<div class="row">${pick ? `<button class="go" type="button" data-sku="${pick}">ป้อนตัวซ้ำ (มี ${same.length})</button>` : `<span class="note">ยังไม่มี${esc(SPECIES[m.sid].name)}ตัวซ้ำ — ฟักไข่เพิ่ม</span>`}<button class="alt" type="button" data-sku="soul" ${S.items.soul ? '' : 'disabled'}>ผลึกวิญญาณ (${S.items.soul})</button></div>`}
  <p class="note">ป้อน${esc(SPECIES[m.sid].name)}ตัวซ้ำ 1 ตัว = สกิลขึ้น 1 ขั้นแน่นอน (สุ่มสกิลที่ยังไม่เต็ม) · ผลึกวิญญาณใช้แทนได้ · ขั้นละ +${SKILL_STEP * 100}% · ขั้นสุดท้ายลดคูลดาวน์ 1</p></div>`;
}
/** quick pick for level/star food: never team members, rare forms or the last copy of a species; feeding stops at the level cap */
function autoFood(mode) {
  const m = monOf(S, selMon), left = {}; for (const x of S.mons) left[x.sid] = (left[x.sid] || 0) + 1;
  for (const u of food) { const f = monOf(S, u); if (f) left[f.sid]--; }
  const max = mode === 'evo' ? m.stars : FEED_MAX;
  const cand = S.mons.filter(x => x.uid !== m.uid && !food.includes(x.uid) && !S.team.includes(x.uid) && !x.rare && (mode === 'evo' ? x.stars === m.stars : x.stars <= 2))
    .sort((a, b) => +(a.sid === m.sid) - +(b.sid === m.sid) || a.stars - b.stars || a.lvl - b.lvl || left[b.sid] - left[a.sid]); // same-species copies last: they are skill-up food
  let n = 0;
  for (const x of cand) {
    if (food.length >= max) break;
    if (mode === 'feed' && food.length && feedPreview(S, m.uid, food).toLvl >= levelCap(m.stars)) break;
    if (left[x.sid] <= 1) continue; // keep at least one of every species
    food.push(x.uid); left[x.sid]--; n++;
  }
  if (!n) toast('ไม่มีมอนที่เหมาะเป็นอาหาร (ไม่ใช้มอนในทีม ร่างหายาก และตัวสุดท้ายของแต่ละชนิด)');
}
const fmtLeft = ms => { const t = Math.ceil(ms / 1000), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), x = t % 60, p = n => String(n).padStart(2, '0'); return h ? `${h}:${p(m)}:${p(x)}` : `${m}:${p(x)}`; };
const fmtDur = ms => { const m = Math.round(ms / 60000); return m >= 60 ? `${+(m / 60).toFixed(1)} ชม.` : `${m} นาที`; };
const eggName = e => e.kind === 'mystery' ? 'ไข่ปริศนา' + EGG_TIERS[e.tier].name : 'ไข่' + SPECIES[e.sid].name;
/** what hatching this egg gives, as far as the player is allowed to know */
function eggGain(e) {
  if (e.kind === 'mystery') return '<span class="chip">??? · ตัวปริศนา</span>';
  return `<span class="chip">${copiesOf(S, e.sid) ? 'ตัวซ้ำ · ใช้อัปสกิลได้' : 'ตัวใหม่!'}</span>`;
}
const timer = x => `data-start="${x.start}" data-end="${x.end}"`;
const bookBtn = () => { const n = claimable(S).length + chapterClaimable(S).length; return `<button type="button" class="bookbtn" data-nav="book" title="สมุดผจญภัย">📖<span>สมุดผจญภัย</span>${n ? `<b class="badge">${n}</b>` : ''}</button>`; };
const rewardChips = r => [r.gems ? `<span class="chip rw gem"><i></i>${r.gems}</span>` : '', r.gold ? `<span class="chip rw"><span class="gold sm" style="padding:0;border:0;background:none"><i></i></span>${r.gold.toLocaleString()}</span>` : '', r.soul ? `<span class="chip rw">ผลึกวิญญาณ ×${r.soul}</span>` : '', r.egg ? `<span class="chip rw rwegg" style="--tc:${TIER_COL[r.egg]}"><img src="${eggURLOf({ kind: 'mystery', tier: r.egg })}" alt="">ไข่ปริศนา${EGG_TIERS[r.egg].name}</span>` : '', ...Object.entries(r.frags || {}).map(([sid, n]) => `<span class="chip rw"><img src="${eggURL(sid)}" alt="">เศษไข่${esc(SPECIES[sid].name)} ×${n}</span>`)].join('');
/** adventure book (SW style) drawn as a real book: leather cover with gold corners, two parchment pages (contents + the open
 *  chapter); one page under the other on phones. BATCH15 art (book_*) replaces the code-drawn textures when imported. */
let bookCh = '';
const BK_CORNER = `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M4 60V14Q4 4 14 4h46" fill="none" stroke="currentColor" stroke-width="3"/><path d="M10 60V20q0-10 10-10h40" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".7"/><path d="M14 14q10 2 14 10q-8-2-14 4q-2-8 0-14z" fill="currentColor"/><circle cx="12" cy="12" r="4.5" fill="#c43a2a" stroke="currentColor" stroke-width="1.6"/><path d="M30 8q6 6 14 2M8 30q6 6 2 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
let bookArt = false;
function bookArtVars() { // BATCH15 textures as CSS variables (set once, not inlined into every render)
  if (bookArt) return; bookArt = true; const st = document.documentElement.style;
  for (const k of ['book_cover', 'book_page', 'book_seal', 'book_ribbon', 'book_emblem']) { const src = uiSrc(k); if (src) { st.setProperty('--' + k.replace('_', '-'), `url(${src})`); document.documentElement.classList.add('has-' + k.replace('_', '-')); } }
}
function bookHTML() {
  bookArtVars();
  const claimedQ = QUESTS.filter(q => S.quests.includes(q.id)), gems = claimedQ.reduce((a, q) => a + (q.reward.gems || 0), 0) + CHAPTERS.filter(c => S.quests.includes('ch:' + c.id)).reduce((a, c) => a + (c.bonus.gems || 0), 0);
  const nReady = c => questsIn(c.id).filter(q => !S.quests.includes(q.id) && q.goal(S)[0] >= q.goal(S)[1]).length + (!S.quests.includes('ch:' + c.id) && chapterDone(S, c.id) ? 1 : 0);
  if (!CHAPTERS.some(c => c.id === bookCh)) bookCh = (CHAPTERS.find(c => nReady(c)) || CHAPTERS.find(c => !S.quests.includes('ch:' + c.id)) || CHAPTERS[0]).id;
  const ch = CHAPTERS.find(c => c.id === bookCh)!, chi = CHAPTERS.indexOf(ch), qs = questsIn(ch.id), got = qs.filter(q => S.quests.includes(q.id)).length, chOpen = S.quests.includes('ch:' + ch.id), chReady = !chOpen && got === qs.length;
  const order = q => S.quests.includes(q.id) ? 2 : q.goal(S)[0] >= q.goal(S)[1] ? 0 : 1, list = qs.map((q, i) => [q, i] as const).sort((a, b) => order(a[0]) - order(b[0]) || a[1] - b[1]).map(x => x[0]);
  const all = claimable(S).length + chapterClaimable(S).length, nCh = CHAPTERS.filter(c => S.quests.includes('ch:' + c.id)).length;
  const toc = CHAPTERS.map((c, i) => { const q = questsIn(c.id), g = q.filter(x => S.quests.includes(x.id)).length, n = nReady(c), fin = S.quests.includes('ch:' + c.id);
    return `<li><button type="button" class="bk-toc-i ${c.id === bookCh ? 'on' : ''} ${fin ? 'fin' : ''}" data-bch="${c.id}"><span class="bk-num">${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'][i] || i + 1}</span><span class="bk-name">${esc(c.name)}</span><span class="bk-dots"></span><span class="bk-cnt">${fin ? '✓' : g + '/' + q.length}</span>${n ? `<i class="bk-dot">${n}</i>` : ''}</button></li>`; }).join('');
  const chestImg = uiSrc(chOpen ? 'chest_boss_open' : chReady ? 'chest_boss_closed' : 'chest_wood_closed');
  const quests = list.map(q => { const [a, b] = q.goal(S), done = a >= b, cl = S.quests.includes(q.id);
    return `<li class="bkq ${cl ? 'claimed' : done ? 'done' : ''}"><div class="bkq-main"><b>${esc(q.name)}</b><div class="bkq-line"><span class="bkq-prog"><i style="transform:scaleX(${Math.min(1, a / b)})"></i></span><span class="bkq-n">${a}/${b}</span></div><div class="bkq-rw">${rewardChips(q.reward)}</div></div>${cl ? '<span class="bk-stamp">รับแล้ว</span>' : `<button class="bk-seal" type="button" data-claim="${q.id}" ${done ? '' : 'disabled'}>รับ</button>`}</li>`; }).join('');
  return `<section class="scr bookscr"><div class="wrap bkwrap">${topbar('สมุดผจญภัย', 'ภารกิจครั้งเดียว · ทำครบบทได้หีบรางวัล')}
  <div class="book">${['tl', 'tr', 'bl', 'br'].map(k => `<i class="bk-corner ${k}">${BK_CORNER}</i>`).join('')}<div class="bk-spread">
    <div class="bk-page bk-left">
      <div class="bk-title"><span class="bk-emblem"></span><h2>สมุดผจญภัย</h2><small>บันทึกการเดินทางของผู้พิทักษ์ไข่</small></div>
      <div class="bk-sum"><div><b>${claimedQ.length}</b>/${QUESTS.length}<small>ภารกิจ</small></div><div><b>${nCh}</b>/${CHAPTERS.length}<small>บท</small></div><div><b class="bk-gem"><i></i>${gems}</b>/${bookGems()}<small>เพชร</small></div></div>
      ${all ? `<button class="bk-all" type="button" data-claim="*">รับรางวัลทั้งหมด (${all})</button>` : ''}
      <h3 class="bk-h"><span>สารบัญ</span></h3><ol class="bk-toc">${toc}</ol>
      <p class="bk-note">เพชรใช้ซื้อไข่ปริศนาลายทองและเร่งเวลาบ่มไข่ · ไข่จากสมุดไปรอที่หน้าฟักไข่</p>
      <div class="bk-folio">— ${chi * 2 + 1} —</div>
    </div>
    <div class="bk-page bk-right"><span class="bk-ribbon"></span>
      <div class="bk-chhead"><small>บทที่ ${chi + 1}</small><h2>${esc(ch.name)}</h2><p>${esc(ch.desc)}</p><span class="bkq-prog big"><i style="transform:scaleX(${got / qs.length})"></i></span></div>
      <div class="bk-chest ${chOpen ? 'open' : chReady ? 'ready' : ''}">${chestImg ? `<img src="${chestImg}" alt="">` : '<span class="ico">🧰</span>'}<div class="bk-chest-t"><b>หีบรางวัลประจำบท</b><small>${chOpen ? 'เปิดแล้ว' : chReady ? 'ทำครบทุกภารกิจแล้ว!' : `ทำภารกิจให้ครบ ${got}/${qs.length}`}</small><div class="bkq-rw">${rewardChips(ch.bonus)}</div></div>${chOpen ? '<span class="bk-stamp">เปิดแล้ว</span>' : `<button class="bk-seal gold" type="button" data-claim="ch:${ch.id}" ${chReady ? '' : 'disabled'}>เปิด</button>`}</div>
      <ul class="bk-quests">${quests}</ul>
      <div class="bk-folio">— ${chi * 2 + 2} —</div>
    </div></div></div></div></section>`;
}
function hatchHTML() {
  const h = home(S), slots = incubSlots(S), now = Date.now(), full = h.incub.length >= slots;
  const nest = Array.from({ length: slots }, (_, i) => {
    const x = h.incub[i], e = x && S.eggs.find(q => q.id === x.id); if (!e) return '<div class="islot empty">ช่องบ่มว่าง</div>';
    const left = Math.max(0, x.end - now), done = !left;
    return `<div class="islot ${done ? 'ready' : ''}" style="--tc:${TIER_COL[e.tier]}"><img src="${eggURLOf(e)}" alt=""><div style="min-width:0">${esc(eggName(e))}<div class="bar fr" style="margin-top:5px"><i ${done ? '' : timer(x)} style="transform:scaleX(${done ? 1 : 1 - left / (x.end - x.start)})"></i></div><span class="note" ${done ? '' : timer(x)}>${done ? 'บ่มเสร็จแล้ว!' : 'เหลือ ' + fmtLeft(left)}</span></div>${done ? `<button class="go" type="button" data-egg="${e.id}">ฟัก</button>` : `<button class="alt rush" type="button" data-rush="${e.id}" ${S.gems >= rushCost(S, e.id, now) ? '' : 'disabled'}>เร่ง <span class="gold gem sm"><i></i>${rushCost(S, e.id, now)}</span></button>`}</div>`;
  }).join('');
  const wait = S.eggs.filter(e => !incubOf(S, e.id));
  const card = e => {
    const tc = e.kind === 'mystery' ? `style="--tc:${TIER_COL[e.tier]}"` : '', cls = `egg ${e.kind === 'mystery' ? 'my' : ''}`;
    if (needsIncub(e)) return `<button type="button" class="${cls}" ${tc} data-incub="${e.id}" ${full ? 'disabled' : ''}><img src="${eggURLOf(e)}" alt="">${esc(eggName(e))}${eggGain(e)}<span class="chip">${full ? 'รังบ่มเต็ม' : 'แตะเพื่อบ่ม ' + fmtDur(incubMs(S, e))}</span></button>`;
    return `<button type="button" class="${cls}" ${tc} data-egg="${e.id}"><img src="${eggURLOf(e)}" alt="">${esc(eggName(e))}${eggGain(e)}</button>`;
  };
  const crafts = Object.keys(S.frags).filter(sid => S.frags[sid] > 0), stars = Object.keys(S.starShards || {}).filter(sid => S.starShards[sid] > 0);
  return `<section class="scr dim"><div class="wrap">${topbar('ฟักไข่', 'ไข่ปริศนาจะรู้ว่าเป็นตัวอะไรตอนฟัก · ลายทองขึ้นไปต้องบ่มในรังก่อน')}
  <h2 class="sec">รังบ่มไข่ · ${h.incub.length}/${slots} ช่อง</h2><div class="islots">${nest}</div>${h.incub.length ? `<p class="note rushnote">⚡ เร่งวันนี้ ${rushesToday(S, now)} ครั้ง · ครั้งถัดไป ไข่ทอง <span class="gold gem sm"><i></i>${rushPrice(S, 'gold', now)}</span> ไข่รุ้ง <span class="gold gem sm"><i></i>${rushPrice(S, 'rainbow', now)}</span><small>ยิ่งเร่งหลายครั้งยิ่งแพงขึ้น · กลับมาเริ่มใหม่ทุกเที่ยงคืน · ไข่ที่บ่มไปแล้วจ่ายตามเวลาที่เหลือ</small></p>` : ''}${slots < 3 ? '<p class="note">อัปรังฟักไข่ที่บ้านเต่าเพื่อเพิ่มช่องและบ่มเร็วขึ้น</p>' : ''}
  <div class="shop"><img src="${eggURLOf({ kind: 'mystery', tier: 'gold' })}" alt=""><div style="min-width:0"><b>ไข่ปริศนาลายทอง</b><div class="note">มหากาพย์ ${EGG_TIERS.gold.rarityW.epic}% · ตำนาน ${EGG_TIERS.gold.rarityW.legendary}% · ต้องบ่ม ${fmtDur(incubMs(S, { kind: 'mystery', tier: 'gold' }))}</div></div><button class="go" type="button" data-buy="gold" ${S.gems >= GEM_GOLD_EGG ? '' : 'disabled'}>ซื้อ <span class="gold gem sm"><i></i>${GEM_GOLD_EGG}</span></button></div>
  <h2 class="sec">ไข่ที่รอฟัก</h2>${wait.length ? `<div class="eggs">${wait.map(card).join('')}</div>` : '<div class="empty">ยังไม่มีไข่ ผ่านด่านเพื่อรับไข่ปริศนาหรือสะสมเศษไข่</div>'}
  <h2 class="sec">ประกอบไข่จากเศษ</h2>${crafts.length ? crafts.map(sid => `<div class="craft"><img src="${eggURL(sid)}" alt=""><div style="min-width:0">${esc(SPECIES[sid].name)}<div class="bar fr" style="margin-top:5px"><i style="transform:scaleX(${Math.min(1, S.frags[sid] / FRAGS_TO_CRAFT)})"></i></div><span class="note">${S.frags[sid]}/${FRAGS_TO_CRAFT}</span></div><button class="go" type="button" data-craft="${sid}" ${S.frags[sid] >= FRAGS_TO_CRAFT ? '' : 'disabled'}>ประกอบ</button></div>`).join('') : '<div class="empty">ยังไม่มีเศษไข่</div>'}
  ${stars.length ? `<h2 class="sec">ไข่ตำนานดารา</h2>${stars.map(sid => `<div class="craft star"><img src="${eggURL(sid)}" alt=""><div style="min-width:0">${esc(SPECIES[sid].name)}<div class="bar fr" style="margin-top:5px"><i style="transform:scaleX(${Math.min(1, S.starShards[sid] / STAR_SHARDS_TO_CRAFT)})"></i></div><span class="note">เศษไข่ดารา ${S.starShards[sid]}/${STAR_SHARDS_TO_CRAFT} · ดรอปจากบอสโซน ${STAR_SHARD_CHANCE * 100}% ต่อรอบ</span></div><button class="go" type="button" data-starcraft="${sid}" ${S.starShards[sid] >= STAR_SHARDS_TO_CRAFT ? '' : 'disabled'}>ประกอบ</button></div>`).join('')}` : ''}
  ${oddsHTML()}</div></section>`;
}
function oddsHTML() {
  const o = eggOdds(), left = Math.max(1, EGG_DROP.pity - (S.eggPity || 0)), pct = v => +(v * 100).toFixed(1) + '%';
  const rw = w => Object.entries(w).map(([k, v]) => `${RARITY_NAME[k]} ${v}%`).join(' · ');
  return `<details class="odds"><summary>อัตราไข่ปริศนา และการันตี</summary>
  <p class="note">ชนะด่านมีโอกาสได้ไข่ปริศนา ${pct(EGG_DROP.chance)} (ด่านบอส ${pct(EGG_DROP.bossChance)}) · ผ่านด่านครั้งแรกได้แน่นอน</p>
  <table><thead><tr><th>ลาย</th><th>โอกาส</th><th>บ่ม</th><th>ร่างหายาก</th></tr></thead><tbody>${EGG_TIER_ORDER.map(t => { const T = EGG_TIERS[t]; return `<tr><td><span class="ed" style="background:${TIER_COL[t]}"></span> ${T.name}</td><td>${pct(o[t])}</td><td>${T.incubateMin ? fmtDur(T.incubateMin * 60000) : 'ฟักทันที'}</td><td>${pct(T.rareForm)}</td></tr><tr class="sub"><td colspan="4">ความหายากของมอน: ${rw(T.rarityW)}</td></tr>`; }).join('')}</tbody></table>
  <p class="note"><b>ร่างหายาก</b> (+1 ดาว + สกิลร่างหายาก): โอกาสในตารางคือของมอนระดับธรรมดา · หายาก ×${RARE_FORM_MULT.rare} · มหากาพย์ ×${RARE_FORM_MULT.epic} · ตำนาน ×${RARE_FORM_MULT.legendary} (ตำนานร่างหายากเกิด ★6 หายากที่สุดในเกม)</p>
  <p class="note"><b>การันตี:</b> ไข่ปริศนาฟองที่ ${EGG_DROP.pity} ที่ยังไม่เจอลายทองขึ้นไป จะเป็นลายทองหรือรุ้งแน่นอน · อีก <b>${left}</b> ฟอง<br><b>ไข่ระบุชื่อ (ประกอบจากเศษ):</b> ได้ตัวนั้นแน่นอน และโอกาสเป็นร่างหายากสูงที่สุดในเกม ${(['common', 'rare', 'epic', 'legendary'] as const).map(r => RARITY_NAME[r] + ' ' + pct(NAMED_RARE_FORM * RARE_FORM_MULT[r])).join(' · ')} (ไข่ปริศนาต้องสุ่มได้ตัวนั้นก่อน และสูงสุดแค่ ${pct(EGG_TIERS.rainbow.rareForm)})<br>ฟักได้ดาวตามความหายาก (ธรรมดา ★${NAT_STARS.common} · หายาก ★${NAT_STARS.rare} · มหากาพย์ ★${NAT_STARS.epic} · ตำนาน ★${NAT_STARS.legendary} · ร่างหายาก +1 ดาว) · ได้ตัวซ้ำ = มอนตัวใหม่อีกตัว ใช้ป้อนอัปสกิล หรือเป็นอาหารอัปดาว (สูงสุด ★${MAX_STARS})</p></details>`;
}
function settingsHTML() {
  const st = S.settings;
  const seg = (k, opts) => `<div class="seg">${opts.map(([v, l]) => `<button type="button" data-set="${k}" data-val="${v}" aria-pressed="${String(st[k]) === String(v)}">${l}</button>`).join('')}</div>`;
  return `<section class="scr dim"><div class="wrap">${topbar('ตั้งค่า')}
  <div class="set"><span>เสียง</span>${seg('sound', [[true, 'เปิด'], [false, 'ปิด']])}</div>
  <div class="set"><span>คุณภาพกราฟิก</span>${seg('quality', [['low', 'ต่ำ'], ['mid', 'กลาง'], ['high', 'สูง']])}</div>
  <div class="set"><span>ข้ามฉากสกิลสุดยอด</span>${seg('skipUlt', [[false, 'ไม่ข้าม'], [true, 'ข้าม']])}</div>
  <div class="set"><span>เริ่มเกมใหม่ (ลบความคืบหน้า)</span>${confirmReset ? `<span class="confirm">ลบจริงไหม? <button class="alt" type="button" data-act="resetYes">ลบ</button><button class="alt" type="button" data-act="resetNo">ยกเลิก</button></span>` : `<button class="alt" type="button" data-act="reset">รีเซ็ต</button>`}</div>
  <div class="set"><span>ทดสอบ (prototype): ไข่ปริศนา</span><span class="row" style="flex:0 0 auto"><button class="alt" type="button" data-dev="eggs">รับไข่ 4 ลาย</button><button class="alt" type="button" data-dev="incub">บ่มเสร็จทันที</button></span></div>
  <div class="set"><span>ทดสอบ (prototype): มอนชุดใหม่</span><span class="row" style="flex:0 0 auto"><button class="alt" type="button" data-dev="mons">รับมอนทุกตัว</button><button class="alt" type="button" data-dev="evo">เตรียมอัปดาว</button><button class="alt" type="button" data-dev="gems">+เพชร 500</button><button class="alt" type="button" data-dev="rare">ทำให้เป็นร่างหายาก</button><button class="alt" type="button" data-dev="star5">อัปเป็น ★5 (ดูร่างวิวัฒน์)</button></span></div>
  <div class="set"><span>ทดสอบ (prototype): ฟักมอนระดับ</span><span class="row" style="flex:0 0 auto">${['common', 'rare', 'epic', 'legendary'].map(g => `<button class="alt" type="button" data-dev="hatch:${g}">${LOOT_GRADES[g].name}</button>`).join('')}</span></div>
  <div class="set"><span>ภาพไฟล์แยก (ตรวจการโหลด)<small class="note" style="display:block">${extLine()}</small></span></div>
  <div class="set"><span>ทดสอบ (prototype): พลังงาน AUTO</span><span class="row" style="flex:0 0 auto"><button class="alt" type="button" data-dev="energy">เติมพลังงานเต็ม</button></span></div>
  <div class="set"><span>ทดสอบ (prototype): หีบสมบัติ</span><span class="row" style="flex:0 0 auto">${['common', 'rare', 'epic', 'legendary'].map(g => `<button class="alt" type="button" data-dev="chest:${g}">${LOOT_GRADES[g].name}</button>`).join('')}</span></div>
  <p class="note">P0 เซฟในเครื่องนี้เท่านั้น · ระบบต่อสู้ทำงานแบบ deterministic (seed เดิม + คำสั่งเดิม = ผลเดิม) เพื่อให้เซิร์ฟเวอร์ตรวจผลได้ในเฟสออนไลน์</p></div></section>`;
}

// ---------- home (turtle) ----------
let selB = null;
function homeHTML() {
  const h = home(S);
  return `<div class="hhud"><div class="topbar"><div class="realm"><h1>บ้านเต่าบรรพกาล</h1><p>ป้อมพันธสัญญา Lv.${h.castle} · แตะสิ่งก่อสร้าง มอน หรือหัวเต่า</p></div><div class="row" style="flex:0 0 auto;align-items:center">${bookBtn()}${enPill()}<span class="gold gem"><i></i>${S.gems.toLocaleString()}</span><span class="gold" id="hGold"><i></i>${S.gold.toLocaleString()}</span></div></div><div id="hpanel"></div></div>`;
}
const cost = c => `<span class="gold sm"><i></i>${c.toLocaleString()}</span>`;
function upBtn(id, label = 'อัปเกรด') {
  const c = upgradeCost(S, id), h = home(S), lv = id === 'castle' ? h.castle : h.lv[id] || 0;
  if (c == null) return '<span class="chip">เลเวลสูงสุด</span>';
  if (id !== 'castle' && lv >= maxLevelNow(S, id)) return `<span class="chip">อัปป้อมพันธสัญญาก่อน (Lv.${h.castle + 1})</span>`;
  return `<button class="go" type="button" data-hb="up" ${S.gold < c ? 'disabled' : ''}>${label} ${cost(c)}</button>`;
}
function panelBody(id) {
  const h = home(S), b = BDEF[id];
  if (!unlocked(S, id)) return `<p class="note">ปลดล็อกเมื่อป้อมพันธสัญญา Lv.${b.unlock}</p>`;
  if (b.soon) return `<p class="note">${b.desc}</p><span class="chip">${b.soon}</span>`;
  if (id === 'castle') { const nx = BUILDINGS.filter(x => x.unlock === h.castle + 1).map(x => x.name); return `<p class="note">${b.desc}</p>${h.castle < 4 ? `<div class="kv"><span>ขนาดเต่า</span><b>${Math.round(TURTLE_SCALE[h.castle] * 100)}% → ${Math.round(TURTLE_SCALE[h.castle + 1] * 100)}%</b></div><div class="kv"><span>เพดานเลเวลอาคาร</span><b>${h.castle + 1} → ${h.castle + 2}</b></div>${nx.length ? `<div class="kv"><span>ปลดล็อก</span><b>${nx.join(', ')}</b></div>` : ''}` : ''}<div class="row">${upBtn('castle')}</div>`; }
  if (id === 'gate') return `<p class="note">${b.desc}</p><div class="row"><button class="go" type="button" data-nav="map">เลือกด่าน</button></div>`;
  if (id === 'hatchery') { const lv = h.lv.hatchery, sp = l => Math.round(100 / HATCH_SPEED[l]) + '%', now = Date.now();
    const rows = h.incub.map(x => { const e = S.eggs.find(q => q.id === x.id); if (!e) return ''; const left = Math.max(0, x.end - now); return `<div class="kv"><span>${esc(eggName(e))}</span><b ${left ? timer(x) : ''}>${left ? 'เหลือ ' + fmtLeft(left) : 'บ่มเสร็จแล้ว!'}</b></div>`; }).join('');
    return `<p class="note">${b.desc}</p><div class="kv"><span>ช่องบ่มไข่</span><b>${h.incub.length}/${lv} ช่อง${lv < 3 ? ` → ${lv + 1}` : ''}</b></div><div class="kv"><span>ความเร็วบ่ม</span><b>${sp(lv)}${lv < 3 ? ` → ${sp(lv + 1)}` : ''}</b></div>${rows}<div class="kv"><span>ไข่ที่รอฟัก</span><b>${S.eggs.length} ฟอง</b></div><div class="row"><button class="go" type="button" data-nav="hatch">ไปฟักไข่</button>${upBtn('hatchery')}</div>`; }
  if (id === 'mine') { const lv = h.lv.mine, st = mineStored(S), cap = mineCap(S); return `<p class="note">${b.desc}</p><div class="kv"><span>ผลิต</span><b>${MINE_RATE[lv] * 60} ทอง/ชม.${lv < 5 ? ` → ${MINE_RATE[lv + 1] * 60}` : ''}</b></div><div class="kv"><span>คลัง</span><b id="mineSt">${st.toLocaleString()} / ${cap.toLocaleString()}</b></div><div class="bar" style="margin:2px 0 4px"><i id="mineBar" style="transform:scaleX(${st / cap})"></i></div><div class="row"><button class="go" type="button" data-hb="collect" ${st < 1 ? 'disabled' : ''}>เก็บทอง</button>${upBtn('mine')}</div>`; }
  if (id === 'shrine') { const mx = shrineMax(S); return `<p class="note">${b.desc} · เลเวลสูงสุดตอนนี้ ${mx}</p><div class="shr">${ELEMS.map(e => { const l = h.shrine[e] || 0, c = shrineCost(S, e); return `<div><span class="ed" style="background:${PAL[e].aura}"></span><span><b>ศาล${ELEM_NAME[e]}</b> Lv.${l}<br><small>ATK +${Math.round(l * SHRINE_ATK * 100)}% · ปฏิกิริยา +${Math.round(l * SHRINE_REACT * 100)}%</small></span>${c == null ? '<span class="chip">สูงสุด</span>' : l >= mx ? '<span class="chip">ล็อก</span>' : `<button class="go" type="button" data-shr="${e}" ${S.gold < c ? 'disabled' : ''}>${cost(c)}</button>`}</div>`; }).join('')}</div><p class="note">อารีน่า (PvP) ใช้พลังจากศาลแค่ครึ่งเดียว</p>`; }
  if (id === 'altar') return `<p class="note">${b.desc}</p><div class="shr">${RELICS.map(r => { const own = h.relics.includes(r.id), on = h.relic === r.id; return `<div class="${on ? 'on' : ''}"><span class="rl">${IMG['relic_' + r.id] ? `<img src="${IMG['relic_' + r.id].src}" alt="">` : { sun: '☀', feather: '🪶', shell: '⬢', gourd: '⚱' }[r.id]}</span><span><b>${r.name}</b><br><small>${r.desc}</small></span>${on ? '<span class="chip">พกอยู่</span>' : own ? `<button class="alt" type="button" data-rel="${r.id}">พกชิ้นนี้</button>` : h.castle < r.unlock ? `<span class="chip">ป้อม Lv.${r.unlock}</span>` : `<button class="go" type="button" data-relbuy="${r.id}" ${S.gold < r.cost ? 'disabled' : ''}>สร้าง ${cost(r.cost)}</button>`}</div>`; }).join('')}</div>`;
  return '';
}
function renderPanel() {
  const p = $('#hpanel'); if (!p) return; const g = $('#hGold'); if (g) g.innerHTML = `<i></i>${S.gold.toLocaleString()}`;
  if (!selB) { p.innerHTML = ''; p.classList.remove('open'); return; }
  const b = BDEF[selB], h = home(S), lv = selB === 'castle' ? h.castle : h.lv[selB] || 0;
  p.innerHTML = `<div class="card hp"><div class="hph"><h3>${b.name}${b.max > 1 && unlocked(S, selB) ? ` <small>Lv.${lv}/${b.max}</small>` : ''}</h3><button class="x" type="button" data-hb="close" aria-label="ปิด">✕</button></div>${panelBody(selB)}</div>`;
  p.classList.add('open');
}
function homeAct(d) {
  const h = home(S);
  if (d.hb === 'close') { selB = null; homeV.sel = null; renderPanel(); return; }
  if (d.hb === 'up') { const was = h.castle, old = TURTLE_SCALE[was]; if (upgrade(S, selB)) { save(); if (selB === 'castle') { homeV.grow(old, TURTLE_SCALE[h.castle]); setTimeout(() => homeV.celebrate('castle', 'ป้อม Lv.' + h.castle + '!'), 2000); } else homeV.celebrate(selB, 'Lv.' + h.lv[selB] + '!'); renderPanel(); } return; }
  if (d.hb === 'collect') { const g = collectMine(S); if (g > 0) { save(); homeV.collectFx(g); } renderPanel(); return; }
  if (d.shr) { if (shrineUp(S, d.shr)) { save(); homeV.celebrate('shrine', 'ศาล' + ELEM_NAME[d.shr] + ' Lv.' + h.shrine[d.shr]); renderPanel(); } return; }
  if (d.relbuy) { if (buyRelic(S, d.relbuy)) { save(); homeV.celebrate('altar', 'ได้วัตถุศักดิ์สิทธิ์!'); renderPanel(); } return; }
  if (d.rel) { equipRelic(S, d.rel); save(); sfx.buff(); renderPanel(); }
}

// ---------- battle ----------
let lastStage = null, curStageId = null, actT = 0, bannerT = 0;
function banner(t, s = '', d = 1.8) { $('#bT').textContent = t; $('#bS').textContent = s; $('#banner').classList.add('show'); bannerT = d; }
let artWait = false;
function startBattle(stageId, artTried = false) {
  if (S.team.length !== 4) { teamCtx = stageId; show('team'); return; }
  const st = stageOf(stageId);
  // Starborn art ships as separate files: load it (once) before the fight so nobody appears as a placeholder
  const sids = [...st.waves.flat().map(m => m.sid), ...S.team.map(uid => monOf(S, uid)?.sid).filter(Boolean)];
  if (!artTried && !artReady(sids)) { if (!artWait) { artWait = true; toast('กำลังโหลดภาพมอนตำนานดารา…'); ensureArt(sids).then(() => { artWait = false; startBattle(stageId, true); }); } return; }
  curStageId = stageId; setLocation(st?.loc); // each stage fights in its own arena
  const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
  const team = S.team.map(uid => { const m = monOf(S, uid); return { sid: m.sid, lvl: m.lvl, stars: m.stars, sk: m.sk, rare: !!m.rare }; });
  const b = new Battle(seed, team, st, homeMods(S));
  clearAll();
  // AUTO costs energy (manual play is free): pay up front when the player's preference is AUTO
  const autoPaid = S.settings.auto && payAuto(S, st); if (S.settings.auto && !autoPaid) toast(`พลังงานไม่พอเปิด AUTO (ต้องใช้ ⚡${autoCost(st)}) · เล่นเองได้ไม่จำกัด · แตะ AUTO เพื่อเติมด้วยเพชร`); save();
  battle = new BattleView(b, st, {
    auto: autoPaid, autoPaid, speed: S.settings.speed, skipUlt: S.settings.skipUlt,
    onHud: hudBattle, onAct: (s, team) => { const e = $('#actName'); e.textContent = s; e.classList.toggle('e', team === 1); e.classList.add('show'); actT = 1.6; },
    onCutin: (sid, name, col) => { const ci = $('#cutin'); ci.style.setProperty('--c', col); $('#cutImg').src = portrait(sid); $('#cutText').textContent = name; ci.classList.remove('go'); void ci.offsetWidth; ci.classList.add('go'); },
    onWave: (w, n, boss) => { $('#waveLbl').textContent = `${stageLabel(st.id)} · WAVE ${w + 1}/${n}`; banner(boss ? 'BOSS' : 'WAVE ' + (w + 1), boss ? (b.units.find(u => u.team === 1 && u.boss && u.alive)?.name || st.name) : `${st.name} ${st.n}`, 1.5); },
    onEnd: (win, stars) => endBattle(win, stars, seed, b),
    onUlt: () => { S.stats.ult++; }, onPerfect: () => { S.stats.perfect++; },
  });
  scene = battle; battle.start();
  $('#screens').innerHTML = ''; document.querySelector('.zpanel')?.remove(); $('#nav').hidden = true; $('#bhud').hidden = false; confirmExit = false; renderBattleButtons(); hudBattle(battle);
}
let confirmExit = false;
function renderBattleButtons() {
  const bv = battle; if (!bv) return;
  $('#btBtns').innerHTML = `<button class="tbtn ${bv.auto ? 'on' : ''}" type="button" data-b="auto">AUTO${bv.autoPaid ? '' : ` <small>⚡${autoCost(bv.stage)}</small>`}</button><button class="tbtn ${bv.speed > 1 ? 'on' : ''}" type="button" data-b="speed">x${bv.speed}</button>` +
    (confirmExit ? `<span class="confirm">ออกจากด่าน? <button class="alt" type="button" data-b="exitYes">ออก</button><button class="alt" type="button" data-b="exitNo">ต่อ</button></span>` : `<button class="tbtn" type="button" data-b="exit">ออก</button>`);
}
let orderT = 0;
function hudBattle(bv) {
  const b = bv.b; orderT = 0;
  const choose = bv.phase === 'choose' && bv.active && b.get(bv.active).team === 0;
  $('#skills').hidden = !choose;
  if (choose) {
    const u = b.get(bv.active);
    $('#whoImg').src = portrait(u.sid); $('#whoName').textContent = u.name;
    for (let i = 0; i < 3; i++) { const btn = $('#sk' + i), k = u.skills[i]; btn.innerHTML = `<b>${i === 2 ? 'สุดยอด' : 'สกิล ' + (i + 1)}</b>${esc(k.name)}<small>${esc(k.desc)}</small>` + (u.cds[i] > 0 ? `<span class="cdn">${u.cds[i]}</span>` : i > 0 && !b.canUse(u, i) ? '<span class="cdn">ผนึก</span>' : ''); btn.disabled = !b.canUse(u, i); btn.setAttribute('aria-pressed', String(bv.sel === i)); }
    const k = u.skills[bv.sel]; $('#hint').textContent = k.target === 'allyAll' ? 'แตะพวกเดียวกัน หรือกดสกิลซ้ำเพื่อใช้' : k.target === 'enemyAll' ? 'แตะศัตรูตัวไหนก็ได้ หรือกดสกิลซ้ำ' : 'แตะศัตรูที่จะโจมตี';
  }
}
function renderOrder() {
  const bv = battle; if (!bv) return; if (bv.phase === 'intro') { $('#order').innerHTML = ''; return; } const b = bv.b; const ord = b.order(); if (bv.active && b.get(bv.active)?.alive) { const i = ord.indexOf(bv.active); if (i > 0) { ord.splice(i, 1); ord.unshift(bv.active); } }
  $('#order').innerHTML = ord.slice(0, 8).map((uid, i) => { const u = b.get(uid); return `<div class="o ${u.team ? 'e' : ''} ${i === 0 ? 'first' : ''}"><img src="${portrait(u.sid)}" alt=""></div>`; }).join('');
}
function endBattle(win, stars, seed, b) {
  const seen = []; for (const w of stageOf(curStageId).waves) for (const m of w) seen.push(m.sid);
  S.stats.react += b.myReactions; S.stats.reactKinds = [...new Set([...S.stats.reactKinds, ...b.reactKinds])];
  const r = grantRewards(S, curStageId, win, stars, seen, seed); save();
  $('#skills').hidden = true;
  if (!win) { resultModal(r, win, stars); return; }
  // win: treasure chest first (light colour = best drop), then the result card
  const st = stageOf(curStageId), boss = st.waves.some(w => w.some(m => SPECIES[m.sid]?.boss));
  const { items, grade } = lootOf(r);
  const view = items.map(it => it.kind === 'gold' ? { icon: coinURL(it.qty >= 1000), label: `ทอง ${it.qty.toLocaleString()}`, sub: it.first ? 'โบนัสผ่านครั้งแรก' : '', grade: it.grade }
    : it.kind === 'frag' ? { icon: eggURL(it.sid), label: `เศษไข่ ×${it.qty}`, sub: SPECIES[it.sid].name, grade: it.grade }
    : it.kind === 'star' ? { icon: eggURL(it.sid), label: 'เศษไข่ดารา!', sub: `${SPECIES[it.sid].name} ${S.starShards[it.sid] || 0}/${STAR_SHARDS_TO_CRAFT}`, grade: it.grade }
    : { icon: eggURLOf(it.egg), label: eggName(it.egg), sub: it.egg.kind === 'mystery' ? 'ไข่ปริศนา!' : '', grade: it.grade });
  chestUI = showChest({ items: view, grade, boss, stars, onDone: () => { chestUI = null; resultModal(r, win, stars); } });
}
let chestUI = null, coinU = null;
function coinURL(big = false) {
  const art = uiSrc(big ? 'ui_coin_pile' : 'ui_coin') || uiSrc('ui_coin'); if (art) return art;
  if (coinU) return coinU;
  const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d'), g = x.createRadialGradient(38, 36, 4, 48, 48, 40);
  g.addColorStop(0, '#fff3c4'); g.addColorStop(.45, '#f2c14e'); g.addColorStop(1, '#a87a1e'); x.fillStyle = g; x.beginPath(); x.arc(48, 48, 38, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#8a5a10'; x.lineWidth = 4; x.stroke(); x.fillStyle = '#fff6c8'; x.fillRect(44, 26, 8, 44);
  return (coinU = c.toDataURL());
}
function resultModal(r, win, stars) {
  const next = nextStageKey(curStageId);
  const modal = document.createElement('div'); modal.className = 'modal'; modal.id = 'resModal';
  modal.innerHTML = `<div class="card"><h2 class="${win ? '' : 'lose'}">${win ? 'ชนะ!' : 'แพ้'}</h2>${win ? `<div class="bigstars">${[0, 1, 2].map(i => `<span class="${i < stars ? '' : 'off'}" style="animation-delay:${.2 + i * .25}s">${starHTML(i < stars)}</span>`).join('')}</div>` : '<p class="note" style="text-align:center">ลองเลเวลอัปที่ด่านก่อนหน้า หรือจัดทีมให้มีธาตุที่ได้เปรียบ</p>'}
  ${r.gold ? `<div class="drop" style="align-self:center"><span class="gold" style="padding:0;border:0;background:none"><i></i></span>ทอง +${r.gold.toLocaleString()}${r.firstClear ? ' (โบนัสผ่านครั้งแรก)' : ''}</div>` : ''}
  <div class="gains">${r.gains.map(g => `<div class="gain"><span class="pic"><img src="${portrait(monOf(S, g.uid) ? look(monOf(S, g.uid)) : g.sid)}" alt=""></span><span>${esc(SPECIES[g.sid].name)}<br><span class="note">EXP +${g.exp}</span></span><span>${g.toLvl > g.fromLvl ? `<span class="up">LEVEL UP</span><br>Lv.${g.fromLvl} → ${g.toLvl}` : `Lv.${g.toLvl}`}${g.capped ? '<br><span class="note">ถึงเลเวลสูงสุดของดาว</span>' : ''}</span></div>`).join('')}</div>
  ${r.star ? `<div class="drops"><span class="drop star"><img src="${eggURL(r.star)}" alt="">เศษไข่ดารา ${esc(SPECIES[r.star].name)} ${S.starShards[r.star] || 0}/${STAR_SHARDS_TO_CRAFT}</span></div>` : ''}
  ${Object.keys(r.frags).length || r.eggs.length ? `<div class="drops">${Object.entries(r.frags).map(([sid, n]) => `<span class="drop"><img src="${eggURL(sid)}" alt="">เศษไข่${esc(SPECIES[sid].name)} ×${n}</span>`).join('')}${r.eggs.map(e => `<span class="drop" style="border-color:${TIER_COL[e.tier]}"><img src="${eggURLOf(e)}" alt="">${esc(eggName(e))}!</span>`).join('')}</div>` : ''}
  <div class="row"><button class="go" type="button" data-r="again">เล่นอีกครั้ง</button>${win && next ? `<button class="go" type="button" data-r="next">ด่านถัดไป</button>` : ''}</div>
  <div class="row">${S.eggs.length ? `<button class="alt" type="button" data-r="hatch">ฟักไข่ (${S.eggs.length})</button>` : ''}<button class="alt" type="button" data-r="map">แผนที่</button></div></div>`;
  document.body.appendChild(modal);
  if (win && stars) sfx.coin();
}
function leaveBattle() { clearLocation(); chestUI?.close(); chestUI = null; battle = null; clearAll(); scene = cur === 'home' && homeV ? homeV : idleScene; $('#resModal')?.remove(); $('#bhud').hidden = true; }

// ---------- hatch ----------
function startHatch(eggId, forceRarity = null, artTried = false) {
  const egg = S.eggs.find(e => e.id === eggId); if (!egg || !canHatch(S, egg)) return;
  if (!artTried && !artReady([egg.sid])) { toast('กำลังโหลดภาพ…'); ensureArt([egg.sid]).then(() => startHatch(eggId, forceRarity, true)); return; }
  clearAll(); $('#newBadge')?.remove();
  const toStars = forceRarity ? NAT_STARS[forceRarity] : natStars(egg.sid, !!egg.rare); // every hatch is a new unit at its natural stars
  hatch = new HatchView(egg.rare ? lookOf(egg.sid, 0, true) : egg.sid, { fromStars: 0, toStars, eggSrc: eggOf(egg), tier: egg.kind === 'mystery' ? egg.tier : null, rare: !!egg.rare, rarityOverride: forceRarity });
  const isNew = !S.dex.includes(egg.sid) || (!!egg.rare && !S.dexRare.includes(egg.sid)); // first time this species / rare form → big NEW badge
  hatch.onReveal = () => { if (isNew && hatch) newBadge(); };
  hatch.onDone = () => {
    const r = hatchEgg(S, eggId); save(); if (!r) return;
    const s = SPECIES[r.sid], more = S.eggs.filter(e => canHatch(S, e)).length;
    const title = 'ฟักสำเร็จ!';
    const note = (r.newDex ? '<b style="color:var(--gold)">✦ บันทึกลงสารบัญมอนครั้งแรก!</b><br>' : '') + `${ELEM_NAME[formOf(r.sid, !!r.rare).elem]} · ${ROLE_NAME[s.role]} · เข้าคลังมอนแล้ว` + (r.copies ? `<br>ตัวซ้ำ (มีอยู่แล้ว ${r.copies} ตัว) · ใช้ป้อนอัปสกิล หรือเป็นอาหารอัปดาว` : '');
    const modal = document.createElement('div'); modal.className = 'modal'; modal.id = 'hatchModal'; modal.style.background = 'rgba(6,8,6,.25)'; modal.style.alignItems = 'end';
    modal.innerHTML = `<div class="card" style="margin-bottom:calc(env(safe-area-inset-bottom,0px) + 12px)"><h2>${title}</h2><p style="text-align:center;margin:0;font-family:var(--f-display);font-size:1.3rem">${esc(s.name)}</p><p style="text-align:center;margin:4px 0 0">${rarChip(s)}</p>${r.rare ? `<p class="rfnote">✦ ร่างหายาก! ธาตุ${ELEM_NAME[formOf(r.sid, true).elem]} · สกิลชุดใหม่ของตัวเอง</p>` : ''}<div class="bigstars">${Array.from({ length: MAX_STARS }, (_, i) => `<span class="${i < r.stars ? '' : 'off'}" style="animation-delay:${.1 + i * .12}s">${starHTML(i < r.stars)}</span>`).join('')}</div><p class="note" style="text-align:center">${note}</p><div class="row"><button class="go" type="button" data-h="more">${more ? `ฟักต่อ (${more})` : 'กลับหน้าฟักไข่'}</button><button class="alt" type="button" data-h="map">แผนที่</button></div></div>`;
    document.body.appendChild(modal);
  };
  scene = hatch; hatch.start(); $('#screens').innerHTML = ''; $('#nav').hidden = true;
}
function leaveHatch() { hatch = null; clearAll(); scene = idleScene; $('#hatchModal')?.remove(); $('#newBadge')?.remove(); }
/** rainbow "NEW!" stamp at the top of the screen when a hatch reveals a species never obtained before */
function newBadge() {
  $('#newBadge')?.remove(); const el = document.createElement('div'); el.id = 'newBadge';
  el.innerHTML = '<span class="nb-rays"></span><b class="nb-word">NEW!</b><span class="nb-sub">มอนตัวใหม่ · บันทึกลงสารบัญแล้ว</span>';
  document.body.appendChild(el); sfx.perfect();
}

// ---------- growth: pick food in the collection grid, evolution scene ----------
function pickMon(uid) {
  sfx.click(); const m = monOf(S, selMon), f = monOf(S, uid);
  if (!monMode) { selMon = uid; food = []; render(); return; } // info tab: view this monster
  if (uid === selMon || !f) return;
  const i = food.indexOf(uid); if (i >= 0) { food.splice(i, 1); render(); return; }
  if (S.team.includes(uid)) { toast('มอนตัวนี้อยู่ในทีม — เอาออกจากทีมก่อนจึงใช้เป็นอาหารได้'); return; }
  if (monMode === 'evo') { if (f.stars !== m.stars) { toast(`อัปดาวต้องใช้มอน ★${m.stars}`); return; } if (food.length < m.stars) food.push(uid); }
  else if (monMode === 'skill') { if (f.sid !== m.sid) { toast(`อัปสกิลต้องใช้${SPECIES[m.sid].name}ตัวซ้ำ`); return; } food = [uid]; }
  else if (food.length < FEED_MAX) food.push(uid);
  render();
}
let evo = null;
function startEvolve(uid, foodUids) {
  const m = monOf(S, uid); if (!evoCheck(S, uid, foodUids).ok) return;
  const from = m.stars, before = stats(m), foods = foodUids.map(u => look(monOf(S, u)));
  clearAll(); sfx.click();
  evo = new EvolveView(lookOf(m.sid, from, !!m.rare), lookOf(m.sid, from + 1, !!m.rare), foods, { fromStars: from, toStars: from + 1 });
  evo.onDone = () => {
    const r = evolve(S, uid, foodUids); save(); food = []; monMode = null; if (!r) return;
    const s = SPECIES[r.sid], after = stats(r, r.stars, levelCap(r.stars));
    const modal = document.createElement('div'); modal.className = 'modal'; modal.id = 'hatchModal'; modal.style.background = 'rgba(6,8,6,.25)'; modal.style.alignItems = 'end';
    modal.innerHTML = `<div class="card" style="margin-bottom:calc(env(safe-area-inset-bottom,0px) + 12px)"><h2>วิวัฒน์สำเร็จ!</h2><p style="text-align:center;margin:0;font-family:var(--f-display);font-size:1.3rem">${esc(s.name)}</p><div class="bigstars">${Array.from({ length: MAX_STARS }, (_, i) => `<span class="${i < r.stars ? '' : 'off'}" style="animation-delay:${.1 + i * .12}s">${starHTML(i < r.stars)}</span>`).join('')}</div><p class="note" style="text-align:center">★${from} → ★${r.stars} · เลเวลสูงสุด ${levelCap(r.stars)}<br>ATK สูงสุด ${stats(r, from, levelCap(from)).atk} → <b>${after.atk}</b> · HP สูงสุด ${stats(r, from, levelCap(from)).hp} → <b>${after.hp}</b></p><div class="row"><button class="go" type="button" data-h="mons">กลับคลังมอน</button></div></div>`;
    document.body.appendChild(modal);
  };
  scene = evo; hatch = evo; evo.start(); $('#screens').innerHTML = ''; $('#nav').hidden = true;
}

// prototype-only test tools (remove before the public playtest)
function devTool(k) {
  if (k === 'energy') { S.energy = { v: ENERGY_MAX, t: Date.now() }; save(); render(); return; }
  if (k === 'eggs') { for (const t of EGG_TIER_ORDER) { let e; do { e = rollMysteryEgg({ ...S, eggPity: 0 }, Math.random); } while (e.tier !== t); e.id = S.nextEggId++; S.eggs.push(e); } }
  if (k === 'mons') { for (const sid of Object.keys(SPECIES)) if (!SPECIES[sid].boss && !copiesOf(S, sid)) { S.mons.push(newMon(S.nextUid++, sid, 5)); if (!S.dex.includes(sid)) S.dex.push(sid); } save(); sfx.chime(); show('mons'); return; }
  if (k === 'evo') { // prepare the selected monster (or the first) for an evolution + a skill-up
    const m = monOf(S, selMon) || units()[0]; m.lvl = levelCap(m.stars); S.gold += 50000; S.items.soul += 2;
    const pool = Object.values(SPECIES).filter(x => !x.boss);
    for (let i = 0; i < m.stars; i++) S.mons.push(newMon(S.nextUid++, pool[Math.floor(Math.random() * pool.length)].id, 1, m.stars));
    S.mons.push(newMon(S.nextUid++, m.sid, 1)); selMon = m.uid; monMode = 'evo'; food = []; save(); sfx.chime(); show('mons'); return; }
  if (k === 'star5') { const m = monOf(S, selMon) || units()[0]; m.stars = Math.max(5, m.stars); m.lvl = Math.min(m.lvl, levelCap(m.stars)); selMon = m.uid; save(); sfx.starup(); show('mons'); return; }
  if (k === 'rare') { // turn the selected monster (or the first) into its rare form
    const m = monOf(S, selMon) || units()[0]; m.rare = true; if (!S.dexRare.includes(m.sid)) S.dexRare.push(m.sid); selMon = m.uid; save(); sfx.chime(); show('mons'); return; }
  if (k === 'gems') { S.gems += 500; save(); sfx.coin(); render(); return; }
  if (k === 'incub') for (const x of home(S).incub) x.end = Date.now();
  if (k.startsWith('hatch:')) { // preview the hatch effect of a monster rarity (hatches a gold egg of an owned monster)
    const g = k.slice(6), pool = Object.values(SPECIES).filter(x => !x.boss && x.rarity === g), sid = pool.length ? pool[Math.floor(Math.random() * pool.length)].id : 'A03';
    const e = { id: S.nextEggId++, sid, kind: 'mystery', tier: { common: 'silver', rare: 'silver', epic: 'gold', legendary: 'rainbow' }[g] };
    S.eggs.push(e); home(S).incub.push({ id: e.id, tier: e.tier, start: 0, end: 1 }); save(); startHatch(e.id, g); return;
  }
  if (k.startsWith('chest:')) { // preview a chest of that grade (no rewards granted)
    const g = k.slice(6), tier = { rare: 'silver', epic: 'gold', legendary: 'rainbow' }[g];
    const items = [{ icon: coinURL(), label: 'ทอง 640', sub: 'โบนัสผ่านครั้งแรก', grade: 'common' }, ...['A02', 'A06', 'A03'].map(sid => ({ icon: eggURL(sid), label: 'เศษไข่ ×1', sub: SPECIES[sid].name, grade: 'common' }))];
    if (tier) items.push({ icon: eggURLOf({ kind: 'mystery', tier }), label: 'ไข่ปริศนา' + EGG_TIERS[tier].name, sub: 'ไข่ปริศนา!', grade: g });
    chestUI = showChest({ items, grade: g, boss: g === 'legendary', stars: 3, onDone: () => { chestUI = null; } }); return;
  }
  save(); sfx.chime(); show('hatch');
}
/** live incubation timers: any element with data-start/data-end; re-render when one finishes */
function tickIncub() {
  const now = Date.now(); let fin = false;
  document.querySelectorAll('[data-end]').forEach(el => { const st = +el.dataset.start, end = +el.dataset.end, left = Math.max(0, end - now); if (el.tagName === 'I') el.style.transform = `scaleX(${1 - left / (end - st)})`; else el.textContent = left ? 'เหลือ ' + fmtLeft(left) : 'บ่มเสร็จแล้ว!'; if (!left) fin = true; });
  if (fin) { if (cur === 'hatch' && !hatch && !battle) render(); else if (cur === 'home') { renderPanel(); renderNav(); } }
}

// ---------- input ----------
document.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) { if (e.target.classList?.contains('zpanel')) { mapZone = null; render(); } if (e.target.id === 'enModal') e.target.remove(); return; } audioInit();
  const d = t.dataset;
  if ((d.hb || d.shr || d.rel || d.relbuy) && homeV) { homeAct(d); return; }
  if (d.en) { enAct(d.en); return; }
  if (d.nav) { sfx.click(); if (battle) leaveBattle(); if (hatch) leaveHatch(); confirmReset = false; show(d.nav); }
  else if (d.stage) { sfx.click(); teamCtx = d.stage; show('team'); }
  else if (d.act === 'fight') { sfx.click(); const id = teamCtx; teamCtx = null; startBattle(id); }
  else if (d.mon && cur === 'team') { const uid = +d.mon, i = S.team.indexOf(uid), m = monOf(S, uid);
    if (i >= 0) S.team.splice(i, 1);
    else if (teamHasSpecies(S, m.sid)) { toast(`มี${SPECIES[m.sid].name}ในทีมแล้ว — มอนชนิดเดียวกันลงทีมได้ 1 ตัว`); return; }
    else if (S.team.length < 4) S.team.push(uid);
    save(); sfx.click(); render(); }
  else if (d.slot && cur === 'team') { const i = +d.slot; if (i > 0) { const uid = S.team.splice(i, 1)[0]; S.team.unshift(uid); } else S.team.splice(0, 1); save(); sfx.click(); render(); }
  else if (d.mon && cur === 'mons') { pickMon(+d.mon); }
  else if (d.realm) { sfx.click(); mapRealm = d.realm; render(); }
  else if (d.zone) { sfx.click(); mapZone = d.zone; render(); }
  else if (d.zdiff !== undefined) { sfx.click(); mapDiff = +d.zdiff; const y = $('.zsheet')?.scrollTop || 0; render(); const zs = $('.zsheet'); if (zs) zs.scrollTop = y; }
  else if (d.zclose) { mapZone = null; render(); }
  else if (d.mt) { sfx.click(); monTab = d.mt; dexSel = null; render(); }
  else if (d.dexel) { sfx.click(); dexEl = d.dexel; render(); }
  else if (d.dex !== undefined && cur === 'mons') { sfx.click(); dexSel = d.dex || null; render(); if (dexSel) document.querySelector('.dexd')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  else if (d.mm) { sfx.click(); monMode = d.mm === 'close' || d.mm === 'info' ? null : d.mm; food = []; skFlash = -1; render(); }
  else if (d.show) { showcaseTap(); sfx.chime(); }
  else if (d.unfood) { sfx.click(); food = food.filter(u => u !== +d.unfood); render(); }
  else if (d.auto) { sfx.click(); autoFood(d.auto); render(); }
  else if (d.clear) { sfx.click(); food = []; render(); }
  else if (d.evo === 'go') { startEvolve(selMon, [...food]); }
  else if (d.feed === 'go') { const m = monOf(S, selMon), from = m.lvl, r = feed(S, selMon, [...food]); if (r) { save(); food = []; sfx.starup(); toast(r.toLvl > from ? `เลเวลอัป! Lv.${from} → Lv.${r.toLvl}` : `EXP +${r.gain.toLocaleString()}`); render(); } }
  else if (d.sku) { const slot = skillUp(S, selMon, d.sku === 'soul' ? null : +d.sku); if (slot >= 0) { save(); sfx.starup(); skFlash = slot; food = []; render(); setTimeout(() => { skFlash = -1; }, 50); } }
  else if (d.egg) { sfx.click(); startHatch(+d.egg); }
  else if (d.bch) { sfx.click(); bookCh = d.bch; render(); if (innerWidth <= 820) document.querySelector('.bk-right')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); } // phones: turn to the chapter page
  else if (d.claim) { const tot = { gems: 0, gold: 0, soul: 0, eggs: 0, frags: 0 }, add = r => { if (!r) return; tot.gems += r.gems || 0; tot.gold += r.gold || 0; tot.soul += r.soul || 0; tot.eggs += r.egg ? 1 : 0; tot.frags += Object.values(r.frags || {}).reduce((a: number, b: any) => a + b, 0) as number; };
    if (d.claim === '*') { for (const q of claimable(S)) add(claimQuest(S, q.id)); for (const c of chapterClaimable(S)) add(claimQuest(S, 'ch:' + c.id)); } // chapter chests after the quests that finish them
    else add(claimQuest(S, d.claim));
    save(); d.claim.startsWith('ch:') ? sfx.chime() : sfx.coin(); toast(['ได้รับ', tot.gems ? `เพชร ${tot.gems}` : '', tot.gold ? `ทอง ${tot.gold.toLocaleString()}` : '', tot.soul ? `ผลึกวิญญาณ ${tot.soul}` : '', tot.eggs ? `ไข่ปริศนา ${tot.eggs} ฟอง` : '', tot.frags ? `เศษไข่ ${tot.frags}` : ''].filter(Boolean).join(' ') || 'ได้รับรางวัล'); render(); }
  else if (d.buy === 'gold') { const e = buyGoldEgg(S); if (e) { save(); sfx.chime(); toast('ได้ไข่ปริศนาลายทอง! นำไปบ่มในรังได้เลย'); render(); } }
  else if (d.rush) { if (rushEgg(S, +d.rush)) { save(); sfx.starup(); render(); } }
  else if (d.incub) { if (startIncub(S, +d.incub)) { save(); sfx.chime(); render(); } }
  else if (d.dev) { devTool(d.dev); }
  else if (d.craft) { if (craftEgg(S, d.craft)) { save(); sfx.chime(); render(); } }
  else if (d.starcraft) { if (craftStarEgg(S, d.starcraft)) { save(); sfx.chime(); render(); } }
  else if (d.set) { const v = d.val === 'true' ? true : d.val === 'false' ? false : d.val; S.settings[d.set] = v; if (d.set === 'sound') setSound(v); if (d.set === 'quality') E.quality = { low: .35, mid: .7, high: 1 }[v]; save(); sfx.click(); render(); }
  else if (d.act === 'reset') { confirmReset = true; render(); }
  else if (d.act === 'resetNo') { confirmReset = false; render(); }
  else if (d.act === 'resetYes') { S = resetSave(); confirmReset = false; save(); render(); }
  else if (d.b === 'auto' && battle) {
    if (!battle.auto && !battle.autoPaid) { if (!payAuto(S, battle.stage)) { enModal(autoCost(battle.stage)); return; } battle.autoPaid = true; } // paid once per fight
    battle.auto = !battle.auto; S.settings.auto = battle.auto; save(); renderBattleButtons(); hudBattle(battle); }
  else if (d.b === 'speed' && battle) { battle.speed = battle.speed >= 3 ? 1 : battle.speed + 1; S.settings.speed = battle.speed; save(); renderBattleButtons(); }
  else if (d.b === 'exit') { confirmExit = true; renderBattleButtons(); }
  else if (d.b === 'exitNo') { confirmExit = false; renderBattleButtons(); }
  else if (d.b === 'exitYes') { leaveBattle(); show('map'); }
  else if (d.r === 'again') { const id = curStageId; leaveBattle(); startBattle(id); }
  else if (d.r === 'next') { const k = nextStageKey(curStageId); leaveBattle(); if (k) startBattle(k); else show('map'); }
  else if (d.r === 'hatch') { leaveBattle(); show('hatch'); }
  else if (d.r === 'map') { leaveBattle(); show('map'); }
  else if (d.h === 'more') { leaveHatch(); show('hatch'); }
  else if (d.h === 'map') { leaveHatch(); show('map'); }
  else if (d.h === 'mons') { leaveHatch(); evo = null; show('mons'); }
  else if (t.id && t.id.startsWith('sk') && battle) { battle.selectSkill(+t.id.slice(2)); hudBattle(battle); }
});
let drag = null;
$('#game').addEventListener('pointermove', e => { if (drag && scene === homeV) { const dx = e.clientX - drag.x; if (Math.abs(dx) > 6) drag.moved = true; homeV.pan = drag.pan - dx / E.base; } });
$('#game').addEventListener('pointerup', e => { if (drag && scene === homeV && !drag.moved) { const [wx, wy] = toWorld(e.clientX, e.clientY); homeV.tap(wx, wy); } drag = null; });
$('#game').addEventListener('pointerdown', e => {
  audioInit(); const [wx, wy] = toWorld(e.clientX, e.clientY);
  if (scene === homeV && homeV) { drag = { x: e.clientX, pan: homeV.pan, moved: false }; return; }
  if (scene === battle && battle) { if (battle.aim) { battle.tapAim(); return; } const v = battle.unitAt(wx, wy); if (v) battle.tapUnit(v.uid); }
  else if (scene === hatch && hatch) { if (hatch.hitTest(wx, wy) || hatch.phase === 'ready') hatch.tap(); }
});
addEventListener('keydown', e => {
  if (!battle) return; audioInit();
  if (e.code === 'Space') { e.preventDefault(); battle.tapAim(); }
  const n = { Digit1: 0, Digit2: 1, Digit3: 2 }[e.code]; if (n != null) { battle.selectSkill(n); hudBattle(battle); }
});

// ---------- loop ----------
let last = performance.now(), mineT = 0, incT = 0;
/** a bug in one frame must never stop the game: log it, tell the player once, keep the loop going */
const errSeen = new Set<string>();
function guard(f: () => void) {
  try { f(); } catch (e: any) { const m = String(e && e.message || e); if (!errSeen.has(m)) { errSeen.add(m); console.error(e); toast('เกิดข้อผิดพลาด (แคปจอนี้ส่งผู้พัฒนาได้): ' + m.slice(0, 80)); } }
}
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min(.05, (now - last) / 1000); last = now;
  const sp = scene === battle && battle ? battle.speed : 1, dt = rdt * sp;
  const frozen = E.hitstop > 0; E.hitstop = Math.max(0, E.hitstop - rdt);
  guard(() => { tickEngine(rdt); updScripts(frozen ? 0 : dt); });
  guard(() => scene.update(frozen ? 0 : dt));
  guard(() => updParts(frozen ? dt * .25 : dt));
  guard(() => { E.base = baseFor(scene); scene.render(); });
  if (cur === 'mons' && monTab !== 'dex') guard(() => drawShowcase(rdt));
  if (actT > 0) { actT -= rdt; if (actT <= 0) $('#actName').classList.remove('show'); }
  if (bannerT > 0) { bannerT -= rdt; if (bannerT <= 0) $('#banner').classList.remove('show'); }
  if (scene === homeV && selB === 'mine') { mineT -= rdt; if (mineT <= 0) { mineT = 1; const st = mineStored(S), cap = mineCap(S), el = $('#mineSt'); if (el) { el.textContent = st.toLocaleString() + ' / ' + cap.toLocaleString(); $('#mineBar').style.transform = `scaleX(${st / cap})`; const cb = document.querySelector('[data-hb=collect]'); if (cb) cb.disabled = st < 1; } } }
  if (!battle && !hatch) { incT -= rdt; if (incT <= 0) { incT = 1; tickIncub(); const lbl = enLabel(); for (const e of document.querySelectorAll('.enTxt')) e.innerHTML = lbl; } }
  if (battle) { orderT -= rdt; if (orderT <= 0) { orderT = .2; guard(renderOrder); } }
}
(async () => {
  try {
    await loadAssets();
    try { await Promise.race([document.fonts.load('600 20px Mitr'), new Promise(r => setTimeout(r, 2000))]); } catch (e) { }
    initCanvas($('#game'));
    $('#loading').hidden = true; render(); requestAnimationFrame(frame); setTimeout(() => { prefetchPlates(); prefetchExt(() => { if (!battle && !hatch && cur !== 'home') render(); }); }, 1500); // painted battle plates + Starborn art are separate files
    (window as any).__w2s = id => { const [x, y] = homeV.bPos(BDEF[id]); const z = E.base * E.zoom; return [(x - E.cam.x) * z + E.W / 2, (y - 30 * homeV.scaleShow - E.cam.y) * z + E.H / 2]; };
    (window as any).__eb = { get S() { return S; }, get battle() { return battle; }, get hatch() { return hatch; }, startBattle, startHatch, show, devTool, IMG, get homeV() { return homeV; }, get chest() { return chestUI; }, selectB(id) { homeV.sel = id; selB = id; renderPanel(); }, setLocation, LOC_IDS, get E() { return E; } };
  } catch (err) { $('#loading').textContent = 'โหลดไม่สำเร็จ: ' + err.message; console.error(err); }
})();
