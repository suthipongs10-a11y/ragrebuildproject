import { data, esc, n, link } from "../app.js";

const EXP_CHART_TH = ["Novice", "FirstJob", "SecondJob"];

export async function render({ rest }) {
  const which = rest[0] ?? "exp";
  if (which === "hpsp") return hpsp();
  if (which === "refine") return refine();
  return exp();
}

// ---------------------------------------------------------------------- exp

async function exp() {
  const [charts, jobs] = await Promise.all([data("charts"), data("jobs")]);

  const levels = Object.keys(charts.exp).map(Number).sort((a, b) => a - b);
  let cumulative = 0;
  const rows = levels
    .map((lvl) => {
      const need = charts.exp[lvl];
      cumulative += need;
      return `<tr><td class="num">${lvl}</td><td class="num">${n(need)}</td>
        <td class="num">${n(cumulative)}</td></tr>`;
    })
    .join("");

  const jobCols = EXP_CHART_TH;
  const jobLevels = new Set();
  for (const c of jobCols) for (const l of Object.keys(charts.jobExp[c] ?? {})) jobLevels.add(Number(l));
  const jobRows = [...jobLevels]
    .sort((a, b) => a - b)
    .map(
      (lvl) =>
        `<tr><td class="num">${lvl}</td>${jobCols
          .map((c) => `<td class="num">${charts.jobExp[c]?.[lvl] ? n(charts.jobExp[c][lvl]) : ""}</td>`)
          .join("")}</tr>`
    )
    .join("");

  const totals = jobCols.map(
    (c) => Object.values(charts.jobExp[c] ?? {}).reduce((s, v) => s + v, 0)
  );

  return `
    <h1>ตารางค่าประสบการณ์</h1>
    <p class="lede">ค่าที่แสดงคือ EXP ที่ต้องเก็บ "ในเลเวลนั้น" เพื่อขึ้นเลเวลถัดไป</p>

    <h2>Base Level</h2>
    <p>เก็บครบทุกเลเวลถึง 99 รวม <strong>${n(Object.values(charts.exp).reduce((s, v) => s + v, 0))}</strong> EXP</p>
    <div class="tablewrap" style="max-height:520px;overflow-y:auto">
      <table><thead><tr><th class="num">Level</th><th class="num">EXP ที่ต้องใช้</th>
        <th class="num">สะสม</th></tr></thead><tbody>${rows}</tbody></table></div>

    <h2>Job Level</h2>
    <p>อาชีพไหนใช้ตารางไหนดูได้ที่หน้า${link("#/jobs", "อาชีพ")} —
    รวมทั้งตาราง ${jobCols.map((c, i) => `${c} ${n(totals[i])}`).join(" · ")}</p>
    <div class="tablewrap" style="max-height:520px;overflow-y:auto">
      <table><thead><tr><th class="num">Job Lv</th>
        ${jobCols.map((c) => `<th class="num">${esc(c)}</th>`).join("")}</tr></thead>
        <tbody>${jobRows}</tbody></table></div>
  `;
}

// --------------------------------------------------------------------- hpsp

async function hpsp() {
  const [charts, jobs] = await Promise.all([data("charts"), data("jobs")]);
  const names = jobs.map((j) => j.name).filter((nme) => charts.hp[nme]);
  const shown = names.filter((nme) => !["GameMaster", "PecoKnight", "PecoCrusader"].includes(nme));
  const sample = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 99];

  const build = (chart, title, note) => `
    <h2>${esc(title)}</h2>
    <p class="lede">${note}</p>
    <div class="tablewrap"><table>
      <thead><tr><th>อาชีพ</th>${sample.map((l) => `<th class="num">Lv ${l}</th>`).join("")}</tr></thead>
      <tbody>${shown
        .map(
          (nme) =>
            `<tr><td class="name">${link(`#/job/${nme}`, nme)}</td>${sample
              .map((l) => `<td class="num">${n(chart[nme]?.[l] ?? 0)}</td>`)
              .join("")}</tr>`
        )
        .join("")}</tbody></table></div>`;

  return `
    <h1>ตาราง HP และ SP</h1>
    <div class="note">
      <p><strong>ค่าในตารางเป็นค่าฐาน ยังไม่รวมสเตตัส</strong></p>
      <p>สูตรจริงจาก <code>Player.cs</code>:<br>
      <code>MaxHP = ฐาน × (1 + VIT/100) + AddMaxHp</code><br>
      <code>MaxSP = ฐาน × (1 + INT/100) + AddMaxSp</code><br>
      เช่น Knight เลเวล 90 VIT 80 จะได้ HP = ${n(charts.hp.Knight?.[90] ?? 0)} × 1.80 =
      <strong>${n(Math.floor((charts.hp.Knight?.[90] ?? 0) * 1.8))}</strong></p>
    </div>
    ${build(charts.hp, "HP ฐาน", "คูณด้วย (1 + VIT/100) เพื่อได้ค่าจริง")}
    ${build(charts.sp, "SP ฐาน", "คูณด้วย (1 + INT/100) เพื่อได้ค่าจริง")}
  `;
}

// ------------------------------------------------------------------- refine

async function refine() {
  const charts = await data("charts");
  const rows = charts.refine;
  if (!rows.length) return "<h1>อัตราตีบวก</h1><p>ไม่มีข้อมูล</p>";

  const cols = Object.keys(rows[0]);
  const head = cols
    .map((c) => `<th class="num">${esc(c === "Refine" ? "จาก +" : c)}</th>`)
    .join("");
  const body = rows
    .map(
      (r) =>
        `<tr>${cols
          .map((c) => {
            const v = r[c];
            const numeric = Number(v);
            const style =
              c !== "Refine" && Number.isFinite(numeric)
                ? numeric >= 100 ? "color:#196B35;font-weight:700"
                : numeric <= 40 ? "color:#9B1C1C;font-weight:700" : ""
                : "";
            return `<td class="num" style="${style}">${esc(v)}${c === "Refine" ? "" : "%"}</td>`;
          })
          .join("")}</tr>`
    )
    .join("");

  return `
    <h1>อัตราสำเร็จการตีบวก</h1>
    <p class="lede">อ่านจาก <code>RefineSuccess.csv</code> — คอลัมน์ Level1–4 คือ Weapon Rank
    ของอาวุธ (ยิ่ง rank สูงยิ่งตีบวกยาก) คอลัมน์ Armor ใช้กับเกราะทุกชิ้น</p>
    <div class="note warn">
      <p><strong>ตีบวกพลาดแล้วของหาย</strong> ยกเว้นไอเท็มที่ตั้ง <code>Breakable</code> เป็น No
      ดูได้จากหน้าไอเท็มแต่ละชิ้น</p>
    </div>
    <div class="tablewrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
  `;
}
