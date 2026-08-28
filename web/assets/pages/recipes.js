import { data, index, esc, n, pct, table, filterable, itemLink, link, itemIcon } from "../app.js";

export async function list() {
  const [ref, byId] = await Promise.all([data("reference"), index("itemsById")]);

  const host = document.createElement("div");
  host.innerHTML = `
    <h1>สูตรคราฟและการขุดแร่</h1>
    <p class="lede">${n(ref.recipes.length)} สูตรจาก <code>ProduceRecipes.csv</code></p>
    <div class="note">
      <p><b>เครื่องมือหมดไปทุกครั้งที่ตี</b> ไม่ว่าจะสำเร็จหรือไม่ — หลอมแร่กับหลอมธาตุใช้
      Mini Furnace ส่วนตีอาวุธใช้ค้อนตามระดับอาวุธ: Lv1 ใช้ Iron Hammer · Lv2 ใช้ Golden Hammer ·
      Lv3 ใช้ Oridecon Hammer (อยู่ในช่องวัตถุดิบด้านล่างแล้ว)</p>
      <p><b>ทั่งไม่หมด</b> แค่พกไว้ในกระเป๋าก็เพิ่มโอกาสสำเร็จของ<b>อาวุธ</b> นับเฉพาะอันที่ดีที่สุดอันเดียว
      พกสองอันไม่ได้บวกกัน — Anvil +0% · Oridecon Anvil +3% · Golden Anvil +5% · Emperium Anvil +10%</p>
      <p>ซื้อได้ที่ <b>Christopher</b> สมาคมช่างตีเหล็ก เมือง Geffen (<code>geffen_in</code> 110, 172)
      ยกเว้น Emperium Anvil ที่ออกจากกล่องเก่าอย่างเดียว</p>
    </div>`;

  const body = document.createElement("div");
  host.appendChild(body);

  const skills = [...new Set(ref.recipes.map((r) => r.skill))].sort();
  const rows = ref.recipes.map((r) => ({
    ...r,
    resultName: byId.get(r.result)?.name ?? "",
    matNames: r.materials.map((m) => byId.get(m.id)?.name ?? "").join(" ").toLowerCase(),
  }));

  filterable({
    host: body,
    items: rows,
    controls: [
      { type: "search", key: "q", placeholder: "ชื่อของที่ทำ หรือวัตถุดิบ…",
        test: (r, v) => r.resultName.toLowerCase().includes(v) || r.matNames.includes(v) },
      { key: "skill", label: "สกิล",
        options: [["", "สกิล: ทั้งหมด"], ...skills],
        test: (r, v) => r.skill === v },
    ],
    render: (list) =>
      table(list, [
        { key: "resultName", label: "ได้ของ", cls: "name",
          render: (r) => itemIcon(byId.get(r.result)?.code) + itemLink(byId.get(r.result))
            + (r.count > 1 ? ` ×${r.count}` : "") },
        { key: "skill", label: "สกิลที่ใช้",
          render: (r) => link(`#/skill/${r.skill}`, r.skill) },
        { key: "minSkillLevel", label: "Lv ขั้นต่ำ", num: true },
        { key: "baseChance", label: "โอกาสพื้นฐาน", num: true, render: (r) => pct(r.baseChance, 1) },
        { key: "materials", label: "วัตถุดิบ", sortValue: (r) => r.matNames,
          render: (r) => r.materials.map((m) =>
            `${itemLink(byId.get(m.id))} ×${m.amount}` + (m.tool ? ' <span class="chip">เครื่องมือ</span>' : "")).join("<br>") },
        { key: "zeny", label: "ค่าใช้จ่าย", num: true, render: (r) => `${n(r.zeny)} z` },
      ], { sort: "resultName", dir: "asc" }),
  });

  const ore = ref.oreDiscovery.slice().sort((a, b) => b.rate - a.rate);
  const total = ore.reduce((s, o) => s + o.rate, 0);
  host.insertAdjacentHTML("beforeend", `
    <h2>ขุดแร่ (Ore Discovery)</h2>
    <p class="lede">สกิล Ore Discovery จับฉลากจากตารางนี้ ตัวเลข "น้ำหนัก" ยิ่งมากยิ่งออกบ่อย
    รวมทั้งตาราง ${n(total)}</p>
    <div class="tablewrap"><table>
      <thead><tr><th>แร่</th><th class="num">น้ำหนัก</th><th class="num">สัดส่วน</th></tr></thead>
      <tbody>${ore
        .map((o) => `<tr><td class="name">${itemIcon(byId.get(o.id)?.code)}${itemLink(byId.get(o.id))}</td>
          <td class="num">${n(o.rate)}</td>
          <td class="num">${((o.rate / total) * 100).toFixed(1)}%</td></tr>`)
        .join("")}</tbody>
    </table></div>`);

  return host;
}
