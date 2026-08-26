import {
  data, index, esc, n, pct, ms, table, filterable, link, itemLink, mapLink,
  duration, respawnRange,
} from "../app.js";

// ------------------------------------------------------------------ ตัวช่วย

export const ELEMENT_TH = {
  Neutral: "ไร้ธาตุ", Earth: "ดิน", Water: "น้ำ", Fire: "ไฟ", Wind: "ลม",
  Poison: "พิษ", Undead: "อันเดด", Dark: "มืด", Holy: "ศักดิ์สิทธิ์",
  Ghost: "ผี", Special: "พิเศษ", None: "ไม่มี",
};

export const RACE_TH = {
  Formless: "ไร้รูป", Undead: "อันเดด", Beast: "สัตว์", Plant: "พืช",
  Insect: "แมลง", Fish: "ปลา", Demon: "ปีศาจ", Demihuman: "กึ่งมนุษย์",
  Angel: "เทวดา", Dragon: "มังกร",
};

export const SIZE_TH = { Small: "เล็ก", Medium: "กลาง", Large: "ใหญ่" };

/** "Fire2" -> {base: "Fire", level: 2} - the chart is keyed by the full string. */
export function splitElement(code) {
  const m = /^([A-Za-z]+)(\d)?$/.exec(code ?? "");
  return { base: m?.[1] ?? code ?? "", level: Number(m?.[2] ?? 1) };
}

export function elementLabel(code) {
  const { base, level } = splitElement(code);
  return `${ELEMENT_TH[base] ?? base} ${level}`;
}

// --------------------------------------------------------------------- list

/** Level bands used by the browse page and the level filter. */
export const LEVEL_BANDS = [
  [1, 10], [11, 20], [21, 30], [31, 40], [41, 50],
  [51, 60], [61, 70], [71, 80], [81, 90], [91, 999],
];

export const bandLabel = ([lo, hi]) => (hi >= 999 ? `${lo}+` : `${lo}–${hi}`);
export const bandKey = ([lo, hi]) => `${lo}-${hi}`;

