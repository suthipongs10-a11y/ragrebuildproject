// Shell for the guide site: data loading, hash routing, global search.
// Every page module exports render(params) and gets a fresh <main> to fill.

import { routes } from "./routes.js";

// ---------------------------------------------------------------- data cache

const cache = new Map();
const inflight = new Map();

export async function data(name) {
  if (cache.has(name)) return cache.get(name);
  if (inflight.has(name)) return inflight.get(name);
  const p = fetch(`data/${name}.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`โหลด ${name}.json ไม่ได้ (${r.status})`);
      return r.json();
    })
    .then((json) => {
      cache.set(name, json);
      inflight.delete(name);
      return json;
    });
  inflight.set(name, p);
  return p;
}

/** Load several files at once and hand them back in the order asked for. */
export function loadAll(...names) {
  return Promise.all(names.map(data));
}

// Indexes built once, on first use, so page modules can look things up by key.
const indexes = {};

export async function index(name) {
  if (indexes[name]) return indexes[name];
  switch (name) {
    case "itemsById": {
      const items = await data("items");
      indexes[name] = new Map(items.map((i) => [i.id, i]));
      break;
    }
    case "itemsByCode": {
      const items = await data("items");
      indexes[name] = new Map(items.map((i) => [i.code, i]));
      break;
    }
    case "monstersByCode": {
      const mons = await data("monsters");
      indexes[name] = new Map(mons.map((m) => [m.code, m]));
      break;
    }
    case "mapsByCode": {
      const maps = await data("maps");
      indexes[name] = new Map(maps.map((m) => [m.code, m]));
      break;
    }
    default:
      throw new Error(`ไม่รู้จัก index ${name}`);
  }
  return indexes[name];
}

// ------------------------------------------------------------------ helpers

export function h(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content;
}

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

export function n(value) {
  return Number(value ?? 0).toLocaleString("en-US");
}

/** Drop and skill chances are stored per ten thousand across the whole codebase. */
export function pct(perTenThousand, digits = 2) {
  return `${(perTenThousand / 100).toFixed(digits)}%`;
}

/** Respawn timers, written the way a player would say them. */
export function duration(msValue) {
  if (msValue == null) return "";
  const sec = Math.round(msValue / 1000);
  if (sec < 60) return `${sec} วิ`;
  const min = Math.floor(sec / 60);
  const rest = sec % 60;
  if (min < 60) return rest ? `${min} นาที ${rest} วิ` : `${min} นาที`;
  const hr = Math.floor(min / 60);
  const restMin = min % 60;
  return restMin ? `${hr} ชม. ${restMin} นาที` : `${hr} ชม.`;
}

/** "2 นาที" or "14–15 นาที" depending on whether the window has spread. */
export function respawnRange(low, high) {
  if (low == null) return "";
  return low === high ? duration(low) : `${duration(low)} – ${duration(high)}`;
}

export function ms(value) {
  return value >= 1000 ? `${(value / 1000).toFixed(2)} วิ` : `${value} ms`;
}

export function link(href, text, cls = "") {
  return `<a href="${href}"${cls ? ` class="${cls}"` : ""}>${esc(text)}</a>`;
}

export function itemLink(item) {
  return item ? link(`#/item/${item.id}`, item.name) : "<em>ไม่พบไอเท็ม</em>";
}

export function monsterLink(mon) {
  return mon ? link(`#/monster/${mon.code}`, mon.name) : "<em>ไม่พบมอนสเตอร์</em>";
}

export function mapLink(map, fallbackCode) {
  if (map) return link(`#/map/${map.code}`, map.name);
  return `<span class="chip mute" title="แมพนี้ไม่มีใน Maps.csv">${esc(fallbackCode ?? "?")}</span>`;
}

// --------------------------------------------------- Unity rich text -> HTML

const CARD_BG = [0xDA, 0xEA, 0xF4]; // --card, where descriptions are rendered

function luminance([r, g, b]) {
  const f = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * The colours in ItemDescriptions were picked for the in-game panel and several
 * of them (plain #808080 most of all) do not reach 4.5:1 on this page. Keep the
 * hue, walk it toward black until it is readable.
 */
function readable(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  let rgb = [(int >> 16) & 255, (int >> 8) & 255, int & 255];
  for (let i = 0; i < 20 && contrast(rgb, CARD_BG) < 4.5; i++) {
    rgb = rgb.map((c) => Math.max(0, Math.round(c * 0.85)));
    if (rgb.every((c) => c === 0)) break;
  }
  return `rgb(${rgb.join(",")})`;
}

/** Render the Unity markup used by ItemDescriptions and SkillDescriptions. */
export function richText(text) {
  if (!text) return "";
  let out = esc(text);
  out = out.replace(/&lt;color=([^&]+?)&gt;/gi, (_, c) => {
    const col = readable(c);
    return col ? `<span style="color:${col}">` : "<span>";
  });
  out = out.replace(/&lt;\/color&gt;/gi, "</span>");
  out = out.replace(/&lt;desc&gt;/gi, '<span class="flavour">')
           .replace(/&lt;\/desc&gt;/gi, "</span>");
  out = out.replace(/&lt;(i|b)&gt;/gi, "<$1>").replace(/&lt;\/(i|b)&gt;/gi, "</$1>");
  out = out.replace(/&lt;(skill|race|status)&gt;/gi, '<span class="tagword">')
           .replace(/&lt;\/(skill|race|status)&gt;/gi, "</span>");
  return out;
}

export function facts(pairs) {
  const cells = pairs
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `<div class="fact"><dt>${esc(k)}</dt><dd>${v}</dd></div>`)
    .join("");
  return `<dl class="facts">${cells}</dl>`;
}

/**
 * Sortable, filterable table. `cols` entries are
 * {key, label, num?, render?(row), sortValue?(row), width?}.
 */
export function table(rows, cols, opts = {}) {
  const state = { key: opts.sort ?? null, dir: opts.dir ?? "asc" };
  const wrap = document.createElement("div");
  wrap.className = "tablewrap";
  const el = document.createElement("table");
  wrap.appendChild(el);

  const sortValue = (row, col) => {
    if (col.sortValue) return col.sortValue(row);
    const v = row[col.key];
    return typeof v === "string" ? v.toLowerCase() : v ?? 0;
  };

  function draw() {
    let body = rows;
    if (state.key) {
      const col = cols.find((c) => c.key === state.key);
      const mul = state.dir === "asc" ? 1 : -1;
      body = rows.slice().sort((a, b) => {
        const av = sortValue(a, col);
        const bv = sortValue(b, col);
        if (av === bv) return 0;
        return av > bv ? mul : -mul;
      });
    }
    el.innerHTML =
      `<thead><tr>${cols
        .map((c) => {
          const on = state.key === c.key ? ` ${state.dir}` : "";
          return `<th class="sortable${on}${c.num ? " num" : ""}" data-key="${c.key}"${
            c.width ? ` style="width:${c.width}"` : ""
          }>${esc(c.label)}</th>`;
        })
        .join("")}</tr></thead>` +
      `<tbody>${body
        .map(
          (row) =>
            `<tr>${cols
              .map(
                (c) =>
                  `<td class="${c.num ? "num" : ""}${c.cls ? ` ${c.cls}` : ""}">${
                    c.render ? c.render(row) : esc(row[c.key] ?? "")
                  }</td>`
              )
              .join("")}</tr>`
        )
        .join("")}</tbody>`;
  }

  el.addEventListener("click", (ev) => {
    const th = ev.target.closest("th.sortable");
    if (!th) return;
    const key = th.dataset.key;
    if (state.key === key) state.dir = state.dir === "asc" ? "desc" : "asc";
    else {
      state.key = key;
      state.dir = cols.find((c) => c.key === key)?.num ? "desc" : "asc";
    }
    draw();
  });

  draw();
  return wrap;
}

/** Wires a text box + selects to a list, redrawing into `host` on every change. */
export function filterable({ host, items, controls, render, empty = "ไม่พบรายการที่ตรงกับเงื่อนไข" }) {
  const bar = document.createElement("div");
  bar.className = "toolbar";
  const state = {};

  for (const c of controls) {
    if (c.type === "search") {
      state[c.key] = "";
      const input = document.createElement("input");
      input.type = "search";
      input.placeholder = c.placeholder ?? "ค้นหา…";
      input.addEventListener("input", () => {
        state[c.key] = input.value.trim().toLowerCase();
        draw();
      });
      bar.appendChild(input);
    } else {
      state[c.key] = c.value ?? "";
      const label = document.createElement("label");
      label.textContent = c.label;
      const sel = document.createElement("select");
      sel.innerHTML = c.options
        .map((o) => {
          const [val, text] = Array.isArray(o) ? o : [o, o];
          return `<option value="${esc(val)}"${val === state[c.key] ? " selected" : ""}>${esc(text)}</option>`;
        })
        .join("");
      sel.addEventListener("change", () => {
        state[c.key] = sel.value;
        draw();
      });
      label.appendChild(sel);
      bar.appendChild(label);
    }
  }

  const count = document.createElement("span");
  count.className = "count";
  bar.appendChild(count);

  const list = document.createElement("div");
  host.appendChild(bar);
  host.appendChild(list);

  function draw() {
    let out = items;
    for (const c of controls) {
      const v = state[c.key];
      if (v === "" || v === undefined) continue;
      out = out.filter((row) => c.test(row, v));
    }
    count.textContent = `${out.length.toLocaleString("en-US")} รายการ`;
    list.innerHTML = "";
    if (!out.length) {
      list.innerHTML = `<p class="empty-state">${esc(empty)}</p>`;
      return;
    }
    const node = render(out);
    if (node instanceof Node) list.appendChild(node);
    else list.innerHTML = node;
  }

  draw();
  return { redraw: draw, state };
}

// ------------------------------------------------------------------- router

const main = document.getElementById("main");

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [path, query] = raw.split("?");
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  return { parts, query: new URLSearchParams(query ?? "") };
}

let renderToken = 0;

async function route() {
  const token = ++renderToken;
  const { parts, query } = parseHash();
  const key = parts[0] ?? "";
  const entry = routes[key] ?? routes[""];

  main.innerHTML = '<div class="loading">กำลังโหลด…</div>';
  markActiveNav();

  try {
    const view = await entry({ parts, query, rest: parts.slice(1) });
    if (token !== renderToken) return; // a newer navigation won
    main.innerHTML = "";
    if (view instanceof Node) main.appendChild(view);
    else main.innerHTML = view ?? "";
    document.title = (main.querySelector("h1")?.textContent ?? "คู่มือ") +
      " · Ragnarok Rebuild";
    // scrollIntoView would tuck the heading under the sticky header, so go to the
    // very top of the document instead
    window.scrollTo(0, 0);
  } catch (err) {
    if (token !== renderToken) return;
    console.error(err);
    main.innerHTML = `<div class="error"><strong>เปิดหน้านี้ไม่ได้</strong><br>${esc(err.message)}</div>`;
  }
}

function markActiveNav() {
  const here = location.hash || "#/";
  document.querySelectorAll(".sidenav a").forEach((a) => {
    a.classList.toggle("active", a.getAttribute("href") === here);
  });
  document.body.classList.remove("nav-open");
  document.getElementById("scrim").hidden = true;
  document.getElementById("navtoggle").setAttribute("aria-expanded", "false");
}

// ------------------------------------------------------------------- search

let searchIndex = null;

async function buildSearchIndex() {
  if (searchIndex) return searchIndex;
  const [monsters, items, maps, skills, jobs] = await loadAll(
    "monsters", "items", "maps", "skills", "jobs"
  );
  // `rank` breaks ties between kinds - a player typing "poring" wants the monster,
  // not the map called poring_c01. `body` holds the Thai text so Thai queries hit
  // something even though every name in the game data is English.
  const rows = [];
  for (const m of monsters) {
    rows.push({ kind: "มอน", rank: 0, name: m.name, alt: m.code,
                sub: `Lv ${m.level}`, href: `#/monster/${m.code}` });
  }
  for (const i of items) {
    rows.push({ kind: "ไอเท็ม", rank: 1, name: i.name, alt: i.code,
                sub: i.type, body: i.desc ?? "", href: `#/item/${i.id}` });
  }
  for (const s of Object.values(skills.skills)) {
    rows.push({ kind: "สกิล", rank: 2, name: s.name, alt: s.code,
                sub: `สูงสุด Lv ${s.maxLevel}`, body: s.descTh ?? "", href: `#/skill/${s.code}` });
  }
  for (const j of jobs) {
    rows.push({ kind: "อาชีพ", rank: 3, name: j.name, alt: String(j.id),
                sub: `Job Lv ${j.maxJobLevel}`, href: `#/job/${j.name}` });
  }
  for (const m of maps) {
    rows.push({ kind: "แมพ", rank: 4, name: m.name, alt: m.code,
                sub: m.code, href: `#/map/${m.code}` });
  }
  for (const r of rows) {
    r.hay = `${r.name} ${r.alt}`.toLowerCase();
    if (r.body) r.body = r.body.toLowerCase();
  }
  searchIndex = rows;
  return rows;
}

function scoreMatch(row, q) {
  const name = row.name.toLowerCase();
  const alt = row.alt.toLowerCase();
  if (name === q || alt === q) return 0;
  if (name.startsWith(q) || alt.startsWith(q)) return 1;
  const at = row.hay.indexOf(q);
  if (at >= 0) return 2 + at / 100;
  // last resort: the Thai description. Ranked well below any name match.
  return row.body && row.body.includes(q) ? 40 : Infinity;
}

function setupSearch() {
  const form = document.getElementById("searchform");
  const input = document.getElementById("q");
  const box = document.getElementById("suggest");
  let results = [];
  let cursor = -1;

  const close = () => {
    box.hidden = true;
    cursor = -1;
  };

  async function run() {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) return close();
    const rows = await buildSearchIndex();
    results = rows
      .map((r) => ({ r, s: scoreMatch(r, q) }))
      .filter((x) => x.s !== Infinity)
      .sort((a, b) => a.s - b.s || a.r.rank - b.r.rank || a.r.name.length - b.r.name.length)
      .slice(0, 20)
      .map((x) => x.r);
    cursor = -1;
    box.hidden = false;
    box.innerHTML = results.length
      ? results
          .map(
            (r) =>
              `<a href="${r.href}"><span class="kind">${esc(r.kind)}</span>` +
              `<span>${esc(r.name)}</span><span class="sub">${esc(r.sub)}</span></a>`
          )
          .join("")
      : '<div class="empty">ไม่พบอะไรเลย</div>';
  }

  let timer;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(run, 110);
  });
  input.addEventListener("focus", () => {
    if (input.value.trim().length >= 2) run();
  });

  input.addEventListener("keydown", (ev) => {
    if (box.hidden) return;
    const links = [...box.querySelectorAll("a")];
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      cursor += ev.key === "ArrowDown" ? 1 : -1;
      if (cursor < 0) cursor = links.length - 1;
      if (cursor >= links.length) cursor = 0;
      links.forEach((a, i) => a.classList.toggle("on", i === cursor));
      links[cursor]?.scrollIntoView({ block: "nearest" });
    } else if (ev.key === "Enter" && cursor >= 0) {
      ev.preventDefault();
      location.hash = links[cursor].getAttribute("href");
      input.blur();
      close();
    } else if (ev.key === "Escape") {
      close();
      input.blur();
    }
  });

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (results[0]) location.hash = results[0].href;
    input.blur();
    close();
  });

  box.addEventListener("click", () => {
    input.value = "";
    close();
  });

  document.addEventListener("click", (ev) => {
    if (!form.contains(ev.target)) close();
  });

  // "/" focuses search the way every wiki does
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "/" && document.activeElement !== input && !ev.metaKey && !ev.ctrlKey) {
      ev.preventDefault();
      input.focus();
      input.select();
    }
  });
}

// -------------------------------------------------------------------- start

function setupNav() {
  const toggle = document.getElementById("navtoggle");
  const scrim = document.getElementById("scrim");
  toggle.addEventListener("click", () => {
    const open = !document.body.classList.contains("nav-open");
    document.body.classList.toggle("nav-open", open);
    scrim.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
  });
  scrim.addEventListener("click", () => {
    document.body.classList.remove("nav-open");
    scrim.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
  });
}

async function stampFooter() {
  try {
    const meta = await data("meta");
    document.getElementById("navfoot").innerHTML =
      `ข้อมูลอัปเดต ${esc(meta.generated)}<br>` +
      `มอน ${n(meta.counts.monsters)} · ไอเท็ม ${n(meta.counts.items)} · แมพ ${n(meta.counts.maps)}`;
  } catch {
    document.getElementById("navfoot").textContent = "";
  }
}

window.addEventListener("hashchange", route);

setupNav();
setupSearch();
stampFooter();
if (!location.hash) location.hash = "#/";
route();
