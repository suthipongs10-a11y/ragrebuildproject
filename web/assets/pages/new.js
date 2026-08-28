import { data, index, esc, n, link, itemLink, monsterLink } from "../app.js";

/**
 * Everything this fork added on top of Doddler/RagnarokRebuildTcp, with the
 * numbers pulled from the exported data rather than written down by hand - so a
 * change to a system shows up here on the next export.
 */
export async function render() {
  const [meta, custom, ref, byId, mons, monsters, items] = await Promise.all([
    data("meta"), data("custom"), data("reference"),
    index("itemsById"), index("monstersByCode"), data("monsters"), data("items"),
  ]);
  const ab = custom.adventureBook;
  const bl = custom.bossLog;

  const antonio = mons.get("ANTONIO");
  const oreTotal = ref.oreDiscovery.reduce((s, o) => s + o.rate, 0);

  const regionHats = ab.regions.map((r) => byId.get(r.headgear)).filter(Boolean);

  return `
    <h1>ข้อมูลที่ควรรู้</h1>
    <p class="lede">
      สิ่งที่เซิร์ฟนี้มีแต่เซิร์ฟต้นทาง <code>Doddler/RagnarokRebuildTcp</code> ไม่มี
      อ่านหน้านี้ก่อนแล้วจะไม่งงว่าทำไมหลายอย่างไม่เหมือนที่เคยเล่นมา
      ตัวเลขทุกตัวดึงจากข้อมูลจริง ไม่ได้พิมพ์ไว้ตายตัว
    </p>

    <h2>ระบบที่เพิ่มเข้ามา</h2>
    <div class="grid grid-wide">
      ${systemTile("#/adventurebook", "สมุดผจญภัย",
        `${n(ab.pages.length)} หน้า ${n(ab.totalStars)} ดาว ${n(ab.regions.length)} ภูมิภาค`,
        "สะสมดาวเพื่อขึ้นแรงก์ 1–10 ได้โบนัสสเตตัส ดรอป EXP และโอกาสตีบวกถาวร")}
      ${systemTile("#/adventurebook/bosslog", "สมุดบอส",
        `MVP ${n(bl.mvpCount)} · มินิบอส ${n(bl.bossCount)}`,
        "เจอครบทุกตัวได้หมวก Hat of the Sun God แบบไม่ต้องลุ้น")}
      ${systemTile("#/guide/systems", "ตลาดกลางและการประมูล",
        "ค่าตั้งขาย 1% · หักตอนขาย 3% · ตั้งรับซื้อ 5%",
        "ประมูลกันได้ ตั้งรับซื้อล่วงหน้าได้ มีกล่องรับของ คนละ 1 รายการเพื่อไม่ให้ใครยึดหน้าแรก")}
      ${systemTile("#/guide/systems", "เปลี่ยนอาชีพ 1 ได้ไม่จำกัด",
        "รีเซ็ตสเตตัสกับสกิล · เลเวลไม่ลด",
        "ตราบใดที่ยังไม่ขึ้นอาชีพ 2 จะสลับสายกี่รอบก็ได้ แต่พอขึ้นอาชีพ 2 แล้วอาชีพจะถูกล็อคถาวร")}
      ${systemTile("#/guide/systems", "ร้านค้า Offline",
        "ตั้งได้ 2 วัน · ไม่มีค่าธรรมเนียม",
        "ตั้งร้านแล้วกดปุ่มใต้กรอบร้านเพื่อออกจากเกม ตัวละครยังยืนขายอยู่ที่เดิม คนอื่นเดินมาซื้อได้")}
      ${systemTile("#/guide/systems", "ระบบเพื่อนและแชทส่วนตัว",
        "จำได้สูงสุด 60 คน",
        "คลิกขวาจดจำเพื่อน เห็นอาชีพ เลเวล กิลด์ สถานะออนไลน์ และคุยส่วนตัวได้")}
      ${systemTile("#/recipes", "คราฟและขุดแร่",
        `${n(ref.recipes.length)} สูตร · ตารางแร่ ${n(ref.oreDiscovery.length)} ชนิด`,
        "ตีอาวุธธาตุ คราฟหมวก คราฟอาวุธระดับสูง ปลดล็อกทีละอย่างตามความคืบหน้าของเซิร์ฟ")}
      ${systemTile("#/guide/systems", "เหตุการณ์สำคัญของเซิร์ฟ",
        "11 ขั้น",
        "NPC ที่ค่ายใต้ Prontera เพิ่มขึ้นตามความคืบหน้าของทั้งเซิร์ฟ ไม่ใช่ของเราคนเดียว")}
      ${systemTile(antonio ? `#/monster/${antonio.code}` : "#/guide/systems", "Antonio ซานต้าประจำแมพ",
        "ทุกแมพที่มีมอน",
        "ไม่โจมตี เลือดน้อย ดรอป Gift Box ตายแล้วเกิดใหม่ที่อื่นในแมพเดิม")}
      ${systemTile("#/guide/combat", "ประกาศและสถิติของเซิร์ฟ",
        "บันทึกคนแรกที่ฆ่า MVP แต่ละตัว",
        "MVP ที่ถูกฆ่าครั้งแรกจะขึ้นกระดานที่ prt_fild08 และแจกโบนัสให้ทุกคนที่ออนไลน์")}
    </div>

    <h2>ของที่มีเฉพาะในเซิร์ฟนี้</h2>
    <p class="lede">
      หมวกประจำภูมิภาค ${n(regionHats.length)} ใบ — หาจากทางอื่นไม่ได้เลย
      ไม่ดรอป ไม่มีร้านขาย ไม่อยู่ในกล่อง ต้องเก็บสมุดผจญภัยให้ครบภูมิภาคนั้นอย่างเดียว
    </p>
    <div class="tablewrap"><table>
      <thead><tr><th>ภูมิภาค</th><th>หมวก</th><th class="num">DEF</th><th class="num">รู</th><th class="num">Lv ขั้นต่ำ</th></tr></thead>
      <tbody>${ab.regions
        .map((r) => {
          const hat = byId.get(r.headgear);
          return `<tr><td>${esc(r.name)}</td><td class="name">${itemLink(hat)}</td>
            <td class="num">${hat?.defense ?? ""}</td>
            <td class="num">${hat?.slots || ""}</td>
            <td class="num">${hat?.minLevel || "-"}</td></tr>`;
        })
        .join("")}</tbody>
    </table></div>

    <h2>รางวัลใหญ่ที่ปลายทาง</h2>
    <div class="tablewrap"><table>
      <thead><tr><th>ได้จาก</th><th>ของ</th></tr></thead>
      <tbody>
        <tr><td>สมุดผจญภัยแรงก์ 10 (${n(ab.ranks[9].stars)} ดาว + ครบทุกภูมิภาค)</td>
          <td>${ab.ranks[9].rewards.map((r) => `${itemLink(byId.get(r.id))}${r.count > 1 ? ` ×${r.count}` : ""}`).join(", ")}</td></tr>
        <tr><td>สมุดบอสครบทั้งเล่ม</td><td>${itemLink(byId.get(bl.clearReward))}</td></tr>
        <tr><td>กล่อง MVP เท่านั้น</td><td>${itemLink(byId.get(bl.crownedHat))} (แบบมีรู)</td></tr>
      </tbody>
    </table></div>

    <h2>ข้อมูลเกมที่แก้จากต้นทาง</h2>
    <div class="tablewrap"><table>
      <thead><tr><th>แก้อะไร</th><th>ผลที่เกิด</th></tr></thead>
      <tbody>
        <tr><td><strong>Job Level สูงสุดของอาชีพขั้น 2 ลดจาก 70 เหลือ 50</strong></td>
          <td>แต้มสกิลน้อยลง 20 แต้ม ต้องเลือกสายมากขึ้น (${link("#/jobs", "ดูตารางอาชีพ")})</td></tr>
        <tr><td><strong>เปิดหมวกรางวัลให้ทุกอาชีพใส่ได้</strong></td>
          <td>เดิมหลายใบจำกัดอาชีพ เช่น <code>Coif_</code> เฉพาะ Priest/Assassin
            ถ้าไม่แก้ คนที่เก็บครบจะใส่ของรางวัลไม่ได้</td></tr>
        ${meta.remapDropRates ? `
        <tr><td><strong>เปิด <code>RemapDropRates</code></strong></td>
          <td>ของหายากถูกดันขึ้นแรงกว่าของธรรมดามาก การ์ด 0.10% กลายเป็น 1.21%</td></tr>` : `
        <tr><td><strong>ปิด <code>RemapDropRates</code></strong></td>
          <td>ต้นทางเปิดไว้ ของหายากเลยถูกดันขึ้นถึง 12 เท่า เราปิด อัตราดรอปจึงเป็น
            ตัวเลขดิบใน <code>DropData.csv</code> ตรง ๆ การ์ดอยู่ที่ 0.10% ทุกใบ
            และสกิล Steal ซึ่งคิดจากอัตราดรอปโดยตรงก็ลดตามไปด้วย</td></tr>`}
        <tr><td><strong>ของประเภท Etc ขายได้ 2 เท่า อาวุธซื้อแพงขึ้น 50%</strong></td>
          <td>เก็บของขายพอเลี้ยงตัวได้ตั้งแต่ต้นเกม</td></tr>
        <tr><td><strong>เพิ่มไฟล์ใหม่ 3 ไฟล์</strong></td>
          <td><code>ProduceRecipes.csv</code> ${n(ref.recipes.length)} สูตร ·
            <code>OreDiscovery.csv</code> ${n(ref.oreDiscovery.length)} แร่ (น้ำหนักรวม ${n(oreTotal)}) ·
            <code>ForgeStones.csv</code></td></tr>
        <tr><td><strong>เพิ่มมอนใหม่ 1 ตัว</strong></td>
          <td>${antonio ? monsterLink(antonio) : "Antonio"} — วางด้วยโค้ด ไม่ใช่สคริปต์เกิดมอน</td></tr>
        <tr><td><strong>เปิด <code>RestrictMonsterSkillsToBosses</code></strong></td>
          <td>มอนธรรมดาไม่ร่ายสกิลเลย เหลือแต่ MVP และตัวที่ติดธง Boss (ตรงกับ Episode 4)</td></tr>
        <tr><td><strong>แปลคำอธิบายเป็นภาษาไทย</strong></td>
          <td>คำอธิบายไอเท็ม ${n(items.filter((i) => i.desc).length)} ชิ้น
            และคำอธิบายสกิล/สถานะอีกหลายร้อยรายการ</td></tr>
      </tbody>
    </table></div>

    <h2>ฝั่งไคลเอนต์</h2>
    <ul>
      <li><strong>เมนูปรับกราฟิกสำหรับมือถือ</strong> — 4 พรีเซ็ต บวกปรับ render scale เงา HDR
        น้ำ เอฟเฟกต์แมพ ผู้เล่นคนอื่น การจำกัดเฟรม และตัวนับ FPS</li>
      <li><strong>ธีม UI ใหม่ทั้งเกม</strong> — แถบหัวสี <code>#0772A8</code> ตัวหนังสือขาว
        พื้นหลัง <code>#EDF6FA</code> ตัวหนังสือดำ ทุกคู่สีผ่านเกณฑ์ความคมชัด</li>
      <li><strong>หน้าต่างใหม่</strong> — สมุดผจญภัย ตลาด คราฟ เพื่อนและแชทส่วนตัว
        รายชื่อคนรอบข้างสำหรับมือถือ ตั้งค่ากราฟิก</li>
      <li><strong>หน้าเลือกตัวละครและหน้าล็อกอินใหม่</strong></li>
    </ul>

    <div class="note">
      <p><strong>ระบบที่ยังไม่เสร็จ</strong></p>
      <p>
        Bounty System มีไฟล์แล้วแต่ฟังก์ชันยังว่างและไม่ได้เปิดใน <code>ActiveEvents</code> ·
        กิลด์และ WoE ยังไม่ได้เขียน · อาชีพ ${n(meta.counts.jobs - 13 - 3)} อาชีพยังไม่มีผังสกิล
        (${link("#/health", "ดูรายการเต็มที่หน้าสุขภาพข้อมูล")})
      </p>
    </div>
  `;
}

function systemTile(href, title, stat, note) {
  return `
    <a class="tile" href="${href}">
      <strong>${esc(title)}</strong>
      <small>${esc(stat)}</small>
      <small style="display:block;margin-top:6px">${esc(note)}</small>
    </a>`;
}