export async function list({ query }) {
  const monsters = await data("monsters");
  const host = document.createElement("div");
  host.innerHTML = `
    <h1>มอนสเตอร์</h1>
    <p class="lede">${n(monsters.length)} ตัว — คลิกหัวคอลัมน์เพื่อเรียงลำดับ กดชื่อเพื่อดูรายละเอียดและตารางดรอป
    · ${link("#/monsters/by", "ดูแบบแยกประเภท")}</p>`;

  const body = document.createElement("div");
  host.appendChild(body);

  const elements = [...new Set(monsters.map((m) => splitElement(m.element).base))].sort();
  const races = [...new Set(monsters.map((m) => m.race))].sort();
  const q = (key) => query.get(key) ?? "";

  filterable({
    host: body,
    items: monsters,
    controls: [
      { type: "search", key: "q", placeholder: "ชื่อหรือรหัสมอน…",
        test: (m, v) => `${m.name} ${m.code}`.toLowerCase().includes(v) },
      { key: "element", value: q("element"), label: "ธาตุ",
        options: [["", "ธาตุ: ทั้งหมด"], ...elements.map((e) => [e, ELEMENT_TH[e] ?? e])],
        test: (m, v) => splitElement(m.element).base === v },
      { key: "race", value: q("race"), label: "เผ่า",
        options: [["", "เผ่า: ทั้งหมด"], ...races.map((r) => [r, RACE_TH[r] ?? r])],
        test: (m, v) => m.race === v },
      { key: "size", value: q("size"), label: "ขนาด",
        options: [["", "ขนาด: ทั้งหมด"], ...Object.entries(SIZE_TH).map(([k, v]) => [k, v])],
        test: (m, v) => m.size === v },
      { key: "special", value: q("special"), label: "ประเภท",
        options: [["", "ประเภท: ทั้งหมด"], ["mvp", "MVP"], ["Boss", "บอส"], ["normal", "ธรรมดา"]],
        test: (m, v) =>
          v === "mvp" ? !!m.isMvp : v === "normal" ? !m.special && !m.isMvp : m.special === v },
      { key: "elementLevel", value: q("elementLevel"), label: "ระดับธาตุ",
        options: [["", "ระดับธาตุ: ทั้งหมด"], ["1", "ระดับ 1"], ["2", "ระดับ 2"],
                  ["3", "ระดับ 3"], ["4", "ระดับ 4"]],
        test: (m, v) => String(splitElement(m.element).level) === v },
      { key: "level", value: q("level"), label: "ช่วงเลเวล",
        options: [["", "ช่วงเลเวล: ทั้งหมด"],
                  ...LEVEL_BANDS.map((b) => [bandKey(b), `Lv ${bandLabel(b)}`])],
        test: (m, v) => {
          const [lo, hi] = v.split("-").map(Number);
          return m.level >= lo && m.level <= hi;
        } },
      { key: "spawn", value: q("spawn"), label: "ที่เกิด",
        options: [["", "ที่เกิด: ทั้งหมด"], ["yes", "เกิดตามแมพ"],
                  ["summon", "ถูกเรียกด้วยสคริปต์"], ["no", "ยังไม่มีที่เกิด"]],
        test: (m, v) => (v === "yes" ? !m.noSpawn && !m.summonedBy
                         : v === "summon" ? !!m.summonedBy : !!m.noSpawn) },
    ],
    render: (rows) =>
      table(rows, [
        { key: "name", label: "ชื่อ", cls: "name",
          render: (m) =>
            link(`#/monster/${m.code}`, m.name) +
            (m.isMvp ? ' <span class="chip mvp">MVP</span>'
              : m.special === "Boss" ? ' <span class="chip boss">บอส</span>' : "") +
            (m.noSpawn ? ' <span class="chip warn">ไม่มีที่เกิด</span>' : "") +
            (m.summonedBy ? ' <span class="chip mute">ถูกเรียก</span>' : "") },
        { key: "level", label: "Lv", num: true },
        { key: "hp", label: "HP", num: true, render: (m) => n(m.hp) },
        { key: "atk", label: "ATK", num: true,
          sortValue: (m) => m.atkMax,
          render: (m) => `${n(m.atkMin)}–${n(m.atkMax)}` },
        { key: "def", label: "DEF", num: true },
        { key: "mdef", label: "MDEF", num: true },
        { key: "element", label: "ธาตุ", render: (m) => esc(elementLabel(m.element)) },
        { key: "race", label: "เผ่า", render: (m) => esc(RACE_TH[m.race] ?? m.race) },
        { key: "size", label: "ขนาด", render: (m) => esc(SIZE_TH[m.size] ?? m.size) },
        { key: "exp", label: "EXP", num: true, render: (m) => n(m.exp) },
        { key: "respawn", label: "เกิดใหม่", num: true,
          sortValue: (m) => (m.maps ?? []).reduce((lo, p) => Math.min(lo, p.respawnMin), Infinity),
          render: (m) => {
            const lo = (m.maps ?? []).reduce((x, p) => Math.min(x, p.respawnMin), Infinity);
            const hi = (m.maps ?? []).reduce((x, p) => Math.max(x, p.respawnMax), 0);
            return Number.isFinite(lo) ? esc(respawnRange(lo, hi)) : "";
          } },
        { key: "spawned", label: "เกิดทั้งหมด", num: true,
          sortValue: (m) => (m.maps ?? []).reduce((s, p) => s + p.count, 0),
          render: (m) => n((m.maps ?? []).reduce((s, p) => s + p.count, 0)) },
      ], { sort: "level", dir: "asc" }),
  });

  return host;
}

// ------------------------------------------------------------------- detail

