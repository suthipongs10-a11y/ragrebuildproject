import { data, esc, n, table, filterable, link, richText } from "../app.js";

const TARGET_TH = {
  Enemy: "ศัตรู", Self: "ตัวเอง", Ally: "เพื่อน", Ground: "พื้นที่",
  Passive: "พาสซีฟ", Any: "ทุกอย่าง",
};

/** Which trees list a given skill, walking nothing - the tree data is already flat. */
function buildOwners(trees) {
  const owners = new Map();
  for (const [job, tree] of Object.entries(trees)) {
    for (const entry of tree.skills) {
      if (!owners.has(entry.skill)) owners.set(entry.skill, []);
      owners.get(entry.skill).push({ job, prereq: entry.prereq });
    }
  }
  return owners;
}

// --------------------------------------------------------------------- list

export async function list() {
  const skills = await data("skills");
  const owners = buildOwners(skills.trees);
  const rows = Object.values(skills.skills).map((s) => ({
    ...s,
    jobs: (owners.get(s.code) ?? []).map((o) => o.job),
    inTree: owners.has(s.code),
  }));

  const host = document.createElement("div");
  host.innerHTML = `
    <h1>สกิล</h1>
    <p class="lede">${n(rows.length)} สกิลใน <code>Skills.toml</code> —
    ${n(rows.filter((r) => r.inTree).length)} ตัวอยู่ในผังสกิลของอาชีพใดอาชีพหนึ่ง
    ที่เหลือเป็นสกิลของมอนสเตอร์ ของไอเท็ม หรือยังไม่ได้เปิดใช้</p>`;

  const body = document.createElement("div");
  host.appendChild(body);

  const jobs = [...new Set(rows.flatMap((r) => r.jobs))].sort();

  filterable({
    host: body,
    items: rows,
    controls: [
      { type: "search", key: "q", placeholder: "ชื่อสกิล หรือคำในคำอธิบาย…",
        test: (s, v) => `${s.name} ${s.code} ${s.descTh ?? ""}`.toLowerCase().includes(v) },
      { key: "job", label: "อาชีพ",
        options: [["", "อาชีพ: ทั้งหมด"], ...jobs],
        test: (s, v) => s.jobs.includes(v) },
      { key: "target", label: "เป้าหมาย",
        options: [["", "เป้าหมาย: ทั้งหมด"], ...Object.entries(TARGET_TH)],
        test: (s, v) => s.target === v },
      { key: "tree", label: "อยู่ในผัง",
        options: [["", "อยู่ในผัง: ทั้งหมด"], ["yes", "อยู่ในผังอาชีพ"], ["no", "ไม่อยู่ในผัง"]],
        test: (s, v) => (v === "yes" ? s.inTree : !s.inTree) },
    ],
    render: (list) =>
      table(list, [
        { key: "name", label: "สกิล", cls: "name",
          render: (s) => link(`#/skill/${s.code}`, s.name) },
        { key: "code", label: "รหัส", cls: "mono" },
        { key: "maxLevel", label: "Lv สูงสุด", num: true },
        { key: "target", label: "เป้าหมาย", render: (s) => esc(TARGET_TH[s.target] ?? s.target) },
        { key: "jobs", label: "อาชีพ", sortValue: (s) => s.jobs.join(","),
          render: (s) => s.jobs.map((j) => link(`#/job/${j}`, j)).join(", ") },
        { key: "descTh", label: "คำอธิบาย",
          render: (s) => esc((s.descTh ?? s.descEn ?? "").split("\n")[0].slice(0, 90)) },
      ], { sort: "name", dir: "asc" }),
  });

  return host;
}

// ------------------------------------------------------------------- detail

