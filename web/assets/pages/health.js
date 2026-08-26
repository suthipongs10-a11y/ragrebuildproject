import { data, esc, n, link, itemLink } from "../app.js";

/**
 * What the exporter noticed while reading the game data. Not a bug list for the
 * website - a bug list for the server's own files, put where somebody will see it.
 */
export async function list() {
  const [meta, items, monsters, ref, jobs, skills, maps] = await Promise.all([
    data("meta"), data("items"), data("monsters"), data("reference"),
    data("jobs"), data("skills"), data("maps"),
  ]);

  const noSpawn = monsters.filter((m) => m.noSpawn);
  const summoned = monsters.filter((m) => m.summonedBy);
  const noSource = items.filter((i) => !i.droppedBy && !i.soldBy);
  const badGroup = items.filter((i) => i.equipGroup && !ref.equipGroups[i.equipGroup]);
  const noHp = jobs.filter((j) => j.noHpCurve);
  const noTree = jobs.filter((j) => !skills.trees[j.name]);
  const orphanSkills = Object.values(skills.skills).filter(
    (s) => !Object.values(skills.trees).some((t) => t.skills.some((e) => e.skill === s.code))
  );
  const emptyMaps = maps.filter((m) => !m.spawns.length && !m.npcs.length);

  // group the unequippable items by the group they name, so it reads as
  // "these five group names are missing" rather than 132 separate lines
  const byGroup = new Map();
  for (const i of badGroup) {
    if (!byGroup.has(i.equipGroup)) byGroup.set(i.equipGroup, []);
    byGroup.get(i.equipGroup).push(i);
  }

  const unreachable = Object.entries(meta.unreachableSpawnMaps ?? {})
    .map(([map, count]) => ({ map, count }))
    .sort((a, b) => b.count - a.count);

  const host = document.createElement("div");
  host.innerHTML = `
    <h1>สุขภาพข้อมูลเกม</h1>
    <p class="lede">
      รายการที่ตัว export เจอตอนอ่านไฟล์ของเซิร์ฟ ไม่ใช่บั๊กของเว็บ
      แต่เป็นช่องโหว่ในข้อมูลเกมที่ทำให้ของบางอย่างหาไม่เจอหรือใช้ไม่ได้
    </p>

    <h2>อาชีพที่ HP เป็น 0 ทุกเลเวล (${n(noHp.length)})</h2>
    <p>
      <code>JobHpChart.csv</code> ไม่มีคอลัมน์ของอาชีพเหล่านี้
      ตัวโหลดเติมแถวศูนย์ให้ก่อนแล้วทับเฉพาะคอลัมน์ที่ชื่อตรงกัน อาชีพที่ไม่มีคอลัมน์จึงได้ HP สูงสุด 0
    </p>
    <div class="chiprow">${noHp
      .map((j) => link(`#/job/${j.name}`, j.name, "chip mvp"))
      .join("")}</div>
    <p class="lede">
      สองตัวที่แก้ได้ทันทีคือ <code>Star Gladiator</code> กับ <code>Soul Linker</code> —
      ใน <code>JobHpChart.csv</code> เขียนหัวคอลัมน์ว่า <code>Star</code> และ <code>Linker</code>
      แต่ <code>Jobs.csv</code> เขียนแบบมีเว้นวรรค ชื่อจึงไม่ตรงกัน ส่วน SuperNovice ไม่มีคอลัมน์เลย
    </p>

    <h2>อาชีพที่ยังไม่มีผังสกิล (${n(noTree.length)})</h2>
    <div class="chiprow">${noTree
      .map((j) => link(`#/job/${j.name}`, j.name, "chip warn"))
      .join("")}</div>

    <h2>มอนที่ยังไม่มีที่เกิด (${n(noSpawn.length)})</h2>
    <p>
      มีข้อมูลใน <code>Monsters.csv</code> แต่ไม่มีแมพไหนเกิดมัน
      และไม่มีสคริปต์หรือโค้ดไหนเรียกมันด้วย
    </p>
    <div class="chiprow">${noSpawn
      .map((m) => link(`#/monster/${m.code}`, m.name, "chip warn"))
      .join("")}</div>

    <h2>มอนที่ไม่เกิดตามแมพ แต่ถูกเรียกออกมา (${n(summoned.length)})</h2>
    <p>
      ไม่ได้หายไปไหน แค่มาจากทางอื่น — สกิลของมอนตัวอื่นเรียก บอสของอีเวนต์
      หรือโค้ดวางให้ตอนเซิร์ฟเปิด (เช่น Antonio มาจาก <code>GiftMonsterSpawner.cs</code>)
    </p>
    <div class="chiprow">${summoned
      .map((m) => link(`#/monster/${m.code}`, m.name, "chip mute"))
      .join("")}</div>

    <h2>แมพที่มีสคริปต์เกิดมอนแต่ไม่มีใน Maps.csv (${n(unreachable.length)})</h2>
    <p>
      สคริปต์ใน <code>Script/Spawns/</code> เขียนไว้ครบ แต่แมพไม่ได้ลงทะเบียนไว้ใน
      <code>Maps.csv</code> ทั้งบล็อกจึงไม่ทำงาน มอนในนั้นไม่เกิด
      รวมแล้วเป็นมอนที่หายไป ${n(unreachable.reduce((s, u) => s + u.count, 0))} ตัว
    </p>
    <div class="tablewrap" style="max-height:340px;overflow-y:auto">
      <table><thead><tr><th>รหัสแมพ</th><th class="num">มอนที่จะเกิดถ้าเปิดแมพ</th></tr></thead>
        <tbody>${unreachable
          .map((u) => `<tr><td class="mono">${esc(u.map)}</td><td class="num">${n(u.count)}</td></tr>`)
          .join("")}</tbody></table>
    </div>

    <h2>ไอเท็มที่ไม่มีอาชีพไหนใส่ได้ (${n(badGroup.length)})</h2>
    <p>
      ไอเท็มระบุกลุ่มอาชีพที่ไม่มีอยู่ใน <code>EquipmentGroups.csv</code>
      ตัวโหลดหาไม่เจอ ต่อให้ดรอปได้ก็ใส่ไม่ได้ ปัญหาอยู่ที่ชื่อกลุ่ม ${n(byGroup.size)} ชื่อ
    </p>
    <div class="tablewrap">
      <table><thead><tr><th>ชื่อกลุ่มที่ไม่มีจริง</th><th class="num">ไอเท็มที่ติด</th><th>ตัวอย่าง</th></tr></thead>
        <tbody>${[...byGroup.entries()]
          .sort((a, b) => b[1].length - a[1].length)
          .map(
            ([g, list]) =>
              `<tr><td class="mono">${esc(g)}</td><td class="num">${n(list.length)}</td>
               <td>${list.slice(0, 5).map((i) => itemLink(i)).join(", ")}${list.length > 5 ? " …" : ""}</td></tr>`
          )
          .join("")}</tbody></table>
    </div>

    <h2>ไอเท็มที่ยังไม่มีทางได้มา (${n(noSource.length)})</h2>
    <p>
      ไม่มีมอนดรอป ไม่มีร้าน NPC ขาย เหลือแค่คำสั่ง GM กล่องสุ่ม หรือ NPC ที่แจกด้วยสคริปต์เฉพาะกิจ
      ตัวเลขนี้สูงเป็นปกติสำหรับเซิร์ฟที่ยังเปิดแมพไม่ครบ
    </p>
    <p>${link("#/items?type=", "ดูในหน้าไอเท็ม")} แล้วเลือกตัวกรอง "หาได้จาก: ยังไม่มีทางได้"</p>

    <h2>สกิลที่ไม่อยู่ในผังอาชีพไหนเลย (${n(orphanSkills.length)})</h2>
    <p>ส่วนใหญ่เป็นสกิลของมอนสเตอร์ ของไอเท็ม หรือของอาชีพที่ยังไม่ได้ทำผัง — ไม่ใช่ปัญหาเสมอไป</p>

    <h2>แมพที่ว่างเปล่า (${n(emptyMaps.length)})</h2>
    <p>ไม่มีทั้งมอนและ NPC ส่วนมากเป็นแมพในอาคารหรือแมพที่ยังไม่ได้ใส่เนื้อหา</p>

    <div class="note">
      <p><strong>เช็คเองได้</strong></p>
      <p>
        รัน <code>python3 tools/webdata/verify.py</code> จะเทียบ JSON กับไฟล์ต้นทางให้ทั้งหมด
        และรายงานตัวเลขที่ไม่ตรงกัน
      </p>
    </div>
  `;
  return host;
}
