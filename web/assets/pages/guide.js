import { data, esc, n, link } from "../app.js";
import { ELEMENT_TH, splitElement } from "./monsters.js";

export async function render({ rest }) {
  const which = rest[0] ?? "start";
  const page = PAGES[which];
  if (!page) return `<h1>ไม่พบหน้านี้</h1><p>ลองกลับไป${link("#/", "หน้าแรก")}</p>`;
  return page();
}

const PAGES = { start, combat, systems, elements };

// -------------------------------------------------------------------- เริ่ม

async function start() {
  const meta = await data("meta");
  return `
    <h1>เริ่มต้นเล่น</h1>
    <p class="lede">อ่านหน้านี้จบแล้วจะรู้ว่าเซิร์ฟนี้ต่างจากที่อื่นตรงไหน และควรทำอะไรก่อน</p>

    <h2>เซิร์ฟนี้คืออะไร</h2>
    <p>
      เขียนใหม่ทั้ง client และ server ด้วย C# ไม่ใช่ rAthena ไม่ใช่ Hercules
      สูตรและตัวเลขหลายอย่างจึงไม่เหมือนเซิร์ฟทั่วไป อย่าเอาความรู้จากเซิร์ฟอื่นมาใช้ตรง ๆ
      ทุกตัวเลขในเว็บนี้อ่านจากไฟล์ของเซิร์ฟเอง
    </p>
    <p>เนื้อหาเล็งไว้ที่ Episode 4 (pre-renewal) ตอนนี้เปิด ${n(meta.counts.maps)} แมพ
    มีมอน ${n(meta.counts.monsters)} ตัว</p>

    <h2>ตัวละครและอาชีพ</h2>
    <ul>
      <li>เริ่มที่ Novice — ต้องอัป <strong>Basic Mastery</strong> ให้เต็ม 8 และ Job Level ถึง 10 ก่อนถึงจะเปลี่ยนอาชีพได้</li>
      <li>Basic Mastery ปลดล็อกความสามารถทีละอย่างตามเลเวลสกิล เช่น Lv2 นั่งได้ Lv4 เข้าปาร์ตี้ได้ Lv5 ใช้คลัง Kafra ได้</li>
      <li>อาชีพขั้น 2 ที่มีผังสกิลครบแล้วมี 6 สาย: Knight, Wizard, Priest, Hunter, Assassin, Blacksmith
        (${link("#/jobs", "ดูรายการทั้งหมด")})</li>
      <li>อาชีพอื่นเปลี่ยนไปได้แต่ยังลงสกิลไม่ได้ เพราะยังไม่มีผังสกิลในไฟล์</li>
      <li><strong>อาชีพ 1 เปลี่ยนได้ไม่จำกัด</strong> ตราบใดที่ยังไม่ขึ้นอาชีพ 2 —
        คุยกับ Class Master ที่ <code>prt_fild08</code> ${link("#/guide/systems", "อ่านกติกาเต็ม")}</li>
    </ul>

    <div class="note warn">
      <p><strong>เปลี่ยนเป็นขั้น 2 แล้วปุ่มลงสกิลกดไม่ได้ ไม่ใช่บั๊ก</strong></p>
      <p>
        เซิร์ฟบังคับว่าต้องใช้แต้มสกิลไปแล้วเท่ากับแต้มสูงสุดของอาชีพก่อนหน้าทั้งสาย
        Knight/Wizard/Priest ฯลฯ ต้องใช้ไปแล้ว <strong>58 แต้ม</strong>
        (Novice 9 + อาชีพขั้น 1 อีก 49) ถ้ายังไม่ครบ ปุ่มจะยังกดไม่ได้แม้เงื่อนไขสกิลจะผ่านแล้ว
        ดูตัวเลขของแต่ละอาชีพได้ในหน้าอาชีพ
      </p>
    </div>

    <h2>สเตตัส</h2>
    <ul>
      <li><strong>VIT</strong> เพิ่ม HP โดยตรง — <code>HP = ฐานตามอาชีพ × (1 + VIT/100)</code> VIT 100 = HP สองเท่า
        และยังหักดาเมจแบบ soft defense อีกชั้น</li>
      <li><strong>INT</strong> เพิ่ม SP ด้วยสูตรเดียวกัน และหักดาเมจเวทย์</li>
      <li><strong>AGI</strong> เพิ่ม Flee — <code>Flee = Base Level + AGI + โบนัส</code></li>
      <li><strong>DEX</strong> เพิ่ม Hit — <code>Hit = Base Level + DEX + โบนัส</code></li>
      <li><strong>LUK</strong> เพิ่มคริติคอล — <code>Crit = (1 + LUK/3 + โบนัส) × 10 + Level/5</code> ต่อพัน</li>
      <li>Job Level ยังแจกสเตตัสฟรีตามอาชีพด้วย ดูตารางในหน้าอาชีพแต่ละอัน</li>
    </ul>

    <h2>ควรไปเก็บเลเวลที่ไหน</h2>
    <p>
      ใช้หน้า${link("#/maps", "แมพ")} กรองด้วย "มีมอน" แล้วเรียงตาม "มอนทั้งหมด"
      แต่ละแมพบอกช่วงเลเวลของมอนในนั้นให้ด้วย จุดเกิดตัวละครอยู่ที่
      ${link("#/map/prt_fild08", "Prontera Field 8")} ซึ่งเป็นค่ายหลักของเซิร์ฟ
    </p>

    <h2>สิ่งที่ต่างจากเซิร์ฟอื่น (อ่านก่อนงง)</h2>
    <ul>
      <li><strong>อัตราดรอปถูกปรับขึ้นแล้ว</strong> ของหายากถูกดันขึ้นแรงกว่าของธรรมดามาก
        การ์ดที่ตารางเขียน 0.10% จริง ๆ ดรอปที่ 1.21% — เว็บนี้แสดงตัวเลขจริงให้แล้ว</li>
      <li><strong>มอนธรรมดาไม่ใช้สกิล</strong> <code>RestrictMonsterSkillsToBosses</code> เปิดอยู่
        มีแต่ MVP กับตัวที่ติดธง Boss ตอนเกิดเท่านั้นที่ร่ายสกิล</li>
      <li><strong>มอนตีเป็นธาตุไร้ธาตุเสมอ</strong> ไม่ว่าตัวมันจะธาตุอะไร เกราะกันธาตุจึงต้องกัน Neutral</li>
      <li><strong>บอสเกิดใหม่เร็ว</strong> มินิบอส 6 นาที MVP 14–15 นาที ไม่ใช่ชั่วโมงละครั้ง
        (${link("#/bosses", "ดูตาราง")})</li>
      <li><strong>มี Antonio (ซานต้า) แจกของทุกแมพที่มีมอน</strong> ไม่โจมตี เลือดน้อย ตายแล้วเกิดใหม่ที่อื่นในแมพเดิม
        ดรอป Gift Box และมีโอกาสน้อย ๆ ได้ Snake Head</li>
      <li><strong>ของประเภท Etc ขายได้แพงขึ้น 2 เท่า</strong> และอาวุธซื้อจาก NPC แพงขึ้น 50%</li>
      <li><strong>ไม่มีระบบกิลด์และ WoE</strong> ยังไม่ได้เขียน</li>
    </ul>

    <h2>อ่านต่อ</h2>
    <ul>
      <li>${link("#/guide/combat", "สูตรคำนวณการต่อสู้")} — จะรู้ว่า DEF จริง ๆ ลดดาเมจเท่าไหร่</li>
      <li>${link("#/guide/systems", "ระบบพิเศษของเซิร์ฟ")} — สมุดผจญภัย สมุดบอส ตลาดกลาง คราฟ</li>
      <li>${link("#/guide/elements", "ตารางธาตุ")} — ตีอะไรด้วยธาตุอะไร</li>
    </ul>
  `;
}