export async function detail({ rest }) {
  const code = (rest[0] ?? "").toUpperCase();
  const mons = await index("monstersByCode");
  const mon = mons.get(code);
  if (!mon) return `<h1>ไม่พบมอนสเตอร์</h1><p>ไม่มีมอนรหัส <code>${esc(code)}</code> ในฐานข้อมูล</p>`;

  const [items, maps, elements] = await Promise.all([
    index("itemsById"), index("mapsByCode"), data("elements"),
  ]);

  const chips = [];
  if (mon.isMvp) chips.push('<span class="chip mvp">MVP</span>');
  else if (mon.special === "Boss") chips.push('<span class="chip boss">บอส</span>');
  chips.push(`<span class="chip">${esc(elementLabel(mon.element))}</span>`);
  chips.push(`<span class="chip">เผ่า${esc(RACE_TH[mon.race] ?? mon.race)}</span>`);
  chips.push(`<span class="chip">ขนาด${esc(SIZE_TH[mon.size] ?? mon.size)}</span>`);
  if (mon.tags?.length) for (const t of mon.tags) chips.push(`<span class="chip mute">${esc(t)}</span>`);
  if (mon.noSpawn) chips.push('<span class="chip warn">ยังไม่มีที่เกิด</span>');
  if (mon.summonedBy) chips.push('<span class="chip mute">ถูกเรียกด้วยสคริปต์</span>');

  // The attack element rule that trips everyone up, straight from the damage code.
  const isRanged = mon.range >= 4;

  const defRow = elements.chart[mon.element] ?? {};
  const attackOrder = elements.attackElements.filter((e) => e !== "None" && e !== "Special");
  const defCells = attackOrder
    .map((e) => {
      const v = defRow[e] ?? 100;
      const cls = v > 100 ? "good" : v < 100 ? "bad" : "";
      const style = v > 100 ? "color:#196B35;font-weight:700"
        : v < 100 ? "color:#9B1C1C;font-weight:700" : "";
      return `<tr><td>${esc(ELEMENT_TH[e] ?? e)}</td><td class="num" style="${style}">${v}%</td></tr>`;
    })
    .join("");

  const best = attackOrder
    .map((e) => [e, defRow[e] ?? 100])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .filter(([, v]) => v > 100)
    .map(([e, v]) => `${ELEMENT_TH[e] ?? e} (${v}%)`);

  const drops = (mon.drops ?? []).slice().sort((a, b) => b.chance - a.chance);
  const dropRows = drops.length
    ? drops
        .map((d) => {
          const it = items.get(d.id);
          const width = Math.max(2, Math.min(100, d.chance / 100));
          return `<tr>
            <td class="name">${itemLink(it)}</td>
            <td>${it ? esc(it.type) : ""}</td>
            <td class="num">${d.max > 1 ? `${d.min}–${d.max}` : "1"}</td>
            <td>
              <span class="chance"><b>${pct(d.chance)}</b><span class="bar"><i style="width:${width}%"></i></span></span>
            </td>
            <td class="num mono" title="ค่าดิบใน DropData.csv ก่อนคำนวณ">${d.base}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="5">ไม่ดรอปอะไรเลย</td></tr>`;

  const places = (mon.maps ?? [])
    .map((p) => {
      const m = maps.get(p.map);
      return `<tr><td class="name">${mapLink(m, p.map)}</td>
        <td class="mono">${esc(p.map)}</td>
        <td class="num">${n(p.count)}</td>
        <td class="num">${esc(respawnRange(p.respawnMin, p.respawnMax))}</td>
        <td class="num mono">${p.respawnWritten ? esc(duration(p.respawnWritten)) : ""}</td>
        <td>${m ? esc(m.instance || m.mode) : ""}</td></tr>`;
    })
    .join("");

  // the fastest window across every spawn point, which is what a hunter waits on
  const fastest = (mon.maps ?? []).reduce(
    (best, p) => (best === null || p.respawnMin < best.respawnMin ? p : best), null);
  const clamped = (mon.maps ?? []).some((p) => p.respawnWritten);

  const skills = (mon.skills ?? [])
    .map(
      (s) =>
        `<tr><td>${esc(s.skill)}</td><td class="num">Lv ${s.level}</td><td class="num">${s.chance}%</td></tr>`
    )
    .join("");

  return `
    <p class="crumbs">${link("#/monsters", "มอนสเตอร์")} / ${esc(mon.name)}</p>
    <h1>${esc(mon.name)}</h1>
    <p class="lede mono">${esc(mon.code)} · id ${mon.id}</p>
    <div class="chiprow">${chips.join("")}</div>

    ${mon.noSpawn ? `<div class="note bad">
      <p><strong>ตัวนี้ยังไม่มีที่เกิดในเซิร์ฟ</strong></p>
      <p>ไม่มีแมพไหนเกิดมัน และไม่มีสคริปต์หรือโค้ดไหนเรียกมันด้วย
      ตอนนี้เจอได้ด้วยคำสั่ง GM อย่างเดียว</p></div>` : ""}

    ${mon.summonedBy ? `<div class="note warn">
      <p><strong>ไม่ได้เกิดตามแมพ แต่ถูกเรียกออกมา</strong></p>
      <p>ไม่มีสคริปต์เกิดมอนของแมพไหนเรียกมัน แต่มีไฟล์เหล่านี้เรียกมันออกมา:
      ${mon.summonedBy.map((f) => `<code>${esc(f)}</code>`).join(" ")}
      — เช่นถูกสกิลของมอนตัวอื่นเรียก เป็นบอสของอีเวนต์ หรือถูกวางด้วยโค้ดตอนเซิร์ฟเปิด</p></div>` : ""}

    ${dl([
      ["Level", n(mon.level)],
      ["HP", n(mon.hp)],
      ["ATK", `${n(mon.atkMin)}–${n(mon.atkMax)}`],
      ["ระยะโจมตี", `${mon.range} ช่อง`],
      ["DEF", n(mon.def)],
      ["MDEF", n(mon.mdef)],
      ["EXP", n(mon.exp)],
      ["Job EXP", n(mon.jobExp)],
      ["เกิดใหม่หลังตาย", fastest ? respawnRange(fastest.respawnMin, fastest.respawnMax) : ""],
    ])}

    ${clamped ? `<div class="note warn">
      <p><strong>เวลาเกิดใหม่ไม่ตรงกับที่เขียนในสคริปต์</strong></p>
      <p>
        สคริปต์เขียนไว้ ${esc(duration(fastest.respawnWritten))}
        แต่ <code>appsettings.json</code> ตั้ง <code>MaxSpawnTime</code> ไว้ที่ 6 นาที
        ${mon.isMvp
          ? "และ MVP ถูกทับด้วย <code>ServerMilestoneEvent.OnSetMonsterSpawnTime</code> เป็น 14–15 นาทีอีกที"
          : "ทุกอย่างที่ไม่ใช่ MVP จึงถูกตัดเหลือ 6 นาที รวมถึงมินิบอสด้วย"}
        ดูรายละเอียดที่${link("#/bosses", "หน้ารวมบอส")}
      </p></div>` : ""}

    <h2>สเตตัส</h2>
    ${dl([
      ["STR", mon.str], ["AGI", mon.agi], ["VIT", mon.vit],
      ["INT", mon.int], ["DEX", mon.dex], ["LUK", mon.luk],
    ])}

    <h2>จังหวะและการเคลื่อนไหว</h2>
    ${dl([
      ["เวลาระหว่างการโจมตี", ms(mon.rechargeTime)],
      ["เวลาก่อนดาเมจเข้า", ms(mon.hitTime)],
      ["ท่าโจมตีทั้งท่า", ms(mon.attackTime)],
      ["ความเร็วเดิน", `${mon.moveSpeed} ms/ช่อง`],
      ["ระยะมองเห็น", `${mon.scanDist} ช่อง`],
      ["ระยะไล่", `${mon.chaseDist} ช่อง`],
      ["AI", mon.ai],
    ])}

    <div class="split">
      <div>
        <h2>ตีมันด้วยธาตุอะไรดี</h2>
        <p>ตัวมันเป็นธาตุ <strong>${esc(elementLabel(mon.element))}</strong>
        ${best.length ? `จุดอ่อนคือ <strong>${esc(best.join(" และ "))}</strong>` : "ไม่มีธาตุไหนแรงเป็นพิเศษ"}</p>
        <div class="tablewrap">
          <table>
            <thead><tr><th>ตีด้วยธาตุ</th><th class="num">ดาเมจ</th></tr></thead>
            <tbody>${defCells}</tbody>
          </table>
        </div>
      </div>
      <div>
        <h2>มันตีเราแบบไหน</h2>
        <div class="note">
          <p><strong>การโจมตีปกติของมันเป็นธาตุไร้ธาตุ (Neutral)</strong> ไม่ใช่ธาตุ${esc(elementLabel(mon.element))}</p>
          <p>มอนสเตอร์ทุกตัวตีเป็น Neutral เสมอ มีแต่ผู้เล่นที่อ่านธาตุจากอาวุธ
          (<code>CombatEntity.DamageHandling.cs</code>) เกราะที่กันธาตุ${esc(ELEMENT_TH[splitElement(mon.element).base] ?? "")}จึงไม่ช่วย
          ต้องกัน Neutral</p>
        </div>
        <div class="note${isRanged ? "" : " warn"}">
          <p><strong>${isRanged ? "การตีของมันนับเป็นระยะไกล" : "การตีของมันนับเป็นระยะประชิด"}</strong></p>
          <p>ระยะ ${mon.range} ${isRanged
            ? "ถึงเกณฑ์ 4 ช่อง การ์ดกันระยะไกล เช่น Horn Card จึงใช้ได้"
            : "ต่ำกว่าเกณฑ์ 4 ช่อง การ์ดกันระยะไกลไม่มีผลกับมัน"}</p>
        </div>
        ${mon.isMvp ? `<div class="note warn"><p><strong>เป็น MVP</strong></p>
          <p>ของที่เขียนไว้ใน <code>MvpList.csv</code> ไม่ได้ถูกโหลด ดรอปทั้งหมดมาจาก
          <code>DropData.csv</code> ตามตารางข้างล่างเท่านั้น</p></div>` : ""}
      </div>
    </div>

    <h2>ของที่ดรอป</h2>
    <p class="lede">เปอร์เซ็นต์ที่แสดงคืออัตราจริงหลังผ่าน <code>RemapDropRates</code> แล้ว
    คอลัมน์สุดท้ายคือค่าดิบใน <code>DropData.csv</code> ไว้เทียบ</p>
    <div class="tablewrap">
      <table>
        <thead><tr><th>ไอเท็ม</th><th>ประเภท</th><th class="num">จำนวน</th><th>โอกาสจริง</th><th class="num">ค่าดิบ</th></tr></thead>
        <tbody>${dropRows}</tbody>
      </table>
    </div>

    <h2>ที่เกิด</h2>
    ${places
      ? `<div class="tablewrap"><table>
          <thead><tr><th>แมพ</th><th>รหัส</th><th class="num">จำนวน</th>
            <th class="num">เกิดใหม่</th><th class="num">สคริปต์เขียนไว้</th><th>กลุ่ม</th></tr></thead>
          <tbody>${places}</tbody></table></div>`
      : "<p>ไม่มีแมพไหนเกิดมอนตัวนี้</p>"}

    ${skills ? `<h2>สกิลที่มันใช้</h2>
      <div class="tablewrap"><table>
        <thead><tr><th>สกิล</th><th class="num">เลเวล</th><th class="num">โอกาส</th></tr></thead>
        <tbody>${skills}</tbody></table></div>
      <p class="lede"><code>RestrictMonsterSkillsToBosses</code> เปิดอยู่ — มอนธรรมดาจะไม่ใช้สกิลพวกนี้
      มีแต่ MVP กับตัวที่ติดธง Boss ตอนเกิดเท่านั้นที่ใช้ได้</p>` : ""}
  `;
}

function dl(pairs) {
  return `<dl class="facts">${pairs
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `<div class="fact"><dt>${esc(k)}</dt><dd>${v}</dd></div>`)
    .join("")}</dl>`;
}
