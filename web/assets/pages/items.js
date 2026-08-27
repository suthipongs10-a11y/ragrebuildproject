import {
  data, index, esc, n, pct, table, filterable, link, richText,
  itemLink, monsterLink, mapLink, itemIcon,
} from "../app.js";
import { ELEMENT_TH, splitElement } from "./monsters.js";

const TYPE_TH = {
  Weapon: "อาวุธ", Equipment: "เกราะ/เครื่องประดับ", Card: "การ์ด",
  Useable: "ของใช้", Etc: "ของทั่วไป", Ammo: "กระสุน",
};

const POSITION_TH = {
  MainHand: "มือหลัก", BothHands: "สองมือ", OffHand: "มือรอง",
  Headgear: "ศีรษะ", HeadgearTop: "ศีรษะบน", HeadgearMid: "ศีรษะกลาง",
  HeadgearBottom: "ศีรษะล่าง", Armor: "ตัว", Garment: "ผ้าคลุม",
  Footgear: "รองเท้า", Accessory: "เครื่องประดับ", AccessoryLeft: "เครื่องประดับซ้าย",
  AccessoryRight: "เครื่องประดับขวา", Ammo: "กระสุน",
};

const USAGE_TH = {
  None: "ทั่วไป", Refine: "ใช้ตีบวก", Quest: "ของเควส",
  HighValue: "ของมีค่า", Crafting: "วัตถุดิบคราฟ", Catalyst: "ตัวเร่ง",
};

const label = (dict, key) => dict[key] ?? key ?? "";

// --------------------------------------------------------------------- list

export async function list({ query }) {
  const [items, ref] = await Promise.all([data("items"), data("reference")]);
  const host = document.createElement("div");
  host.innerHTML = `
    <h1>ไอเท็ม</h1>
    <p class="lede">${n(items.length)} ชิ้น — ราคาที่แสดงคือราคาหลังผ่านสคริปต์ปรับราคาของเซิร์ฟแล้ว</p>`;

  const body = document.createElement("div");
  host.appendChild(body);

  const weaponTypes = [...new Set(items.filter((i) => i.weaponType).map((i) => i.weaponType))].sort();
  const positions = [...new Set(items.map((i) => i.position).filter(Boolean))].sort();
  const groups = [...new Set(items.map((i) => i.equipGroup).filter(Boolean))].sort();

  filterable({
    host: body,
    items,
    controls: [
      { type: "search", key: "q", placeholder: "ชื่อ รหัส หรือคำในคำอธิบาย…",
        test: (i, v) => `${i.name} ${i.code} ${i.desc ?? ""}`.toLowerCase().includes(v) },
      { key: "type", label: "ประเภท", value: query.get("type") ?? "",
        options: [["", "ประเภท: ทั้งหมด"], ...Object.entries(TYPE_TH)],
        test: (i, v) => i.type === v },
      { key: "weaponType", label: "ชนิดอาวุธ",
        options: [["", "ชนิดอาวุธ: ทั้งหมด"], ...weaponTypes],
        test: (i, v) => i.weaponType === v },
      { key: "position", label: "ตำแหน่ง",
        options: [["", "ตำแหน่ง: ทั้งหมด"], ...positions.map((p) => [p, label(POSITION_TH, p)])],
        test: (i, v) => i.position === v },
      { key: "equipGroup", label: "กลุ่มอาชีพ",
        options: [["", "กลุ่มอาชีพ: ทั้งหมด"], ...groups],
        test: (i, v) => i.equipGroup === v },
      { key: "source", label: "หาได้จาก",
        options: [["", "หาได้จาก: ทั้งหมด"], ["drop", "มอนดรอป"], ["shop", "ร้าน NPC"],
                  ["none", "ยังไม่มีทางได้"]],
        test: (i, v) =>
          v === "drop" ? !!i.droppedBy
          : v === "shop" ? !!i.soldBy
          : !i.droppedBy && !i.soldBy },
    ],
    render: (rows) =>
      table(rows, [
        { key: "name", label: "ชื่อ", cls: "name",
          render: (i) => itemIcon(i.code) + link(`#/item/${i.id}`, i.name) +
            (unequippable(i, ref) ? ' <span class="chip warn">ใส่ไม่ได้</span>' : "") },
        { key: "id", label: "id", num: true },
        { key: "type", label: "ประเภท", render: (i) => esc(label(TYPE_TH, i.type)) },
        { key: "spec", label: "ค่าหลัก", num: true,
          sortValue: (i) => i.attack ?? i.defense ?? 0,
          render: (i) =>
            i.attack ? `ATK ${i.attack}`
            : i.defense || i.magicDef ? `DEF ${i.defense ?? 0}${i.magicDef ? ` / MDEF ${i.magicDef}` : ""}`
            : "" },
        { key: "slots", label: "รู", num: true, render: (i) => (i.slots ? i.slots : "") },
        { key: "minLevel", label: "Lv ขั้นต่ำ", num: true, render: (i) => i.minLevel ?? "" },
        { key: "equipGroup", label: "กลุ่มอาชีพ" },
        { key: "price", label: "ราคาซื้อ", num: true, render: (i) => n(i.price) },
        { key: "weight", label: "น้ำหนัก", num: true, render: (i) => n(i.weight) },
      ], { sort: "id", dir: "asc" }),
  });

  return host;
}

