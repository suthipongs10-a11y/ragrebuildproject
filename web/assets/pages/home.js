import { data, esc, n } from "../app.js";

export async function render() {
  const meta = await data("meta");
  const c = meta.counts;

  const cards = [
    ["#/guide/start", "เริ่มต้นเล่น", "สร้างตัว เลือกอาชีพ หาที่เก็บเลเวล และสิ่งที่ควรรู้ก่อนออกเดินทาง"],
    ["#/monsters", "มอนสเตอร์", `${n(c.monsters)} ตัว พร้อมสเตตัสเต็ม ธาตุ ที่เกิด และตารางดรอปตามอัตราจริง`],
    ["#/items", "ไอเท็ม", `${n(c.items)} ชิ้น ทั้งอาวุธ เกราะ การ์ด ของใช้ พร้อมผลจริงจากสคริปต์`],
    ["#/maps", "แมพ", `${n(c.maps)} แมพ บอกจำนวนมอนแต่ละตัว NPC และทางเชื่อม`],
    ["#/jobs", "อาชีพ", "ตาราง HP/SP โบนัสสเตตัสตาม Job Level และผังสกิลของทุกอาชีพ"],
    ["#/skills", "สกิล", `${n(c.skills)} สกิล พร้อมค่าตัวเลขทุกเลเวล`],
    ["#/guide/combat", "สูตรคำนวณการต่อสู้", "ดาเมจ ธาตุ DEF ซอฟต์ดีเฟนส์ คริติคอล — ตัวเลขจริงจากโค้ดเซิร์ฟ"],
    ["#/guide/systems", "ระบบพิเศษของเซิร์ฟ", "สมุดผจญภัย สมุดบอส ล่าค่าหัว ตลาดกลาง เพื่อน ตีบวก คราฟ ขุดแร่"],
  ];

  return `
    <h1>คู่มือเซิร์ฟเวอร์ Ragnarok Rebuild</h1>
    <p class="lede">
      ข้อมูลทุกอย่างในหน้านี้ดึงตรงจากไฟล์ชุดเดียวกับที่เซิร์ฟเวอร์โหลดตอนเปิด
      ไม่ได้พิมพ์ตามความจำ ไม่ได้เอามาจากเซิร์ฟอื่น
    </p>

    <div class="grid grid-wide">
      ${cards
        .map(
          ([href, title, sub]) => `
        <a class="tile" href="${href}">
          <strong>${esc(title)}</strong>
          <small>${esc(sub)}</small>
        </a>`
        )
        .join("")}
    </div>

    <h2>ตัวเลขในเซิร์ฟตอนนี้</h2>
    <div class="tablewrap">
      <table>
        <tbody>
          <tr><td>มอนสเตอร์ที่มีข้อมูล</td><td class="num">${n(c.monsters)}</td></tr>
          <tr><td>ไอเท็มทั้งหมด</td><td class="num">${n(c.items)}</td></tr>
          <tr><td>แมพที่เปิดใช้</td><td class="num">${n(c.maps)}</td></tr>
          <tr><td>แมพที่มีมอนเกิด</td><td class="num">${n(c.mapsWithSpawns)}</td></tr>
          <tr><td>จำนวนมอนที่เกิดพร้อมกันทั้งเซิร์ฟ</td><td class="num">${n(c.totalSpawnedMonsters)}</td></tr>
          <tr><td>NPC</td><td class="num">${n(c.npcs)}</td></tr>
          <tr><td>ร้านค้า</td><td class="num">${n(c.shops)}</td></tr>
          <tr><td>ทางเชื่อมระหว่างแมพ</td><td class="num">${n(c.warps)}</td></tr>
          <tr><td>สกิล</td><td class="num">${n(c.skills)}</td></tr>
          <tr><td>สถานะผิดปกติ</td><td class="num">${n(c.statusEffects)}</td></tr>
        </tbody>
      </table>
    </div>

    <div class="note warn">
      <p><strong>อัตราดรอปที่แสดงคืออัตราจริง</strong></p>
      <p>
        <code>appsettings.json</code> เปิด <code>RemapDropRates</code> ไว้ ตัวเลขใน
        <code>DropData.csv</code> จึงไม่ใช่ตัวเลขที่ใช้จริง เว็บนี้คำนวณผ่านสูตรเดียวกับ
        <code>Script/Config/ItemDropAndValueAdjustments.txt</code> แล้ว
        เช่นการ์ดที่เขียนไว้ 0.10% จริง ๆ ดรอปที่ 1.21%
      </p>
    </div>

    <div class="note bad">
      <p><strong>มอน ${n(c.monstersWithoutSpawns)} ตัวยังไม่มีที่เกิด</strong></p>
      <p>
        มีสคริปต์เกิดมอนอยู่ ${n(c.unreachableSpawnMaps)} แมพที่ไม่มีชื่อใน <code>Maps.csv</code>
        แมพพวกนั้นไม่มีอยู่จริงในเซิร์ฟ มอนในนั้นจึงไม่เกิด
        หน้ามอนสเตอร์จะติดป้ายกำกับให้เห็นชัด จะได้ไม่ตามหาของที่ยังไม่มี
      </p>
    </div>

    <h2>ใช้เว็บนี้ยังไง</h2>
    <ul>
      <li>กด <kbd>/</kbd> เพื่อกระโดดไปช่องค้นหาได้ทุกเมื่อ พิมพ์ได้ทั้งชื่อไทย ชื่ออังกฤษ และรหัส</li>
      <li>ตารางทุกอันคลิกหัวคอลัมน์เพื่อเรียงได้</li>
      <li>หน้าไอเท็มบอกว่ามอนตัวไหนดรอป และ NPC ร้านไหนขาย</li>
      <li>หน้ามอนบอกว่าเกิดที่แมพไหน แมพละกี่ตัว</li>
    </ul>

    <p class="lede" style="margin-top:26px">ข้อมูลชุดนี้สร้างเมื่อ ${esc(meta.generated)}</p>
  `;
}