export async function detail({ rest }) {
  const wanted = (rest[0] ?? "").toLowerCase();
  const skills = await data("skills");
  const skill = Object.values(skills.skills).find((s) => s.code.toLowerCase() === wanted);
  if (!skill) return `<h1>ไม่พบสกิล</h1><p>ไม่มีสกิลชื่อ <code>${esc(rest[0])}</code></p>`;

  const owners = buildOwners(skills.trees).get(skill.code) ?? [];

  // Skills.toml stores Params as parallel arrays, one per <1>, <2>… placeholder.
  const max = skill.maxLevel ?? 1;
  const paramCols = (skill.params ?? []).length;
  const perLevel = [];
  for (let lvl = 1; lvl <= max; lvl++) {
    const row = { lvl };
    row.sp = pick(skill.spCost, lvl);
    row.hp = pick(skill.hpCost, lvl);
    row.cast = pick(skill.castTime, lvl);
    row.cool = pick(skill.cooldown, lvl);
    row.range = pick(skill.range, lvl);
    row.params = (skill.params ?? []).map((arr) => pick(arr, lvl));
    perLevel.push(row);
  }

  const showCols = [
    ["sp", "SP"], ["hp", "HP"], ["cast", "เวลาร่าย"], ["cool", "คูลดาวน์"], ["range", "ระยะ"],
  ].filter(([k]) => perLevel.some((r) => r[k] !== undefined && r[k] !== null));

  const levelTable =
    max > 1 || showCols.length || paramCols
      ? `<div class="tablewrap"><table>
          <thead><tr><th class="num">Lv</th>
            ${Array.from({ length: paramCols }, (_, i) => `<th class="num">ค่า &lt;${i + 1}&gt;</th>`).join("")}
            ${showCols.map(([, l]) => `<th class="num">${esc(l)}</th>`).join("")}
          </tr></thead>
          <tbody>${perLevel
            .map(
              (r) => `<tr><td class="num">${r.lvl}</td>
              ${r.params.map((p) => `<td class="num">${p ?? ""}</td>`).join("")}
              ${showCols.map(([k]) => `<td class="num">${r[k] ?? ""}</td>`).join("")}</tr>`
            )
            .join("")}</tbody></table></div>`
      : "";

  const prebuilt = skill.table
    ? `<h2>ตารางจากในเกม</h2>
       <div class="tablewrap"><table>
         <thead><tr>${skill.table.headers.map((x) => `<th>${esc(x)}</th>`).join("")}</tr></thead>
         <tbody>${skill.table.rows
           .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
           .join("")}</tbody></table></div>`
    : "";

  const ownerBlocks = owners
    .map((o) => {
      const pre = o.prereq.length
        ? o.prereq
            .map((p) => `${link(`#/skill/${p.skill}`, skills.skills[p.skill]?.name ?? p.skill)} Lv ${p.level}`)
            .join(", ")
        : "ไม่ต้องมีสกิลอะไรก่อน";
      const points = skills.trees[o.job]?.prereqSkillPoints ?? 0;
      return `<tr><td class="name">${link(`#/job/${o.job}`, o.job)}</td>
        <td>${pre}</td>
        <td class="num">${points ? n(points) : "-"}</td></tr>`;
    })
    .join("");

  // where a skill's <1> placeholders land inside the description text
  const descTh = skill.descTh ? richText(skill.descTh) : "";
  const descEn = skill.descEn ? richText(skill.descEn) : "";

  return `
    <p class="crumbs">${link("#/skills", "สกิล")} / ${esc(skill.name)}</p>
    <h1>${esc(skill.name)}</h1>
    <p class="lede mono">${esc(skill.code)}</p>
    <div class="chiprow">
      <span class="chip">${esc(TARGET_TH[skill.target] ?? skill.target)}</span>
      <span class="chip">Lv สูงสุด ${max}</span>
      ${skill.adjustable ? '<span class="chip mute">เลือกเลเวลที่ใช้ได้</span>' : ""}
      ${skill.element ? `<span class="chip">ธาตุ ${esc(skill.element)}</span>` : ""}
      ${owners.length ? "" : '<span class="chip warn">ไม่อยู่ในผังสกิลอาชีพไหน</span>'}
    </div>

    ${descTh ? `<div class="card"><div class="desc">${descTh}</div></div>` : ""}
    ${!descTh && descEn ? `<div class="card"><div class="desc">${descEn}</div></div>` : ""}

    ${owners.length
      ? `<h2>อาชีพที่เรียนได้</h2>
         <div class="tablewrap"><table>
           <thead><tr><th>อาชีพ</th><th>ต้องมีสกิลอะไรก่อน</th><th class="num">แต้มที่ต้องใช้ไปแล้ว</th></tr></thead>
           <tbody>${ownerBlocks}</tbody></table></div>`
      : `<div class="note warn"><p><strong>สกิลนี้ไม่อยู่ในผังสกิลของอาชีพไหนเลย</strong></p>
         <p>ปกติแปลว่าเป็นสกิลของมอนสเตอร์ สกิลที่การ์ดหรือไอเท็มเรียกใช้ หรือสกิลที่ยังไม่ได้เปิด</p></div>`}

    ${levelTable ? `<h2>ค่าตามเลเวล</h2>
      ${descEn && descTh ? `<p class="lede">คำอธิบายต้นทาง: ${descEn}</p>` : ""}
      ${levelTable}` : ""}

    ${prebuilt}
  `;
}

/** Skills.toml lets a field be a single value, a short array, or one per level. */
function pick(value, level) {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) return value;
  if (!value.length) return undefined;
  return value[Math.min(level - 1, value.length - 1)];
}