/** An EquipGroup that never made it into EquipmentGroups.csv locks everyone out. */
function unequippable(item, ref) {
  return !!item.equipGroup && !ref.equipGroups[item.equipGroup];
}

// ------------------------------------------------------------------- detail

export async function detail({ rest }) {
  const id = Number(rest[0]);
  const [byId, ref] = await Promise.all([index("itemsById"), data("reference")]);
  const item = byId.get(id);
  if (!item) return `<h1>ไม่พบไอเท็ม</h1><p>ไม่มีไอเท็ม id <code>${esc(rest[0])}</code></p>`;

  const [mons, maps] = await Promise.all([index("monstersByCode"), index("mapsByCode")]);

  const group = item.equipGroup ? ref.equipGroups[item.equipGroup] : null;
  const broken = unequippable(item, ref);

  const chips = [`<span class="chip">${esc(label(TYPE_TH, item.type))}</span>`];
  if (item.type === "Etc" && item.subCategory)
    chips.push(`<span class="chip mute">${esc(label(USAGE_TH, item.subCategory))}</span>`);
  if (item.element && item.element !== "Neutral")
    chips.push(`<span class="chip">ธาตุ${esc(ELEMENT_TH[splitElement(item.element).base] ?? item.element)}</span>`);
  if (item.slots) chips.push(`<span class="chip">${item.slots} รู</span>`);
  if (item.position) chips.push(`<span class="chip mute">${esc(label(POSITION_TH, item.position))}</span>`);
  if (item.cardSlot) chips.push(`<span class="chip">ใส่ได้ที่: ${esc(label(POSITION_TH, item.cardSlot))}</span>`);
  if (item.refinable) chips.push('<span class="chip mute">ตีบวกได้</span>');
  if (broken) chips.push('<span class="chip warn">ไม่มีอาชีพไหนใส่ได้</span>');
  if (!item.droppedBy && !item.soldBy) chips.push('<span class="chip warn">ยังไม่มีทางได้มา</span>');

  const spec = [];
  if (item.attack) spec.push(["ATK", n(item.attack)]);
  if (item.defense) spec.push(["DEF", n(item.defense)]);
  if (item.magicDef) spec.push(["MDEF", n(item.magicDef)]);
  if (item.range) spec.push(["ระยะ", `${item.range} ช่อง`]);
  if (item.slots) spec.push(["รูใส่การ์ด", item.slots]);
  if (item.minLevel) spec.push(["Base Lv ขั้นต่ำ", item.minLevel]);
  if (item.rank) spec.push(["Weapon Rank", item.rank]);
  if (item.weaponType) spec.push(["ชนิดอาวุธ", item.weaponType]);
  if (item.equipType) spec.push(["ชนิด", item.equipType]);
  if (item.element) spec.push(["ธาตุอาวุธ", ELEMENT_TH[splitElement(item.element).base] ?? item.element]);
  spec.push(["ราคาซื้อจาก NPC", item.price ? `${n(item.price)} z` : "ไม่ขาย"]);
  spec.push(["ขายคืน NPC", item.sellPrice ? `${n(item.sellPrice)} z` : "ขายไม่ได้"]);
  spec.push(["น้ำหนัก", n(item.weight)]);
  if (item.useEffect) spec.push(["ผลตอนใช้", item.useEffect]);
  if (item.prefix) spec.push(["คำนำหน้าเมื่อใส่", item.prefix]);
  if (item.postfix) spec.push(["คำต่อท้ายเมื่อใส่", item.postfix]);

  const dropRows = (item.droppedBy ?? [])
    .map((d) => {
      const mon = mons.get(d.monster);
      const where = (mon?.maps ?? [])
        .slice(0, 3)
        .map((p) => mapLink(maps.get(p.map), p.map))
        .join(", ");
      const width = Math.max(2, Math.min(100, d.chance / 100));
      return `<tr>
        <td class="name">${monsterLink(mon)}${mon?.noSpawn ? ' <span class="chip warn">ไม่มีที่เกิด</span>' : ""}</td>
        <td class="num">${mon?.level ?? ""}</td>
        <td><span class="chance"><b>${pct(d.chance)}</b><span class="bar"><i style="width:${width}%"></i></span></span></td>
        <td>${where || "<em>ไม่มีที่เกิด</em>"}</td>
      </tr>`;
    })
    .join("");

  const shopRows = (item.soldBy ?? [])
    .map(
      (s) => `<tr><td>${esc(s.name)}</td>
        <td class="name">${mapLink(maps.get(s.map), s.map)}</td>
        <td class="num">${s.price !== undefined
          ? `${n(s.price)} z <span class="chip mute">ร้านตั้งราคาเอง</span>`
          : `${n(item.price)} z`}</td></tr>`
    )
    .join("");

  const makes = ref.recipes.filter((r) => r.result === item.id);
  const usedIn = ref.recipes.filter((r) => r.materials.some((m) => m.id === item.id));

  const recipeRow = (r) => `<tr>
    <td class="name">${itemIcon(byId.get(r.result)?.code)}${itemLink(byId.get(r.result))} ${r.count > 1 ? `×${r.count}` : ""}</td>
    <td>${esc(r.skill)} Lv ${r.minSkillLevel}+</td>
    <td class="num">${pct(r.baseChance, 1)}</td>
    <td>${r.materials.map((m) => `${itemLink(byId.get(m.id))} ×${m.amount}`).join("<br>")}</td>
    <td class="num">${n(r.zeny)} z</td>
  </tr>`;

  const ore = ref.oreDiscovery.find((o) => o.id === item.id);

  return `
    <p class="crumbs">${link("#/items", "ไอเท็ม")} / ${esc(item.name)}</p>
    <div class="itemhead">${itemIcon(item.code, 3)}<div>
      <h1>${esc(item.name)}</h1>
      <p class="lede mono">${esc(item.code)} · id ${item.id}</p>
    </div></div>
    <div class="chiprow">${chips.join("")}</div>

    ${item.desc ? `<div class="card"><div class="desc">${richText(item.desc)}</div></div>` : ""}

    <dl class="facts">${spec
      .map(([k, v]) => `<div class="fact"><dt>${esc(k)}</dt><dd>${esc(String(v))}</dd></div>`)
      .join("")}</dl>

    ${item.equipGroup ? `<h2>ใครใส่ได้</h2>
      ${broken
        ? `<div class="note bad"><p><strong>ไม่มีใครใส่ได้</strong></p>
           <p>ไอเท็มนี้ระบุกลุ่มอาชีพ <code>${esc(item.equipGroup)}</code>
           แต่กลุ่มนี้ไม่มีอยู่ใน <code>EquipmentGroups.csv</code> ตัวโหลดจึงหาอาชีพไม่เจอ
           ต่อให้ดรอปได้ก็ใส่ไม่ได้</p></div>`
        : `<p><span class="chip">${esc(item.equipGroup)}</span>
           ${group?.label && group.label !== "<Auto>" ? esc(group.label) : ""}</p>
           <div class="chiprow">${(group?.jobs ?? [])
             .map((j) => link(`#/job/${j}`, j, "chip"))
             .join("")}</div>`}` : ""}

    ${item.effect ? `<h2>ผลจริงจากสคริปต์</h2>
      <p class="lede">นี่คือโค้ดที่เซิร์ฟใช้จริง ถ้าคำอธิบายกับตรงนี้ไม่ตรงกัน ให้เชื่อตรงนี้</p>
      <pre><code>${esc(item.effect)}</code></pre>` : ""}

    <h2>หาได้จากไหน</h2>
    ${dropRows ? `<h3>มอนที่ดรอป</h3>
      <div class="tablewrap"><table>
        <thead><tr><th>มอนสเตอร์</th><th class="num">Lv</th><th>โอกาส</th><th>เกิดที่</th></tr></thead>
        <tbody>${dropRows}</tbody></table></div>` : ""}
    ${shopRows ? `<h3>ร้าน NPC ที่ขาย</h3>
      <div class="tablewrap"><table>
        <thead><tr><th>ร้าน</th><th>แมพ</th><th class="num">ราคาที่ร้านนี้</th></tr></thead>
        <tbody>${shopRows}</tbody></table></div>` : ""}
    ${makes.length ? `<h3>คราฟได้</h3>
      <div class="tablewrap"><table>
        <thead><tr><th>ผลลัพธ์</th><th>สกิล</th><th class="num">โอกาสพื้นฐาน</th><th>วัตถุดิบ</th><th class="num">ค่าใช้จ่าย</th></tr></thead>
        <tbody>${makes.map(recipeRow).join("")}</tbody></table></div>` : ""}
    ${ore ? `<p>ขุดเจอจากสกิล Ore Discovery ด้วยน้ำหนัก ${ore.rate}</p>` : ""}
    ${!dropRows && !shopRows && !makes.length && !ore
      ? `<div class="note warn"><p><strong>ยังไม่มีทางได้มาแบบปกติ</strong></p>
         <p>ไม่มีมอนดรอป ไม่มีร้านขาย ไม่มีสูตรคราฟ เหลือแค่คำสั่ง GM หรือ NPC
         ที่แจกด้วยสคริปต์เฉพาะกิจ</p></div>` : ""}

    ${usedIn.length ? `<h2>ใช้เป็นวัตถุดิบใน</h2>
      <div class="tablewrap"><table>
        <thead><tr><th>ผลลัพธ์</th><th>สกิล</th><th class="num">โอกาสพื้นฐาน</th><th>วัตถุดิบ</th><th class="num">ค่าใช้จ่าย</th></tr></thead>
        <tbody>${usedIn.map(recipeRow).join("")}</tbody></table></div>` : ""}
  `;
}