// -------------------------------------------------------------------- ต่อสู้

async function combat() {
  return `
    <h1>สูตรคำนวณการต่อสู้</h1>
    <p class="lede">
      ทุกสูตรในหน้านี้อ่านจาก <code>CombatEntity.DamageHandling.cs</code>,
      <code>CombatEntity.cs</code> และ <code>MathHelper.cs</code> โดยตรง
      ไม่ใช่สูตรของ rAthena
    </p>

    <h2>ลำดับการคำนวณดาเมจกายภาพ</h2>
    <pre><code>damage = ( (baseDamage + addDamage) × attackMultiplier × defCut
          - subDef + addFinalDamage )
        × eleMod/100 × racialMod/100 × rangeMod/100
        × sizeMod/100 × specialMod/100</code></pre>
    <ul>
      <li><code>baseDamage</code> — สุ่มระหว่าง ATK ต่ำสุดกับสูงสุด (คริติคอลจะได้ค่าสูงสุดเสมอ)</li>
      <li><code>attackMultiplier</code> — ตัวคูณของสกิล เช่น Bash Lv10 = 4.0, Bowling Bash Lv10 = 5.0</li>
      <li><code>defCut</code> — ตัวคูณจาก DEF ของเกราะ (ดูหัวข้อถัดไป)</li>
      <li><code>subDef</code> — ค่าลบตรง ๆ จาก VIT</li>
      <li>ตัวคูณท้าย 5 ตัวคูณกันทั้งหมด ไม่ได้บวกกัน — การ์ดกันธาตุกับการ์ดกันเผ่าจึงทบกันแบบคูณ</li>
    </ul>

    <h2>DEF ลดดาเมจเท่าไหร่จริง ๆ</h2>
    <p>
      <code>defCut = DefTable[DEF × 10 + ระดับตีบวกรวม × 7]</code> โดยตารางเป็นแบบนี้:
      ถึง DEF 30 คือ 1 DEF = ลด 1% ตรง ๆ จากนั้นเริ่มลดหลั่น
      <code>0.99^(DEF − 30) − 0.3</code>
    </p>
    <div class="tablewrap"><table>
      <thead><tr><th class="num">DEF</th><th class="num">ดาเมจที่เหลือ</th><th class="num">ลดได้</th></tr></thead>
      <tbody>${[10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 150]
        .map((d) => {
          const cut = d < 30 ? 1 - (d * 10) / 1000 : Math.max(0.1, 0.99 ** (d - 30) - 0.3);
          return `<tr><td class="num">${d}</td><td class="num">${(cut * 100).toFixed(1)}%</td>
            <td class="num">${((1 - cut) * 100).toFixed(1)}%</td></tr>`;
        })
        .join("")}</tbody>
    </table></div>
    <div class="note warn">
      <p><strong>DEF ตั้งแต่ 200 ขึ้นไป = ภูมิคุ้มกันดาเมจกายภาพ</strong></p>
      <p>โค้ดตั้ง <code>subDef = 999999</code> ทันที ดาเมจกายภาพจะเหลือ 0 เสมอ</p>
    </div>
    <div class="note">
      <p><strong>ระดับตีบวกถูกนับสองรอบ (เฉพาะผู้เล่น)</strong></p>
      <p>
        <code>GetEffectiveStat(Def)</code> บวก <code>EquipmentRefineDef</code> เข้าไปใน DEF อยู่แล้ว
        แล้ว <code>DefValueLookup</code> ยังบวกซ้ำอีกคูณ 7
        ผลคือ 1 ระดับตีบวก = DEF 1.7 หน่วย ตีบวกเกราะจึงคุ้มกว่าที่ตัวเลขบนไอเท็มบอก
      </p>
    </div>

    <h2>VIT หักดาเมจแบบตรง ๆ (soft defense)</h2>
    <p>สูตรของผู้เล่นเป็นสูตรทางการ ซึ่งดูแปลกแต่ถูกแล้ว:</p>
    <pre><code>vit30 = 3 × VIT / 10
vitRng = VIT² / 150 − vit30        (ต่ำสุด 1)
subDef = vit30 + rand(0, vitRng) + VIT / 2</code></pre>
    <p>ของมอนสเตอร์ใช้อีกสูตร: <code>subDef = VIT + rand(0, (VIT/20)²)</code></p>
    <div class="tablewrap"><table>
      <thead><tr><th class="num">VIT</th><th class="num">หักดาเมจได้ (เฉลี่ย)</th></tr></thead>
      <tbody>${[20, 40, 60, 80, 100, 120]
        .map((v) => {
          const v30 = Math.floor((3 * v) / 10);
          const rng = Math.max(1, Math.floor((v * v) / 150) - v30);
          const avg = v30 + rng / 2 + Math.floor(v / 2);
          return `<tr><td class="num">${v}</td><td class="num">${avg.toFixed(0)}</td></tr>`;
        })
        .join("")}</tbody>
    </table></div>

    <h2>ธาตุ</h2>
    <ul>
      <li><strong>มอนสเตอร์ตีเป็นธาตุ Neutral เสมอ</strong> มีแต่ผู้เล่นที่อ่านธาตุจากอาวุธ
        การใส่เกราะกันธาตุไฟเพื่อสู้มอนธาตุไฟจึงไม่ช่วยอะไรเลย</li>
      <li>ธนูใช้ธาตุของลูกศรแทนธาตุคันธนู ถ้าลูกศรไม่ใช่ Neutral</li>
      <li><strong>Elemental Converter ทับธาตุติดตัวของอาวุธได้</strong> ใช้กับอาวุธที่มีธาตุอยู่แล้วก็ได้
        (โค้ดเช็ค <code>EndowAttackElement</code> เป็นตัวสุดท้าย)</li>
      <li>เกราะธาตุผี (Ghostring) <strong>ไม่ช่วยกันมอน</strong> เพราะโค้ดส่ง <code>ignoreGhostArmor</code>
        เมื่อผู้โจมตีเป็นมอนสเตอร์และเป้าหมายเป็นผู้เล่น</li>
      <li>ดูตัวเลขทั้งหมดได้ที่${link("#/guide/elements", "ตารางธาตุ")}</li>
    </ul>

    <h2>ระยะไกลหรือระยะประชิด</h2>
    <p>เกณฑ์ไม่เหมือนกันระหว่างการตีปกติกับสกิล:</p>
    <ul>
      <li><strong>ตีปกติ</strong> — นับเป็นระยะไกลถ้า <code>Range ≥ 4</code></li>
      <li><strong>ใช้สกิล</strong> — นับเป็นระยะไกลถ้าระยะห่างจริงตอนนั้น <code>≥ 4</code> ช่อง</li>
    </ul>
    <p>การ์ดกันระยะไกล (Horn Card +35%) จึงกันมอนที่ Range 4 ขึ้นไปได้ แต่กันมอน Range 1–3 ไม่ได้</p>

    <h2>ความแม่นยำและการหลบ</h2>
    <pre><code>Hit  = Base Level + DEX + AddHit
Flee = Base Level + AGI + AddFlee
โอกาสเข้า (%) = Hit + 75 − Flee        (ต่ำสุด 5%)</code></pre>
    <div class="note">
      <p><strong>โดนรุมแล้วหลบยากขึ้นและ DEF ลดลง</strong></p>
      <p>ผู้เล่นที่มีมอนตีอยู่เกิน 2 ตัว จะโดนโทษ 1 ขั้นต่อมอน 1 ตัวที่เกินมา
      โทษนี้ลดทั้ง DEF และ subDef ลง 5% ต่อขั้น และเพิ่มโอกาสที่มอนจะตีโดน
      โทษนี้ใช้กับผู้เล่นเท่านั้น มอนไม่โดน</p>
    </div>

    <h2>คริติคอล</h2>
    <pre><code>โอกาสคริ (ต่อ 1000) = (1 + LUK/3 + AddCrit) × 10 + Base Level / 5</code></pre>
    <ul>
      <li>คาตาร์ได้โอกาสคริ <strong>คูณสอง</strong></li>
      <li>คริติคอลใช้ ATK ค่าสูงสุดเสมอ และ<strong>ทะลุ DEF</strong> (ติดธง <code>IgnoreDefense</code>)</li>
      <li>ตีศัตรูที่กำลังหลับ = คริติคอลอัตโนมัติ</li>
      <li>คริติคอลไม่มีทางพลาด</li>
    </ul>

    <h2>HP และ SP</h2>
    <pre><code>MaxHP = ฐานตามอาชีพและเลเวล × (1 + VIT/100) + AddMaxHp
MaxSP = ฐานตามอาชีพและเลเวล × (1 + INT/100) + AddMaxSp</code></pre>
    <p>ดูตารางค่าฐานได้ที่${link("#/charts/hpsp", "ตาราง HP / SP")}</p>

    <h2>อัตราดรอป</h2>
    <ul>
      <li>ทุกอัตราเก็บเป็นหน่วย "ต่อหมื่น" — 10000 = 100%</li>
      <li>โบนัสดรอป (Bubble Gum, แรงก์สมุดผจญภัย, หมอกดันเจี้ยน) ใช้ของ
        <strong>คนที่ทำดาเมจมากที่สุด</strong> ไม่ใช่ของคนที่ฆ่า</li>
      <li>ของที่ดรอปจะสงวนให้คนนั้นก่อน 4 วินาที (บอสให้ 8 วินาที)</li>
      <li><code>GuaranteeMvpDrops</code> เปิดอยู่ — ถ้า MVP ไม่ดรอปอะไรเลย
        จะสุ่มใหม่แบบถ่วงน้ำหนักให้ออกอย่างน้อย 1 ชิ้น</li>
    </ul>
  `;
}

