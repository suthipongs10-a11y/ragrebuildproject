import {
  data, index, esc, n, table, filterable, link, monsterLink, mapLink,
  duration, respawnRange,
} from "../app.js";
import { RACE_TH, SIZE_TH, elementLabel } from "./monsters.js";

/**
 * Every MVP and mini boss, with the respawn window the server will actually use.
 *
 * The written spawn times in the scripts are mostly not what happens: appsettings
 * clamps everything to MaxSpawnTime, then the milestone event overrides MVPs.
 * A page that repeated the script numbers would send people back an hour late.
 */
export async function list() {
  const [monsters, maps] = await Promise.all([data("monsters"), index("mapsByCode")]);

  const rows = [];
  for (const mon of monsters) {
    const isBoss = mon.isMvp || mon.special === "Boss";
    const flagged = (mon.maps ?? []).filter((p) => p.flag);
    if (!isBoss && !flagged.length) continue;
    for (const place of mon.maps ?? []) {
      if (!isBoss && !place.flag) continue;
      rows.push({
        mon,
        place,
        kind: mon.isMvp ? "MVP" : place.flag === "MVP" ? "MVP" : "บอส",
        mapName: maps.get(place.map)?.name ?? place.map,
      });
    }
  }

  const clamped = rows.filter((r) => r.place.respawnWritten);
  const host = document.createElement("div");
  host.innerHTML = `
    <h1>บอสและ MVP</h1>
    <p class="lede">
      ${n(new Set(rows.map((r) => r.mon.code)).size)} ตัว จุดเกิดรวม ${n(rows.length)} จุด —
      คอลัมน์ "เกิดใหม่" คือเวลาที่เซิร์ฟใช้จริง ไม่ใช่ตัวเลขในสคริปต์
    </p>

    <div class="note warn">
      <p><strong>เวลาเกิดใหม่ในสคริปต์ส่วนใหญ่ไม่ได้ถูกใช้จริง</strong></p>
      <p>ลำดับที่เซิร์ฟทำ (<code>ServerMapConfig.CreateSpawn</code>):</p>
      <ol>
        <li>อ่านเวลาจากสคริปต์ ถ้าไม่ได้เขียนไว้ = 0</li>
        <li>ถ้าน้อยกว่า <code>MinSpawnTime</code> (2 วินาที) ดันขึ้นเป็น 2 วินาที</li>
        <li>ช่วงบนคือ เวลา + variance</li>
        <li>ถ้าเกิน <code>MaxSpawnTime</code> (<strong>6 นาที</strong>) ตัดลงเหลือ 6 นาที ทั้งช่วงล่างและช่วงบน</li>
        <li><code>ServerMilestoneEvent.OnSetMonsterSpawnTime</code> ทับ MVP เป็น <strong>14–15 นาที</strong>
          ขั้นตอนนี้อยู่หลังการตัด MVP จึงไม่โดนเพดาน 6 นาที</li>
      </ol>
      <p>
        ตอนตายจริงเซิร์ฟสุ่มเวลาในช่วงนั้น (<code>Monster.cs</code>)
        ผลคือ <strong>มินิบอสทุกตัวเกิดใหม่ใน 6 นาที</strong> ไม่ว่าจะเขียนไว้ 30 นาทีหรือ 1 ชั่วโมง
        และ <strong>MVP ทุกตัวเกิดใหม่ใน 14–15 นาที</strong> ไม่ว่าจะเขียนไว้เท่าไหร่
        ตอนนี้มี ${n(clamped.length)} จุดเกิดที่ตัวเลขจริงไม่ตรงกับสคริปต์
      </p>
      <p>
        ถ้าอยากให้ตรงตามที่เขียน ต้องแก้ <code>MaxSpawnTime</code> ใน
        <code>appsettings.json</code> (ตั้ง 0 = ปิดเพดาน) และแก้ค่าใน
        <code>ServerMilestoneEvent.OnSetMonsterSpawnTime</code>
      </p>
    </div>`;

  const body = document.createElement("div");
  host.appendChild(body);

  filterable({
    host: body,
    items: rows,
    controls: [
      { type: "search", key: "q", placeholder: "ชื่อบอส หรือแมพ…",
        test: (r, v) => `${r.mon.name} ${r.mon.code} ${r.place.map} ${r.mapName}`.toLowerCase().includes(v) },
      { key: "kind", label: "ประเภท",
        options: [["", "ประเภท: ทั้งหมด"], ["MVP", "MVP"], ["บอส", "มินิบอส"]],
        test: (r, v) => r.kind === v },
      { key: "clamped", label: "ตรงกับสคริปต์",
        options: [["", "ตรงกับสคริปต์: ทั้งหมด"], ["no", "ถูกตัดเวลา"], ["yes", "ตรงตามสคริปต์"]],
        test: (r, v) => (v === "no" ? !!r.place.respawnWritten : !r.place.respawnWritten) },
    ],
    render: (list) =>
      table(list, [
        { key: "name", label: "บอส", cls: "name",
          sortValue: (r) => r.mon.name.toLowerCase(),
          render: (r) => monsterLink(r.mon) +
            (r.kind === "MVP" ? ' <span class="chip mvp">MVP</span>' : ' <span class="chip boss">บอส</span>') },
        { key: "level", label: "Lv", num: true, sortValue: (r) => r.mon.level,
          render: (r) => r.mon.level },
        { key: "hp", label: "HP", num: true, sortValue: (r) => r.mon.hp,
          render: (r) => n(r.mon.hp) },
        { key: "element", label: "ธาตุ", sortValue: (r) => r.mon.element,
          render: (r) => esc(elementLabel(r.mon.element)) },
        { key: "race", label: "เผ่า", sortValue: (r) => r.mon.race,
          render: (r) => esc(RACE_TH[r.mon.race] ?? r.mon.race) },
        { key: "map", label: "แมพ", cls: "name", sortValue: (r) => r.mapName.toLowerCase(),
          render: (r) => mapLink(maps.get(r.place.map), r.place.map) },
        { key: "respawn", label: "เกิดใหม่", num: true,
          sortValue: (r) => r.place.respawnMin,
          render: (r) => esc(respawnRange(r.place.respawnMin, r.place.respawnMax)) },
        { key: "written", label: "สคริปต์เขียนไว้", num: true,
          sortValue: (r) => r.place.respawnWritten ?? r.place.respawnMin,
          render: (r) => r.place.respawnWritten
            ? `<span class="chip warn">${esc(duration(r.place.respawnWritten))}</span>`
            : '<span class="chip mute">ตรงกัน</span>' },
        { key: "exp", label: "EXP", num: true, sortValue: (r) => r.mon.exp,
          render: (r) => n(r.mon.exp) },
      ], { sort: "level", dir: "asc" }),
  });

  return host;
}
