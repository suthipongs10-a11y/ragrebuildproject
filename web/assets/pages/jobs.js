import { data, esc, n, table, link } from "../app.js";

const STAT_TH = { str: "STR", agi: "AGI", vit: "VIT", int: "INT", dex: "DEX", luk: "LUK" };

// Jobs.csv keeps three rows that are not classes you roll - a GM body and the two
// mounted forms a Knight/Crusader swaps into.
const NOT_A_CLASS = new Set(["GameMaster", "PecoKnight", "PecoCrusader"]);

const EXP_CHART_TH = ["Novice", "FirstJob", "SecondJob"];

// -------------------------------------------------------------------- shared

export async function jobBundle() {
  const [jobs, charts, skills] = await Promise.all([
    data("jobs"), data("charts"), data("skills"),
  ]);
  return { jobs, charts, skills };
}

function hpAt(charts, job, level) {
  const row = charts.hp[job];
  return row?.[level] ?? 0;
}

function spAt(charts, job, level) {
  const row = charts.sp[job];
  return row?.[level] ?? 0;
}

// --------------------------------------------------------------------- list

export async function list() {
  const { jobs, charts, skills } = await jobBundle();

  const rows = jobs
    .filter((j) => !NOT_A_CLASS.has(j.name))
    .map((j) => {
      const tree = skills.trees[j.name];
      return {
        ...j,
        rank: tree ? tree.jobRank : j.expChart,
        skillCount: tree ? tree.skills.length : 0,
        hp99: hpAt(charts, j.name, 99),
        sp99: spAt(charts, j.name, 99),
        playable: !!tree,
      };
    });

  const host = document.createElement("div");
  host.innerHTML = `
    <h1>อาชีพ</h1>
    <p class="lede">HP/SP ในตารางคือค่าฐานที่ Base Level 99 ก่อนคูณ VIT/INT
    (สูตรจริง: <code>HP = ฐาน × (1 + VIT/100)</code>)</p>
    <div class="note warn">
      <p><strong>อาชีพที่ยังไม่มีผังสกิลจะเล่นไม่ได้เต็มที่</strong></p>
      <p>มีแค่ ${n(Object.keys(skills.trees).length)} อาชีพที่มีผังสกิลใน <code>SkillTree.toml</code>
      อาชีพอื่นเปลี่ยนไปได้แต่ยังลงสกิลไม่ได้</p>
    </div>`;
  const body = document.createElement("div");
  host.appendChild(body);

  body.appendChild(
    table(rows, [
      { key: "name", label: "อาชีพ", cls: "name",
        render: (j) => link(`#/job/${j.name}`, j.name) +
          (j.playable ? "" : ' <span class="chip warn">ยังไม่มีผังสกิล</span>') },
      { key: "id", label: "id", num: true },
      { key: "rank", label: "ขั้น", num: true },
      { key: "maxJobLevel", label: "Job Lv สูงสุด", num: true },
      { key: "skillCount", label: "สกิลในผัง", num: true },
      { key: "hp99", label: "HP ฐาน @99", num: true, render: (j) => n(j.hp99) },
      { key: "sp99", label: "SP ฐาน @99", num: true, render: (j) => n(j.sp99) },
      { key: "expChart", label: "ตาราง Job EXP",
        render: (j) => esc(EXP_CHART_TH[j.expChart] ?? String(j.expChart)) },
    ], { sort: "id", dir: "asc" })
  );

  return host;
}

// ------------------------------------------------------------------- detail