// ------------------------------------------------------------------- ระบบ

async function systems() {
  return `
    <h1>ระบบพิเศษของเซิร์ฟ</h1>
    <p class="lede">ระบบที่เขียนเพิ่มเอง ไม่มีในเซิร์ฟต้นทาง</p>

    <h2>สมุดผจญภัย (Adventure Book)</h2>
    <p>สมุดสะสมที่ให้โบนัสถาวรกับตัวละคร แต่ละหน้าให้ได้สูงสุด 3 ดาว</p>
    <ul>
      <li><strong>ดาว 1</strong> — ล่าให้ครบเป้า เป้าคิดจากจำนวนที่เกิดได้ทั้งโลก
        (<code>ครึ่งหนึ่งของจำนวนที่เกิดได้ ปัดขึ้นทีละ 50 จำกัดที่ 50–500 ตัว</code>)
        มอนที่มีเยอะอย่าง Poring จึงต้องล่ามากกว่ามอนหายาก</li>
      <li><strong>ดาว 2</strong> — ล่าต่ออีกเป็น 3 เท่าของเป้าแรก</li>
      <li><strong>ดาว 3</strong> — ได้การ์ดของหน้านั้น</li>
    </ul>
    <div class="note warn">
      <p><strong>ดาว 3 ต้องได้การ์ดจากการฆ่ามอนเท่านั้น</strong></p>
      <p>ซื้อจากตลาด เทรดมา เปิดจากอัลบั้มการ์ด หรือ GM แจกให้ ไม่นับ
      ระบบเช็คว่าการ์ดหล่นมาจากมอนตัวไหน แล้วเทียบกับรายชื่อมอนของหน้านั้น</p>
    </div>
    <p>
      หนึ่งหน้าคือ "การ์ดหนึ่งใบ" ไม่ใช่ "มอนหนึ่งตัว" ก็อบลินทั้ง 5 ตัวดรอป Goblin Card ใบเดียวกัน
      จึงรวมอยู่หน้าเดียว มอนที่ไม่มีการ์ดจะเป็นหน้าของตัวเองและได้สูงสุด 2 ดาว
    </p>

    <h3>แรงก์นักผจญภัย</h3>
    <p>สะสมดาวแล้วได้แรงก์ 1–10 แต่ละแรงก์ให้โบนัสสะสม (ไม่ใช่บวกทับ)</p>
    <div class="tablewrap"><table>
      <thead><tr><th class="num">แรงก์</th><th class="num">ดาวที่ต้องมี</th><th class="num">สเตตัสทุกตัว</th>
        <th class="num">ดรอป</th><th class="num">EXP</th><th class="num">โอกาสตีบวก</th></tr></thead>
      <tbody>${[30, 90, 175, 280, 390, 490, 580, 650, 700]
        .map((stars, i) => {
          const rank = i + 1;
          const st = Math.min(rank, 3);
          const drop = Math.min(Math.max(rank - 3, 0), 3) * 3;
          const exp = Math.min(Math.max(rank - 6, 0), 3) * 3;
          const ref = Math.min(Math.max(rank - 6, 0), 3) * 2;
          return `<tr><td class="num">${rank}</td><td class="num">${n(stars)}</td>
            <td class="num">+${st}</td><td class="num">+${drop}%</td>
            <td class="num">+${exp}%</td><td class="num">+${ref}%</td></tr>`;
        })
        .join("")}
        <tr><td class="num">10</td><td class="num">700 + ครบทุกภูมิภาค</td>
          <td class="num">+5</td><td class="num">+12%</td><td class="num">+12%</td><td class="num">+8%</td></tr>
      </tbody>
    </table></div>
    <p class="lede">แรงก์ 10 ต้องเก็บครบทุกภูมิภาค ไม่ใช่แค่ครบดาว และให้ชุด Valkyrie เป็นรางวัล</p>

    <h2>สมุดบอส (Boss Log)</h2>
    <ul>
      <li>บันทึกว่าเคยฆ่า MVP และมินิบอสตัวไหนไปแล้วบ้าง อย่างละครั้งเดียวก็นับ</li>
      <li>เก็บครบทั้งเล่ม ได้ <strong>Hat of the Sun God</strong> (แบบไม่มีรู) แน่นอน ไม่ต้องลุ้น</li>
      <li>แบบมีรู (<code>Hat_of_the_Sun_God_</code>) ออกจากกล่อง MVP อย่างเดียว ไม่มีทางอื่น</li>
      <li>ไม่เกี่ยวกับแรงก์นักผจญภัย เป็นคนละระบบ</li>
    </ul>
    <div class="note warn">
      <p><strong>บอสเกิดเร็วกว่าที่คอมเมนต์ในโค้ดบอกมาก</strong></p>
      <p>
        คอมเมนต์ในระบบเขียนว่าบอสเกิดชั่วโมงละครั้ง แต่ค่าที่เซิร์ฟใช้จริงคือ
        <strong>มินิบอส 6 นาที</strong> (โดน <code>MaxSpawnTime</code> ตัด) และ
        <strong>MVP 14–15 นาที</strong> (โดน <code>OnSetMonsterSpawnTime</code> ทับ)
        ${link("#/bosses", "ดูตารางเต็มพร้อมคำอธิบาย")}
      </p>
    </div>

    <h2>ตลาดกลางและการประมูล</h2>
    <div class="tablewrap"><table>
      <tbody>
        <tr><td>ค่าธรรมเนียมตั้งขาย</td><td class="num">1% ของราคาเริ่มต้น (ขั้นต่ำ 10z) จ่ายทันทีไม่ว่าจะขายได้หรือไม่</td></tr>
        <tr><td>หักเมื่อขายได้</td><td class="num">3% ของราคาที่ขายได้</td></tr>
        <tr><td>ระยะเวลาที่เลือกได้</td><td class="num">8 / 24 / 48 ชั่วโมง</td></tr>
        <tr><td>ราคาต่ำสุด</td><td class="num">10z</td></tr>
        <tr><td>ราคาสูงสุด</td><td class="num">1,000,000,000z</td></tr>
        <tr><td>บิดต้องสูงกว่าเดิม</td><td class="num">อย่างน้อย 5% หรือ 1z แล้วแต่ว่าอันไหนมากกว่า</td></tr>
        <tr><td>ตั้งขายได้พร้อมกัน</td><td class="num">1 รายการต่อตัวละคร</td></tr>
      </tbody>
    </table></div>
    <p class="lede">
      จำกัด 1 รายการเพราะถ้าคนเดียวโพสต์ได้สิบอัน หน้าแรกก็จะเป็นของคนเดียว
      คนอื่นต้องเลื่อนผ่าน
    </p>

    <h3>ตั้งรับซื้อ (Buy Order)</h3>
    <div class="tablewrap"><table>
      <tbody>
        <tr><td>ค่าธรรมเนียม</td><td class="num">5% ของเงินที่กันไว้ (ขั้นต่ำ 10z)</td></tr>
        <tr><td>อยู่ได้นาน</td><td class="num">7 วัน</td></tr>
        <tr><td>ตั้งได้พร้อมกัน</td><td class="num">1 คำสั่งต่อตัวละคร</td></tr>
        <tr><td>จำนวนสูงสุดต่อคำสั่ง</td><td class="num">5,000 ชิ้น</td></tr>
      </tbody>
    </table></div>
    <p>
      ค่าธรรมเนียมแพงกว่าการตั้งขายเพราะคำสั่งซื้อที่ไม่มีใครมาขายให้
      คือการกันเงินออกจากระบบไว้เป็นอาทิตย์ ส่วนการประมูลที่ไม่มีคนบิดแค่คืนของให้เจ้าของ
    </p>
    <p><strong>ปิดคำสั่งก่อนครบเวลาได้</strong> จะได้ของที่มีคนขายมาแล้วกับเงินที่เหลือคืน</p>

    <h2>เปลี่ยนอาชีพกับ Class Master</h2>
    <p>
      NPC <strong>Class Master</strong> ยืนอยู่ที่ค่ายใต้ Prontera บนแมพ <code>prt_fild08</code>
      เมนูแยกการเปลี่ยนอาชีพเป็นสองหัวข้อตั้งแต่ครั้งแรกที่คุย เพราะสองอย่างนี้ไม่ใช่เรื่องเดียวกัน
      อันหนึ่งกลับคำได้ อีกอันกลับคำไม่ได้
    </p>
    <div class="tablewrap"><table>
      <thead><tr><th></th><th>เปลี่ยนอาชีพ 1</th><th>เปลี่ยนเป็นอาชีพ 2</th></tr></thead>
      <tbody>
        <tr><td>เงื่อนไข</td>
          <td>Novice ต้อง Job Level 10 และลงแต้มสกิลให้หมดก่อน<br>ถ้าเป็นอาชีพ 1 อยู่แล้วเปลี่ยนได้ทันที</td>
          <td>เป็นอาชีพ 1 + Job Level 50 + ลงแต้มสกิลให้หมด</td></tr>
        <tr><td>เปลี่ยนได้กี่ครั้ง</td>
          <td class="num"><strong>ไม่จำกัด</strong></td>
          <td class="num">ครั้งเดียว แล้วล็อคถาวร</td></tr>
        <tr><td>Base Level</td><td class="num">ไม่เปลี่ยน</td><td class="num"><strong>ลดเหลือ 10</strong></td></tr>
        <tr><td>Job Level</td><td class="num">ไม่เปลี่ยน</td><td class="num">กลับไปเริ่มที่ 1</td></tr>
        <tr><td>สเตตัสกับสกิล</td><td>รีเซ็ต คืนแต้มครบเท่าเดิม</td><td>รีเซ็ต คืนแต้มตามเลเวลใหม่</td></tr>
        <tr><td>ของที่ใส่อยู่</td><td colspan="2">ถูกถอดกลับเข้ากระเป๋า รถเข็นถูกเก็บ ไอเทมกับเงินไม่หายไปไหน</td></tr>
      </tbody>
    </table></div>
    <div class="note warn">
      <p><strong>ขึ้นอาชีพ 2 แล้วเปลี่ยนอาชีพไม่ได้อีกเลย</strong></p>
      <p>
        ทั้งย้อนกลับไปเป็นอาชีพ 1 และข้ามไปอาชีพ 2 สายอื่น ทำไม่ได้ทั้งคู่ — เมนูยังกดได้อยู่
        แต่ NPC จะบอกว่าอาชีพถูกล็อคแล้ว ส่วนรีเซ็ตสกิลกับรีเซ็ตสเตตัสยังทำได้ตลอดเหมือนเดิม
      </p>
      <p>
        ตราบใดที่ยังเป็นอาชีพ 1 อยู่ จะสลับสายไปมากี่รอบก็ได้ ไม่เสียเลเวลและไม่เสียแต้ม
        ลองให้พอใจก่อนแล้วค่อยขึ้นอาชีพ 2
      </p>
    </div>
    <p class="lede">
      อาชีพ 2 ที่ไปต่อได้ผูกกับอาชีพ 1 ตายตัว — Swordsman→Knight, Archer→Hunter, Mage→Wizard,
      Acolyte→Priest, Thief→Assassin, Merchant→Blacksmith
      หกสายนี้คือสายที่มีผังสกิลครบในเซิร์ฟ สายอื่นยังไม่เปิดให้ไป
    </p>

    <h2>ร้านค้าส่วนตัวและร้าน Offline</h2>
    <p>
      พ่อค้าที่มีรถเข็นและสกิล Vending ตั้งร้านขายของในรถเข็นได้ ต่างจากตลาดกลางตรงที่
      ร้านตั้งอยู่กับตัวเราบนแมพจริง คนอื่นต้องเดินมาคลิกป้ายร้าน ไม่มีค่าธรรมเนียมสักบาท
    </p>
    <div class="tablewrap"><table>
      <tbody>
        <tr><td>ต้องมี</td><td class="num">รถเข็น + สกิล Vending</td></tr>
        <tr><td>วางขายได้กี่ช่อง</td><td class="num">เลเวลสกิล + 2 (เลเวล 10 = 12 ช่อง)</td></tr>
        <tr><td>ราคาสูงสุดต่อชิ้น</td><td class="num">9,999,999z</td></tr>
        <tr><td>ชื่อร้าน</td><td class="num">ยาวได้ 32 ตัวอักษร</td></tr>
        <tr><td>ห้ามตั้งใกล้ NPC</td><td class="num">ต้องห่างเกิน 4 ช่อง</td></tr>
        <tr><td>ค่าธรรมเนียม</td><td class="num">ไม่มี</td></tr>
      </tbody>
    </table></div>

    <h3>ตั้งร้านแล้วออกจากเกมได้ (Offline Vending)</h3>
    <p>
      ในกรอบร้าน ใต้ปุ่มปิดร้าน มีปุ่ม <strong>ตั้งร้านค้า Offline</strong>
      กดแล้วจะออกจากเกมกลับไปหน้าล็อกอิน แต่ตัวละครยังยืนขายอยู่ที่เดิม
      คนอื่นเดินมาซื้อได้ตามปกติเหมือนเรายังออนไลน์
    </p>
    <div class="tablewrap"><table>
      <tbody>
        <tr><td>ร้านอยู่ได้นาน</td><td class="num">2 วัน (48 ชั่วโมง — ตั้งค่าได้ที่ <code>OfflineVendingHours</code>)</td></tr>
        <tr><td>ร้านปิดเองเมื่อ</td><td class="num">ของหมด / หมดเวลา / เจ้าของกลับมาล็อกอิน / เซิร์ฟรีสตาร์ต</td></tr>
        <tr><td>เงินกับของที่เหลือ</td><td class="num">บันทึกลงฐานข้อมูลทุกครั้งที่ขายได้ 1 รายการ</td></tr>
      </tbody>
    </table></div>
    <div class="note warn">
      <p><strong>ล็อกอินครั้งแรกจะโดนเด้ง ให้กดเข้าอีกครั้ง</strong></p>
      <p>
        ระหว่างที่ร้านยังตั้งอยู่ ตัวละครอยู่ในโลกจริง ๆ ระบบจึงกันไม่ให้ล็อกอินซ้ำ
        ไม่งั้นจะได้ตัวละครสองตัวถือของชุดเดียวกัน ครั้งแรกที่กดเข้าคือคำสั่งให้ปิดร้าน
        พอปิดเสร็จและบันทึกตัวละครแล้ว กดเข้าอีกครั้งก็เข้าได้ตามปกติ
      </p>
    </div>
    <p class="lede">
      ร้านไม่ได้ถูกเก็บลงฐานข้อมูล ถ้าเซิร์ฟรีสตาร์ตร้านจะหายไปหมด
      แต่ของยังอยู่ในรถเข็นและเงินยังอยู่ครบ เพราะทุกการขายบันทึกทันที
    </p>

    <h2>ระบบเพื่อน</h2>
    <ul>
      <li>คลิกขวาที่ตัวละคร (หรือกดจากรายชื่อคนรอบข้างบนมือถือ) แล้วเลือก "จดจำ"</li>
      <li>รายชื่อเพื่อนอยู่หน้าเดียวกับปาร์ตี้ ชื่อหน้า "ปาร์ตี้และเพื่อน"</li>
      <li>เห็นอาชีพ เลเวล กิลด์ และสถานะออนไลน์</li>
      <li>กดคุยแชทส่วนตัวได้ ถ้าอีกฝ่ายออฟไลน์จะแจ้งว่าส่งไม่ได้</li>
      <li>จำได้สูงสุด 60 คน</li>
    </ul>

    <h2>ตีบวก</h2>
    <ul>
      <li>อัตราสำเร็จขึ้นกับ Weapon Rank ของอาวุธ (rank สูง = ตีบวกยาก) เกราะใช้อีกคอลัมน์
        — ${link("#/charts/refine", "ดูตารางเต็ม")}</li>
      <li>พลาดแล้วของหาย ยกเว้นชิ้นที่ตั้ง <code>Breakable = No</code></li>
      <li>แรงก์นักผจญภัย 7 ขึ้นไปเพิ่มโอกาสสำเร็จ สูงสุด +8%</li>
      <li><strong>ตีบวกเกราะคุ้มกว่าที่คิด</strong> — สำหรับผู้เล่น การตีบวก 1 ระดับถูกนับสองรอบ
        รอบแรกบวกเข้า DEF เต็ม ๆ (คูณ 10 ในตาราง) รอบสองบวกซ้ำอีกคูณ 7
        รวมแล้ว 1 ระดับตีบวก = DEF 1.7 หน่วย</li>
    </ul>

    <h2>คราฟและขุดแร่</h2>
    <p>${link("#/recipes", "ดูสูตรทั้งหมด")} — ระบบคราฟปลดล็อกทีละอย่างผ่านเหตุการณ์สำคัญของเซิร์ฟ</p>

    <h2>เหตุการณ์สำคัญของเซิร์ฟ (Milestone)</h2>
    <p>NPC ที่ค่ายทางใต้ของ Prontera จะเพิ่มขึ้นตามความคืบหน้าของทั้งเซิร์ฟ ไม่ใช่ของตัวเราคนเดียว</p>
    <div class="tablewrap"><table>
      <thead><tr><th>เงื่อนไข</th><th>ปลดล็อก</th></tr></thead>
      <tbody>
        <tr><td>มีคนถึงเลเวล 10</td><td>Kafra</td></tr>
        <tr><td>มีคนถึงเลเวล 20</td><td>ร้านฟาร์ม (เนื้อ นม)</td></tr>
        <tr><td>มีคนถึงเลเวล 30</td><td>ร้านของทั่วไป (ปีกแมลงวัน ลูกศร)</td></tr>
        <tr><td>มีคนถึงเลเวล 40</td><td>นักเล่นแร่แปรธาตุ (ยา)</td></tr>
        <tr><td>มีคนถึงเลเวล 50</td><td>ช่างทำลูกศร (กระบอกลูกศร)</td></tr>
        <tr><td>มีคนถึงเลเวล 60</td><td>ร้านยา (แปลงสมุนไพรเป็นยา)</td></tr>
        <tr><td>มีคนถึงเลเวล 80</td><td>นักปราชญ์ (สกรอลล์ รวมถึง Elemental Converter)</td></tr>
        <tr><td>ฆ่ามินิบอสครบ 4 ตัว</td><td>ตีอาวุธธาตุ</td></tr>
        <tr><td>ฆ่ามินิบอสครบ 7 ตัว</td><td>คราฟหมวก</td></tr>
        <tr><td>ฆ่า MVP ครบ 2 ตัว</td><td>คราฟอาวุธระดับสูง</td></tr>
        <tr><td>ฆ่า MVP ครบ 8 ตัว + มีคนถึงเลเวล 85</td><td>Valkyrie และดันเจี้ยนท้าทาย Okolnir</td></tr>
      </tbody>
    </table></div>
    <p class="lede">MVP ที่ถูกฆ่าครั้งแรกจะบันทึกชื่อคนฆ่าไว้บนกระดานที่ prt_fild08 และแจกโบนัสให้ทุกคนที่ออนไลน์อยู่</p>

    <h2>Antonio ซานต้าประจำแมพ</h2>
    <p>
      ทุกแมพที่มีมอนของตัวเองจะมี Antonio 1 ตัว ไม่โจมตีและไม่ตอบโต้ เลือดน้อยมาก
      ตายแล้วอีกประมาณ 1 นาทีจะเกิดใหม่ที่อื่นในแมพเดิม ดรอป Gift Box
      และมีโอกาสน้อย ๆ ได้ Snake Head
    </p>

    <div class="note">
      <p><strong>ระบบที่ยังไม่เปิด</strong></p>
      <p>
        Bounty System (ระบบล่าค่าหัว) มีไฟล์อยู่แต่ฟังก์ชันยังว่าง และไม่ได้เปิดใน
        <code>ActiveEvents</code> อยู่แล้ว — ตอนนี้เปิดอยู่แค่ MilestoneEvent, AdventureBook และ BossLog
        ส่วนกิลด์และ WoE ยังไม่ได้เขียนเลย
      </p>
    </div>
  `;
}

