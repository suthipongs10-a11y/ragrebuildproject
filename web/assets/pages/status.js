import { data, esc, n, table, filterable, richText } from "../app.js";

const TYPE_TH = { Buff: "บัฟ", Debuff: "ดีบัฟ" };

export async function list() {
  const status = await data("status");
  const rows = Object.values(status);

  const host = document.createElement("div");
  host.innerHTML = `
    <h1>สถานะผิดปกติและบัฟ</h1>
    <p class="lede">${n(rows.length)} สถานะจาก <code>StatusEffects.toml</code></p>`;

  const body = document.createElement("div");
  host.appendChild(body);

  filterable({
    host: body,
    items: rows,
    controls: [
      { type: "search", key: "q", placeholder: "ชื่อสถานะ หรือคำในคำอธิบาย…",
        test: (s, v) => `${s.name} ${s.code} ${s.descTh ?? ""}`.toLowerCase().includes(v) },
      { key: "type", label: "ชนิด",
        options: [["", "ชนิด: ทั้งหมด"], ...Object.entries(TYPE_TH)],
        test: (s, v) => s.type === v },
    ],
    render: (list) =>
      table(list, [
        { key: "name", label: "สถานะ", cls: "name" },
        { key: "code", label: "รหัส", cls: "mono" },
        { key: "type", label: "ชนิด",
          render: (s) => s.type
            ? `<span class="chip ${s.type === "Debuff" ? "warn" : ""}">${esc(TYPE_TH[s.type] ?? s.type)}</span>`
            : "" },
        { key: "canDispel", label: "โดนดิสเพลได้",
          render: (s) => (s.canDispel ? "ใช่" : s.canDispel === false ? "ไม่" : "") },
        { key: "canDisable", label: "กดออกเองได้",
          render: (s) => (s.canDisable ? "ใช่" : s.canDisable === false ? "ไม่" : "") },
        { key: "descTh", label: "คำอธิบาย", cls: "desc",
          render: (s) => richText(s.descTh ?? "") },
      ], { sort: "name", dir: "asc" }),
  });

  return host;
}
