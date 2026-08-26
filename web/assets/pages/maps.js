import {
  data, index, esc, n, table, filterable, link, monsterLink, mapLink, respawnRange,
} from "../app.js";
import { RACE_TH, SIZE_TH, elementLabel } from "./monsters.js";

const MODE_TH = { Town: "เมือง", Field: "ทุ่ง", Dungeon: "ดันเจี้ยน", Indoor: "ในอาคาร" };

// --------------------------------------------------------------------- list

export async function list() {
  const maps = await data("maps");
  const host = document.createElement("div");
  host.innerHTML = `
    <h1>แมพ</h1>
    <p class="lede">${n(maps.length)} แมพที่เปิดใช้จริง — ตัวเลข "มอนทั้งหมด" คือจำนวนตัวที่เกิดพร้อมกันได้สูงสุดในแมพนั้น</p>`;

  const body = document.createElement("div");
  host.appendChild(body);

  const groups = [...new Set(maps.map((m) => m.instance).filter(Boolean))].sort();
  const modes = [...new Set(maps.map((m) => m.mode).filter(Boolean))].sort();

  filterable({
    host: body,
    items: maps,
    controls: [
      { type: "search", key: "q", placeholder: "ชื่อหรือรหัสแมพ…",
        test: (m, v) => `${m.name} ${m.code}`.toLowerCase().includes(v) },
      { key: "instance", label: "กลุ่ม",
        options: [["", "กลุ่ม: ทั้งหมด"], ...groups],
        test: (m, v) => m.instance === v },
      { key: "mode", label: "ประเภท",
        options: [["", "ประเภท: ทั้งหมด"], ...modes.map((x) => [x, MODE_TH[x] ?? x])],
        test: (m, v) => m.mode === v },
      { key: "has", label: "มีอะไร",
        options: [["", "มีอะไร: ทั้งหมด"], ["mobs", "มีมอน"], ["nomobs", "ไม่มีมอน"],
                  ["npc", "มี NPC"], ["save", "มีจุดเซฟ"]],
        test: (m, v) =>
          v === "mobs" ? m.monsterCount > 0
          : v === "nomobs" ? m.monsterCount === 0
          : v === "npc" ? m.npcs.length > 0
          : !!m.savePoints },
    ],
    render: (rows) =>
      table(rows, [
        { key: "name", label: "ชื่อแมพ", cls: "name",
          render: (m) => link(`#/map/${m.code}`, m.name) },
        { key: "code", label: "รหัส", cls: "mono" },
        { key: "instance", label: "กลุ่ม" },
        { key: "mode", label: "ประเภท", render: (m) => esc(MODE_TH[m.mode] ?? m.mode) },
        { key: "monsterCount", label: "มอนทั้งหมด", num: true, render: (m) => n(m.monsterCount) },
        { key: "kinds", label: "ชนิดมอน", num: true,
          sortValue: (m) => new Set(m.spawns.map((s) => s.code)).size,
          render: (m) => n(new Set(m.spawns.map((s) => s.code)).size) },
        { key: "npcCount", label: "NPC", num: true,
          sortValue: (m) => m.npcs.length, render: (m) => n(m.npcs.length) },
        { key: "warpCount", label: "ทางออก", num: true,
          sortValue: (m) => m.warps.length, render: (m) => n(m.warps.length) },
      ], { sort: "monsterCount", dir: "desc" }),
  });

  return host;
}

// ------------------------------------------------------------------- detail