export async function detail({ rest }) {
  const wanted = (rest[0] ?? "").toLowerCase();
  const { jobs, charts, skills } = await jobBundle();
  const job = jobs.find((j) => j.name.toLowerCase() === wanted);
  if (!job) return `<h1>ไม่พบอาชีพ</h1><p>ไม่มีอาชีพชื่อ <code>${esc(rest[0])}</code></p>`;

  const tree = skills.trees[job.name];
  const bonuses = charts.statBonus[job.name] ?? [];

  // running totals so a player can read "at job 40 I have +6 STR" straight off
  const running = { str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0 };
  const bonusRows = [];
  for (let lvl = 1; lvl <= job.maxJobLevel; lvl++) {
    const stat = bonuses[lvl - 1];
    if (stat && stat !== "0" && running[stat] !== undefined) running[stat] += 1;
    if (stat && stat !== "0") {
      bonusRows.push({ lvl, stat, total: { ...running } });
    }
  }
  const totalBonus = Object.entries(running).filter(([, v]) => v > 0);

  const hpRow = charts.hp[job.name];
  const spRow = charts.sp[job.name];
  const sample = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 99].filter((l) => l <= 99);
  const curveRows = hpRow
    ? sample
        .map(
          (l) =>
            `<tr><td class="num">${l}</td><td class="num">${n(hpRow[l])}</td>
             <td class="num">${n(spRow?.[l] ?? 0)}</td>
             <td class="num">${n(Math.floor(hpRow[l] * 1.5))}</td>
             <td class="num">${n(Math.floor(hpRow[l] * 2))}</td></tr>`
        )
        .join("")
    : "";

  const jobExpTable = charts.jobExp[EXP_CHART_TH[job.expChart]] ?? {};
  const jobExpTotal = Object.entries(jobExpTable)
    .filter(([lvl]) => Number(lvl) < job.maxJobLevel)
    .reduce((s, [, v]) => s + v, 0);

  // walk the extends chain so the page shows everything this job can actually learn
  const chain = [];
  for (let t = tree; t; t = skills.trees[t.extends]) chain.unshift(t);

  const treeBlocks = chain
    .map((t) => {
      const rows = t.skills
        .map((entry) => {
          const s = skills.skills[entry.skill];
          const pre = entry.prereq.length
            ? entry.prereq
                .map((p) => `${link(`#/skill/${p.skill}`, skills.skills[p.skill]?.name ?? p.skill)} Lv ${p.level}`)
                .join(", ")
            : "<em>ไม่ต้องมีอะไรก่อน</em>";
          return `<tr>
            <td class="name">${link(`#/skill/${entry.skill}`, s?.name ?? entry.skill)}</td>
            <td class="num">${s?.maxLevel ?? "?"}</td>
            <td>${esc(s?.target ?? "")}</td>
            <td>${pre}</td>
          </tr>`;
        })
        .join("");
      return `<h3>สกิลของ ${esc(t.job)}${t.job !== job.name ? " (ติดตัวมาจากอาชีพก่อนหน้า)" : ""}</h3>
        <div class="tablewrap"><table>
          <thead><tr><th>สกิล</th><th class="num">Lv สูงสุด</th><th>เป้าหมาย</th><th>ต้องมีสกิลอะไรก่อน</th></tr></thead>
          <tbody>${rows}</tbody></table></div>`;
    })
    .join("");

  return `
    <p class="crumbs">${link("#/jobs", "อาชีพ")} / ${esc(job.name)}</p>
    <h1>${esc(job.name)}</h1>
    <div class="chiprow">
      <span class="chip">id ${job.id}</span>
      <span class="chip">ขั้น ${tree ? tree.jobRank : job.expChart}</span>
      <span class="chip">Job Lv สูงสุด ${job.maxJobLevel}</span>
      ${tree ? "" : '<span class="chip warn">ยังไม่มีผังสกิล</span>'}
    </div>

    ${tree ? "" : `<div class="note bad">
      <p><strong>อาชีพนี้ยังลงสกิลไม่ได้</strong></p>
      <p>ไม่มีผังสกิลใน <code>SkillTree.toml</code> กดปุ่มใช้แต้มสกิลจะขึ้นข้อความบอกว่าใช้ไม่ได้</p></div>`}

    ${tree && tree.prereqSkillPoints ? `<div class="note">
      <p><strong>ต้องใช้แต้มสกิลไปแล้ว ${n(tree.prereqSkillPoints)} แต้ม ถึงจะลงสกิลของอาชีพนี้ได้</strong></p>
      <p>เซิร์ฟบวกแต้มสูงสุดของอาชีพก่อนหน้าทั้งสายเข้าด้วยกัน
      ${esc(chain.slice(0, -1).map((t) => t.job).join(" → "))} รวมกันได้ ${n(tree.prereqSkillPoints)} แต้ม
      ถ้ายังใช้ไม่ครบ ปุ่มลงสกิลจะยังกดไม่ได้แม้เงื่อนไขสกิลอื่นจะผ่านแล้ว</p></div>` : ""}

    <dl class="facts">
      <div class="fact"><dt>HP ฐาน @Lv99</dt><dd>${n(hpRow?.[99] ?? 0)}</dd></div>
      <div class="fact"><dt>SP ฐาน @Lv99</dt><dd>${n(spRow?.[99] ?? 0)}</dd></div>
      <div class="fact"><dt>Job EXP รวมจนเต็ม</dt><dd>${n(jobExpTotal)}</dd></div>
      <div class="fact"><dt>ตาราง Job EXP</dt><dd>${esc(EXP_CHART_TH[job.expChart] ?? job.expChart)}</dd></div>
    </dl>

    ${curveRows ? `<h2>HP และ SP ตามเลเวล</h2>
      <p class="lede">คอลัมน์ VIT คือค่าจริงหลังคูณ <code>ฐาน × (1 + VIT/100)</code></p>
      <div class="tablewrap"><table>
        <thead><tr><th class="num">Base Lv</th><th class="num">HP ฐาน</th><th class="num">SP ฐาน</th>
          <th class="num">HP ที่ VIT 50</th><th class="num">HP ที่ VIT 100</th></tr></thead>
        <tbody>${curveRows}</tbody></table></div>` : ""}

    ${bonusRows.length ? `<h2>โบนัสสเตตัสตาม Job Level</h2>
      <p class="lede">รวมทั้งหมด ${totalBonus.map(([k, v]) => `${STAT_TH[k]} +${v}`).join(" · ")}</p>
      <div class="tablewrap"><table>
        <thead><tr><th class="num">Job Lv</th><th>ได้อะไร</th>
          ${Object.keys(STAT_TH).map((k) => `<th class="num">${STAT_TH[k]}</th>`).join("")}</tr></thead>
        <tbody>${bonusRows
          .map(
            (r) => `<tr><td class="num">${r.lvl}</td><td><strong>${STAT_TH[r.stat] ?? r.stat} +1</strong></td>
              ${Object.keys(STAT_TH).map((k) => `<td class="num">${r.total[k] || ""}</td>`).join("")}</tr>`
          )
          .join("")}</tbody></table></div>` : ""}

    ${treeBlocks ? `<h2>ผังสกิล</h2>${treeBlocks}` : ""}
  `;
}