// ------------------------------------------------------------------- ธาตุ

async function elements() {
  const chart = await data("elements");
  const attacks = chart.attackElements.filter((e) => e !== "None");
  const defenders = Object.keys(chart.chart);

  const head = `<tr><th>ตัวตั้งรับ \\ ตีด้วย</th>${attacks
    .map((a) => `<th class="num">${esc(ELEMENT_TH[a] ?? a)}</th>`)
    .join("")}</tr>`;

  const body = defenders
    .map((d) => {
      const { base, level } = splitElement(d);
      const cells = attacks
        .map((a) => {
          const v = chart.chart[d][a] ?? 100;
          const style =
            v > 100 ? "color:#196B35;font-weight:700"
            : v === 0 ? "color:#9B1C1C;font-weight:700"
            : v < 100 ? "color:#9B1C1C;font-weight:700" : "";
          return `<td class="num" style="${style}">${v}</td>`;
        })
        .join("");
      return `<tr><td class="name">${esc(ELEMENT_TH[base] ?? base)} ${level}</td>${cells}</tr>`;
    })
    .join("");

  return `
    <h1>ตารางธาตุ</h1>
    <p class="lede">
      อ่านจาก <code>ElementalChart.csv</code> — แถวคือธาตุของตัวที่โดนตี คอลัมน์คือธาตุที่ใช้ตี
      ตัวเลขคือเปอร์เซ็นต์ดาเมจ
    </p>

    <div class="note">
      <p><strong>ระวังสองเรื่อง</strong></p>
      <p>
        1. <strong>มอนสเตอร์ตีเป็นธาตุ Neutral เสมอ</strong> ตารางนี้ใช้ตอนเราตีมันเท่านั้น
        ตอนมันตีเราให้ดูแถวธาตุเกราะของเรา คูณกับคอลัมน์ Neutral<br>
        2. ธาตุมีระดับ 1–4 ระดับสูงกว่าไม่ได้แปลว่าทนกว่าเสมอไป บางธาตุยิ่งระดับสูงยิ่งแพ้ทางหนัก
      </p>
    </div>

    <div class="tablewrap">
      <table style="font-size:13px">
        <thead>${head}</thead>
        <tbody>${body}</tbody>
      </table>
    </div>

    <h2>อ่านตารางยังไง</h2>
    <ul>
      <li><strong>เกิน 100</strong> = แพ้ทาง ตีแรงขึ้น</li>
      <li><strong>ต่ำกว่า 100</strong> = ทนทาง ตีไม่ค่อยเข้า</li>
      <li><strong>0</strong> = ไม่เข้าเลย เช่นตี Undead ด้วยธาตุ Undead</li>
    </ul>
    <p>
      อยากรู้ว่ามอนตัวไหนควรตีด้วยธาตุอะไร เปิดหน้ามอนตัวนั้นได้เลย
      มีตารางเฉพาะของมันพร้อมบอกจุดอ่อนให้
    </p>
  `;
}
