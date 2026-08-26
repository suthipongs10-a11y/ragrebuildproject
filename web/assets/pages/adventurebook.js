import {
  data, index, esc, n, table, filterable, link, itemLink, monsterLink, mapLink,
} from "../app.js";

export async function render({ rest }) {
  return rest[0] === "bosslog" ? bossLog() : book();
}

// ------------------------------------------------------------- สมุดผจญภัย

async function book() {
  const [custom, byId, mons, maps] = await Promise.all([
    data("custom"), index("itemsById"), index("monstersByCode"), index("mapsByCode"),
  ]);
  const ab = custom.adventureBook;
  const topRank = ab.ranks[ab.ranks.length - 1];
  const slack = ab.totalStars - topRank.stars;

  const host = document.createElement("div");
  host.innerHTML = `
    <h1>สมุดผจญภัย</h1>
    <p class="lede">
      ${n(ab.pages.length)} หน้า ${n(ab.totalStars)} ดาว ใน ${n(ab.regions.length)} ภูมิภาค —
      เก็บครบทั้งเล่มต้องฆ่ามอนรวม ${n(ab.totalKills)} ตัว
    </p>

    <div class="note${slack < 30 ? " bad" : ""}">
      <p><strong>เหลือช่องว่างแค่ ${n(slack)} ดาว</strong></p>
      <p>
        แรงก์ 10 ต้องมี ${n(topRank.stars)} ดาว <em>และ</em> เก็บครบทุกภูมิภาค
        ตอนนี้ทั้งเล่มมี ${n(ab.totalStars)} ดาว
        ${slack < 30
          ? `พลาดไปแค่ ${n(slack + 1)} ดาวก็ถึงแรงก์ 10 ไม่ได้แล้ว
             ถ้าเปิดแมพเพิ่มตัวเลขนี้จะขยับขึ้นเอง เพราะเกณฑ์เป็นตัวเลขตายตัวไม่ใช่สัดส่วน`
          : "ยังมีที่เหลือพอสมควร"}
      </p>
    </div>

    <div class="note">
      <p><strong>หนึ่งหน้าคือการ์ดหนึ่งใบ ไม่ใช่มอนหนึ่งตัว</strong></p>
      <p>
        มอนที่ดรอปการ์ดใบเดียวกันอยู่หน้าเดียวกัน เช่นก็อบลินทั้งกลุ่ม
        มอนที่ไม่มีการ์ดจะเป็นหน้าของตัวเองและได้สูงสุด 2 ดาว
        บอสไม่ถูกนับเข้าสมุดเล่มนี้ (ไปอยู่${link("#/adventurebook/bosslog", "สมุดบอส")}แทน)
        และมอนที่ไม่ให้ EXP เลย เช่นต้นไม้กับหุ่นซ้อม ก็ไม่นับ (${n(ab.notQuarry)} ตัว)
      </p>
    </div>

    <h2>เงื่อนไขแต่ละดาว</h2>
    <div class="tablewrap"><table>
      <thead><tr><th>ดาว</th><th>ต้องทำอะไร</th></tr></thead>
      <tbody>
        <tr><td><strong>★ 1</strong></td><td>ล่าให้ครบเป้า — เป้าคิดจากจำนวนที่เกิดได้ทั้งโลก
          <code>clamp(ปัดขึ้นทีละ 50 ของครึ่งหนึ่ง, 50, 500)</code></td></tr>
        <tr><td><strong>★ 2</strong></td><td>ล่าต่อจนครบ 3 เท่าของเป้าแรก</td></tr>
        <tr><td><strong>★ 3</strong></td><td>ได้การ์ดของหน้านั้น <strong>จากการฆ่ามอนเท่านั้น</strong>
          ซื้อ เทรด หรือเปิดจากอัลบั้มไม่นับ</td></tr>
      </tbody>
    </table></div>

    <h2>ของที่ได้ต่อดาว</h2>
    <p class="lede">แบ่งตามเลเวลของหน้านั้น ทุกดาวได้แร่ตีบวกเพิ่มเสมอ</p>
    <div class="tablewrap"><table>
      <thead><tr><th>ช่วงเลเวลของหน้า</th><th>★ 1</th><th>★ 2</th><th>★ 3</th></tr></thead>
      <tbody>${ab.bands
        .map(
          (b, i) => `<tr>
            <td><strong>${b.maxLevel ? `Lv ${i === 0 ? 1 : ab.bands[i - 1].maxLevel + 1}–${b.maxLevel}` : `Lv ${ab.bands[i - 1].maxLevel + 1}+`}</strong></td>
            <td>${rewardList(b.hunt, byId)}</td>
            <td>${rewardList(b.huntLarge, byId)}</td>
            <td>${rewardList(b.card, byId)}</td>
          </tr>`
        )
        .join("")}</tbody>
    </table></div>

    <h2>แรงก์นักผจญภัย</h2>
    <p class="lede">โบนัสเป็นค่าสะสม ไม่ใช่บวกทับกัน — แรงก์ 5 ให้ +3 ทุกสเตตัส ไม่ใช่ +1+2+3</p>
    <div class="tablewrap"><table>
      <thead><tr><th class="num">แรงก์</th><th class="num">ดาวที่ต้องมี</th>
        <th class="num">ทุกสเตตัส</th><th class="num">ดรอป</th><th class="num">EXP</th>
        <th class="num">ตีบวก</th><th>ของที่ได้ตอนขึ้นแรงก์</th></tr></thead>
      <tbody>${ab.ranks
        .map(
          (r) => `<tr>
            <td class="num"><strong>${r.rank}</strong></td>
            <td class="num">${n(r.stars)}${r.everyRegion ? " + ครบทุกภูมิภาค" : ""}</td>
            <td class="num">${r.stats ? `+${r.stats}` : "-"}</td>
            <td class="num">${r.dropPercent ? `+${r.dropPercent}%` : "-"}</td>
            <td class="num">${r.expPercent ? `+${r.expPercent}%` : "-"}</td>
            <td class="num">${r.refinePercent ? `+${r.refinePercent}%` : "-"}</td>
            <td>${rewardList(r.rewards, byId)}</td>
          </tr>`
        )
        .join("")}</tbody>
    </table></div>

    <h2>ภูมิภาคและหมวกรางวัล</h2>
    <p class="lede">
      เก็บครบทั้งภูมิภาคได้หมวกประจำภูมิภาค ทุกใบเป็นของที่หาจากทางอื่นไม่ได้เลย
      ไม่ดรอป ไม่มีร้านขาย ไม่อยู่ในกล่อง
    </p>
    <div class="tablewrap"><table>
      <thead><tr><th>ภูมิภาค</th><th class="num">หน้า</th><th class="num">ดาว</th><th>หมวกรางวัล</th></tr></thead>
      <tbody>${ab.regions
        .map(
          (r) => `<tr>
            <td>${esc(r.name)}</td>
            <td class="num">${n(r.pages)}</td>
            <td class="num">${n(r.stars)}</td>
            <td class="name">${itemLink(byId.get(r.headgear))}</td>
          </tr>`
        )
        .join("")}</tbody>
    </table></div>

    <h2>ทุกหน้าในสมุด</h2>`;

  const body = document.createElement("div");
  host.appendChild(body);

  const rows = ab.pages.map((p) => ({
    ...p,
    memberNames: p.monsters.map((c) => mons.get(c)?.name ?? c).join(", "),
  }));

  filterable({
    host: body,
    items: rows,
    controls: [
      { type: "search", key: "q", placeholder: "ชื่อหน้า หรือชื่อมอน…",
        test: (p, v) => `${p.name} ${p.memberNames}`.toLowerCase().includes(v) },
      { key: "region", label: "ภูมิภาค",
        options: [["", "ภูมิภาค: ทั้งหมด"], ...ab.regions.map((r) => r.name)],
        test: (p, v) => p.region === v },
      { key: "stars", label: "ดาวสูงสุด",
        options: [["", "ดาวสูงสุด: ทั้งหมด"], ["3", "3 ดาว (มีการ์ด)"], ["2", "2 ดาว (ไม่มีการ์ด)"]],
        test: (p, v) => String(p.stars) === v },
    ],
    render: (list) =>
      table(list, [
        { key: "name", label: "หน้า", cls: "name",
          render: (p) => (p.cardId ? itemLink(byId.get(p.cardId)) : esc(p.name)) },
        { key: "members", label: "นับมอนตัวไหนบ้าง", sortValue: (p) => p.memberNames,
          render: (p) => p.monsters.map((c) => monsterLink(mons.get(c))).join(", ") },
        { key: "level", label: "Lv", num: true },
        { key: "region", label: "ภูมิภาค" },
        { key: "spawnCount", label: "เกิดทั้งโลก", num: true, render: (p) => n(p.spawnCount) },
        { key: "huntTarget", label: "★1 ล่ากี่ตัว", num: true, render: (p) => n(p.huntTarget) },
        { key: "huntTargetLarge", label: "★2 ล่ากี่ตัว", num: true, render: (p) => n(p.huntTargetLarge) },
        { key: "stars", label: "ดาวสูงสุด", num: true },
        { key: "where", label: "เกิดเยอะสุดที่", sortValue: (p) => p.maps[0]?.map ?? "",
          render: (p) => p.maps.slice(0, 2)
            .map((s) => `${mapLink(maps.get(s.map), s.map)} (${n(s.count)})`).join(", ") },
      ], { sort: "level", dir: "asc" }),
  });

  return host;
}

