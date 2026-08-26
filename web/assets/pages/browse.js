import { data, esc, n, link, respawnRange } from "../app.js";
import {
  ELEMENT_TH, RACE_TH, SIZE_TH, splitElement, elementLabel,
  LEVEL_BANDS, bandLabel, bandKey,
} from "./monsters.js";

/**
 * Browse every monster by the axes that decide a fight: element (and its level),
 * race, size, level band, boss status. Each tile links into the monster list with
 * the matching filter already applied.
 */
export async function render() {
  const [monsters, chart] = await Promise.all([data("monsters"), data("elements")]);

  const alive = (m) => !m.noSpawn;
  const count = (fn) => monsters.filter(fn).length;
  const live = (fn) => monsters.filter((m) => fn(m) && alive(m)).length;

  // ---------------------------------------------------------------- ธาตุ
  const elementBases = [...new Set(monsters.map((m) => splitElement(m.element).base))].sort();
  const attacks = chart.attackElements.filter((e) => e !== "None" && e !== "Special");

  const elementRows = [];
  for (const base of elementBases) {
    for (let lvl = 1; lvl <= 4; lvl++) {
      const key = `${base}${lvl}`;
      const list = monsters.filter((m) => m.element === key);
      if (!list.length) continue;
      const row = chart.chart[key] ?? {};
      const weak = attacks
        .map((a) => [a, row[a] ?? 100])
        .filter(([, v]) => v > 100)
        .sort((a, b) => b[1] - a[1]);
      const resist = attacks
        .map((a) => [a, row[a] ?? 100])
        .filter(([, v]) => v < 100)
        .sort((a, b) => a[1] - b[1]);
      elementRows.push({ base, lvl, key, list, weak, resist });
    }
  }

  const elementCards = elementRows
    .map(
      (r) => `
      <a class="tile" href="#/monsters?element=${esc(r.base)}&elementLevel=${r.lvl}">
        <strong>${esc(ELEMENT_TH[r.base] ?? r.base)} ${r.lvl}</strong>
        <small>${n(r.list.length)} ตัว · Lv ${Math.min(...r.list.map((m) => m.level))}–${Math.max(...r.list.map((m) => m.level))}</small>
        <div class="chiprow" style="margin:8px 0 0">
          ${r.weak.slice(0, 2).map(([a, v]) =>
            `<span class="chip" style="background:#D6EFDD;color:#14532D;border-color:#A6D7B6">แพ้${esc(ELEMENT_TH[a] ?? a)} ${v}%</span>`).join("")}
          ${r.resist.slice(0, 2).map(([a, v]) =>
            `<span class="chip" style="background:#F6D2D2;color:#7A1414;border-color:#DFA0A0">${
              v === 0 ? `ภูมิ${esc(ELEMENT_TH[a] ?? a)}` : `ทน${esc(ELEMENT_TH[a] ?? a)} ${v}%`
            }</span>`).join("")}
        </div>
      </a>`
    )
    .join("");

  // ---------------------------------------------------------------- เผ่า
  const races = [...new Set(monsters.map((m) => m.race))].sort();
  const raceCards = races
    .map((race) => {
      const list = monsters.filter((m) => m.race === race);
      return `
      <a class="tile" href="#/monsters?race=${esc(race)}">
        <strong>${esc(RACE_TH[race] ?? race)}</strong>
        <small>${n(list.length)} ตัว · Lv ${Math.min(...list.map((m) => m.level))}–${Math.max(...list.map((m) => m.level))}</small>
        <small style="display:block;margin-top:4px">${esc(race)}</small>
      </a>`;
    })
    .join("");

  // ---------------------------------------------------------------- ขนาด
  const sizeCards = Object.entries(SIZE_TH)
    .map(([size, th]) => {
      const list = monsters.filter((m) => m.size === size);
      return `
      <a class="tile" href="#/monsters?size=${esc(size)}">
        <strong>ขนาด${esc(th)}</strong>
        <small>${n(list.length)} ตัว</small>
      </a>`;
    })
    .join("");

  // ---------------------------------------------------------- ช่วงเลเวล
  const bandRows = LEVEL_BANDS.map((band) => {
    const [lo, hi] = band;
    const list = monsters.filter((m) => m.level >= lo && m.level <= hi);
    const spawned = list.filter(alive);
    const totalSlots = spawned.reduce(
      (s, m) => s + (m.maps ?? []).reduce((x, p) => x + p.count, 0), 0);
    const bestExp = list.slice().sort((a, b) => b.exp - a.exp)[0];
    return { band, list, spawned, totalSlots, bestExp };
  }).filter((r) => r.list.length);

  const bandTable = bandRows
    .map(
      (r) => `<tr>
        <td class="name">${link(`#/monsters?level=${bandKey(r.band)}`, `Lv ${bandLabel(r.band)}`)}</td>
        <td class="num">${n(r.list.length)}</td>
        <td class="num">${n(r.spawned.length)}</td>
        <td class="num">${n(r.totalSlots)}</td>
        <td class="name">${r.bestExp ? link(`#/monster/${r.bestExp.code}`, r.bestExp.name) : ""}</td>
        <td class="num">${r.bestExp ? n(r.bestExp.exp) : ""}</td>
      </tr>`
    )
    .join("");

  // ------------------------------------------------------------ ประเภท
  const mvps = monsters.filter((m) => m.isMvp);
  const minibosses = monsters.filter((m) => !m.isMvp && m.special === "Boss");
  const normals = monsters.filter((m) => !m.isMvp && m.special !== "Boss");

  const kindCards = [
    ["MVP", mvps, "#/monsters?special=mvp", "เกิดใหม่ 14–15 นาที · ทับเพดาน MaxSpawnTime"],
    ["มินิบอส", minibosses, "#/monsters?special=Boss", "เกิดใหม่ 6 นาที · โดนเพดาน MaxSpawnTime ตัด"],
    ["มอนธรรมดา", normals, "#/monsters?special=normal", "ไม่ใช้สกิลเลย เพราะ RestrictMonsterSkillsToBosses เปิดอยู่"],
  ]
    .map(
      ([label, list, href, note]) => `
      <a class="tile" href="${href}">
        <strong>${esc(label)}</strong>
        <small>${n(list.length)} ตัว</small>
        <small style="display:block;margin-top:4px">${esc(note)}</small>
      </a>`
    )
    .join("");

  // ------------------------------------------------------------- ที่เกิด
  const summoned = monsters.filter((m) => m.summonedBy);
  const nowhere = monsters.filter((m) => m.noSpawn);

  return `
    <p class="crumbs">${link("#/monsters", "มอนสเตอร์")} / แยกประเภท</p>
    <h1>แยกประเภทมอนสเตอร์</h1>
    <p class="lede">
      ${n(monsters.length)} ตัว แยกตามสิ่งที่ตัดสินผลการต่อสู้ — กดที่การ์ดเพื่อเปิดรายการที่กรองไว้แล้ว
    </p>

    <h2>ตามธาตุและระดับธาตุ</h2>
    <p class="lede">
      ระดับธาตุมีผลมาก ธาตุเดียวกันคนละระดับรับดาเมจต่างกันได้เท่าตัว
      ป้ายเขียวคือธาตุที่ตีมันแรง ป้ายแดงคือธาตุที่ตีไม่ค่อยเข้า
      (${link("#/guide/elements", "ตารางเต็ม")})
    </p>
    <div class="grid grid-wide">${elementCards}</div>

    <h2>ตามเผ่า</h2>
    <p class="lede">การ์ดกันเผ่าและการ์ดเพิ่มดาเมจต่อเผ่าใช้ค่านี้</p>
    <div class="grid">${raceCards}</div>

    <h2>ตามขนาด</h2>
    <p class="lede">
      Pierce ตีตามขนาด เล็ก 1 ครั้ง กลาง 2 ครั้ง ใหญ่ 3 ครั้ง
      และการ์ดอย่าง Executioner กันดาเมจตามขนาดของตัวที่ตีเรา
    </p>
    <div class="grid">${sizeCards}</div>

    <h2>ตามประเภท</h2>
    <div class="grid grid-wide">${kindCards}</div>

    <h2>ตามช่วงเลเวล</h2>
    <p class="lede">คอลัมน์ "ตัวที่เกิดจริง" ไม่นับตัวที่ยังไม่มีที่เกิด</p>
    <div class="tablewrap"><table>
      <thead><tr><th>ช่วงเลเวล</th><th class="num">มีทั้งหมด</th><th class="num">ตัวที่เกิดจริง</th>
        <th class="num">จำนวนที่เกิดพร้อมกัน</th><th>EXP สูงสุดในช่วง</th><th class="num">EXP</th></tr></thead>
      <tbody>${bandTable}</tbody>
    </table></div>

    <h2>ตามที่มา</h2>
    <div class="grid grid-wide">
      <a class="tile" href="#/monsters?spawn=yes">
        <strong>เกิดตามแมพ</strong>
        <small>${n(monsters.length - summoned.length - nowhere.length)} ตัว</small>
        <small style="display:block;margin-top:4px">มีสคริปต์เกิดในแมพที่เปิดใช้จริง</small>
      </a>
      <a class="tile" href="#/monsters?spawn=summon">
        <strong>ถูกเรียกออกมา</strong>
        <small>${n(summoned.length)} ตัว</small>
        <small style="display:block;margin-top:4px">สกิลของมอนอื่น อีเวนต์ หรือโค้ดเรียก</small>
      </a>
      <a class="tile" href="#/monsters?spawn=no">
        <strong>ยังไม่มีที่เกิด</strong>
        <small>${n(nowhere.length)} ตัว</small>
        <small style="display:block;margin-top:4px">เจอได้ด้วยคำสั่ง GM เท่านั้น</small>
      </a>
    </div>
  `;
}