export async function detail({ rest }) {
  const code = rest[0] ?? "";
  const maps = await index("mapsByCode");
  const map = maps.get(code);
  if (!map) return `<h1>ไม่พบแมพ</h1><p>ไม่มีแมพรหัส <code>${esc(code)}</code> ใน <code>Maps.csv</code></p>`;

  const mons = await index("monstersByCode");

  // several spawn blocks can name the same monster on one map; add them up
  const merged = new Map();
  for (const s of map.spawns) {
    const cur = merged.get(s.code) ?? {
      code: s.code, count: 0, flags: new Set(), fixed: false,
      respawnMin: Infinity, respawnMax: 0,
    };
    cur.count += s.count;
    if (s.flag) cur.flags.add(s.flag);
    if (s.fixed) cur.fixed = true;
    cur.respawnMin = Math.min(cur.respawnMin, s.respawnMin);
    cur.respawnMax = Math.max(cur.respawnMax, s.respawnMax);
    merged.set(s.code, cur);
  }
  const spawnRows = [...merged.values()]
    .map((s) => ({ ...s, mon: mons.get(s.code) }))
    .sort((a, b) => b.count - a.count);

  const spawnTable = spawnRows.length
    ? table(spawnRows, [
        { key: "name", label: "มอนสเตอร์", cls: "name",
          sortValue: (r) => r.mon?.name?.toLowerCase() ?? r.code,
          render: (r) =>
            monsterLink(r.mon) +
            [...r.flags].map((f) => ` <span class="chip ${f === "MVP" ? "mvp" : "boss"}">${esc(f)}</span>`).join("") +
            (r.fixed ? ' <span class="chip mute" title="เกิดที่พิกัดตายตัว">จุดตายตัว</span>' : "") },
        { key: "count", label: "จำนวน", num: true, render: (r) => n(r.count) },
        { key: "level", label: "Lv", num: true, sortValue: (r) => r.mon?.level ?? 0,
          render: (r) => r.mon?.level ?? "" },
        { key: "hp", label: "HP", num: true, sortValue: (r) => r.mon?.hp ?? 0,
          render: (r) => n(r.mon?.hp ?? 0) },
        { key: "element", label: "ธาตุ", sortValue: (r) => r.mon?.element ?? "",
          render: (r) => esc(r.mon ? elementLabel(r.mon.element) : "") },
        { key: "race", label: "เผ่า", sortValue: (r) => r.mon?.race ?? "",
          render: (r) => esc(RACE_TH[r.mon?.race] ?? r.mon?.race ?? "") },
        { key: "size", label: "ขนาด", sortValue: (r) => r.mon?.size ?? "",
          render: (r) => esc(SIZE_TH[r.mon?.size] ?? r.mon?.size ?? "") },
        { key: "exp", label: "EXP", num: true, sortValue: (r) => r.mon?.exp ?? 0,
          render: (r) => n(r.mon?.exp ?? 0) },
        { key: "respawn", label: "เกิดใหม่", num: true, sortValue: (r) => r.respawnMin,
          render: (r) => esc(respawnRange(r.respawnMin, r.respawnMax)) },
      ], { sort: "count", dir: "desc" }).outerHTML
    : "<p>แมพนี้ไม่มีมอนเกิด</p>";

  const levelRange = spawnRows.length
    ? (() => {
        const lv = spawnRows.map((r) => r.mon?.level ?? 0).filter(Boolean);
        return lv.length ? `${Math.min(...lv)} – ${Math.max(...lv)}` : "";
      })()
    : "";

  const npcRows = map.npcs.length
    ? map.npcs
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(
          (npc) =>
            `<tr><td>${esc(npc.name || "(ไม่มีชื่อ)")}</td>
             <td class="num mono">${npc.x}, ${npc.y}</td>
             <td class="mono">${esc(npc.sprite)}</td>
             <td class="mono">${esc(npc.file)}</td></tr>`
        )
        .join("")
    : "";

  const warpRows = map.warps.length
    ? map.warps
        .slice()
        .sort((a, b) => a.to.localeCompare(b.to))
        .map((w) => {
          const dest = maps.get(w.to);
          return `<tr><td class="num mono">${w.x}, ${w.y}</td>
            <td class="name">${mapLink(dest, w.to)}</td>
            <td class="num mono">${w.toX}, ${w.toY}</td></tr>`;
        })
        .join("")
    : "";

  const saveRows = (map.savePoints ?? [])
    .map((s) => `<tr><td>${esc(s.name)}</td><td class="num mono">${s.x}, ${s.y}</td></tr>`)
    .join("");

  const bosses = spawnRows.filter((r) => r.flags.size || r.mon?.isMvp || r.mon?.special === "Boss");

  return `
    <p class="crumbs">${link("#/maps", "แมพ")} / ${esc(map.name)}</p>
    <h1>${esc(map.name)}</h1>
    <p class="lede mono">${esc(map.code)}</p>
    <div class="chiprow">
      ${map.instance ? `<span class="chip">${esc(map.instance)}</span>` : ""}
      ${map.mode ? `<span class="chip">${esc(MODE_TH[map.mode] ?? map.mode)}</span>` : ""}
      ${map.flags.filter((f) => f !== "None").map((f) => `<span class="chip mute">${esc(f)}</span>`).join("")}
      ${map.savePoints ? '<span class="chip">มีจุดเซฟ</span>' : ""}
    </div>

    <dl class="facts">
      <div class="fact"><dt>มอนที่เกิดพร้อมกัน</dt><dd>${n(map.monsterCount)}</dd></div>
      <div class="fact"><dt>ชนิดมอน</dt><dd>${n(merged.size)}</dd></div>
      ${levelRange ? `<div class="fact"><dt>ช่วงเลเวลมอน</dt><dd>${esc(levelRange)}</dd></div>` : ""}
      <div class="fact"><dt>NPC</dt><dd>${n(map.npcs.length)}</dd></div>
      <div class="fact"><dt>ทางออก</dt><dd>${n(map.warps.length)}</dd></div>
      ${map.music ? `<div class="fact"><dt>เพลง</dt><dd class="mono">${esc(map.music)}</dd></div>` : ""}
    </dl>

    ${bosses.length ? `<div class="note warn">
      <p><strong>มีบอสในแมพนี้</strong></p>
      <p>${bosses
        .map((b) => `${monsterLink(b.mon)} — เกิดใหม่ ${esc(respawnRange(b.respawnMin, b.respawnMax))}`)
        .join("<br>")}</p>
      <p>${link("#/bosses", "ดูตารางเวลาเกิดของบอสทั้งหมด")}</p>
    </div>` : ""}

    <h2>มอนสเตอร์ในแมพ</h2>
    ${spawnTable}

    ${npcRows ? `<h2>NPC ในแมพ</h2>
      <div class="tablewrap"><table>
        <thead><tr><th>ชื่อ</th><th class="num">พิกัด</th><th>สไปรท์</th><th>ไฟล์สคริปต์</th></tr></thead>
        <tbody>${npcRows}</tbody></table></div>` : ""}

    ${warpRows ? `<h2>ทางออก</h2>
      <div class="tablewrap"><table>
        <thead><tr><th class="num">จากพิกัด</th><th>ไปที่</th><th class="num">ลงที่พิกัด</th></tr></thead>
        <tbody>${warpRows}</tbody></table></div>` : ""}

    ${saveRows ? `<h2>จุดเซฟ</h2>
      <div class="tablewrap"><table>
        <thead><tr><th>ชื่อ</th><th class="num">พิกัด</th></tr></thead>
        <tbody>${saveRows}</tbody></table></div>` : ""}
  `;
}