function rewardList(list, byId) {
  return list
    .map((r) => `${itemLink(byId.get(r.id))}${r.count > 1 ? ` ×${r.count}` : ""}`)
    .join(", ");
}

// ---------------------------------------------------------------- สมุดบอส

async function bossLog() {
  const [custom, byId, mons, maps] = await Promise.all([
    data("custom"), index("itemsById"), index("monstersByCode"), index("mapsByCode"),
  ]);
  const bl = custom.bossLog;

  const rows = bl.entries.map((e) => ({ ...e, mon: mons.get(e.code) }));

  // If a shop sells the clear reward, the log's whole promise is undercut - say so
  // from the data rather than repeating the design intent.
  const plain = byId.get(bl.clearReward);
  const sellers = plain?.soldBy ?? [];

  const host = document.createElement("div");
  host.innerHTML = `
    <p class="crumbs">${link("#/adventurebook", "สมุดผจญภัย")} / สมุดบอส</p>
    <h1>สมุดบอส</h1>
    <p class="lede">
      MVP ${n(bl.mvpCount)} ตัว มินิบอส ${n(bl.bossCount)} ตัว รวม ${n(bl.entries.length)} ตัว —
      ฆ่าอย่างละครั้งเดียวก็นับแล้ว
    </p>

    <div class="note">
      <p><strong>รางวัลมีอย่างเดียว และไม่ต้องลุ้น</strong></p>
      <p>
        เก็บครบทั้งเล่มได้ ${itemLink(byId.get(bl.clearReward))} แบบไม่มีรูแน่นอน
        ส่วน${itemLink(byId.get(bl.crownedHat))}แบบมีรูออกจากกล่อง MVP อย่างเดียว ไม่มีทางอื่น
      </p>
      <p>สมุดเล่มนี้ไม่เกี่ยวกับแรงก์นักผจญภัย เป็นคนละระบบและจ่ายรางวัลของตัวเอง</p>
    </div>

    ${sellers.length ? `<div class="note bad">
      <p><strong>ตอนนี้มี NPC ขายหมวกใบนี้อยู่ ทำให้รางวัลของสมุดไม่มีความหมาย</strong></p>
      <p>
        ${sellers.map((s) => `${esc(s.name)} ที่ ${esc(s.map)} ราคา ${n(s.price ?? plain.price)} z`).join(", ")}
        ขาย${itemLink(plain)}
        ซื้อเอาง่ายกว่าตามเก็บบอสทั้ง ${n(bl.entries.length)} ตัวมาก
        ถ้าตั้งใจให้สมุดเป็นทางเดียวที่จะได้ ต้องเอา NPC ตัวนั้นออกก่อน
      </p></div>` : ""}

    <p class="lede">${link("#/bosses", "ดูตารางเวลาเกิดของทุกจุด")} — มินิบอส 6 นาที MVP 14–15 นาที</p>`;

  const body = document.createElement("div");
  host.appendChild(body);

  filterable({
    host: body,
    items: rows,
    controls: [
      { type: "search", key: "q", placeholder: "ชื่อบอส…",
        test: (r, v) => `${r.mon?.name ?? ""} ${r.code}`.toLowerCase().includes(v) },
      { key: "kind", label: "ประเภท",
        options: [["", "ประเภท: ทั้งหมด"], ["mvp", "MVP"], ["boss", "มินิบอส"]],
        test: (r, v) => (v === "mvp" ? r.isMvp : !r.isMvp) },
    ],
    render: (list) =>
      table(list, [
        { key: "name", label: "บอส", cls: "name", sortValue: (r) => r.mon?.name?.toLowerCase() ?? "",
          render: (r) => monsterLink(r.mon) +
            (r.isMvp ? ' <span class="chip mvp">MVP</span>' : ' <span class="chip boss">มินิบอส</span>') },
        { key: "level", label: "Lv", num: true, sortValue: (r) => r.mon?.level ?? 0,
          render: (r) => r.mon?.level ?? "" },
        { key: "hp", label: "HP", num: true, sortValue: (r) => r.mon?.hp ?? 0,
          render: (r) => n(r.mon?.hp ?? 0) },
        { key: "where", label: "อยู่ที่ไหน", sortValue: (r) => r.maps[0]?.map ?? "",
          render: (r) => r.maps.map((s) => mapLink(maps.get(s.map), s.map)).join(", ") },
        { key: "exp", label: "EXP", num: true, sortValue: (r) => r.mon?.exp ?? 0,
          render: (r) => n(r.mon?.exp ?? 0) },
      ], { sort: "level", dir: "asc" }),
  });

  return host;
}
