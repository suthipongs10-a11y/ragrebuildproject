import { data, index, esc, n, table, filterable, link, itemLink, mapLink } from "../app.js";

export async function list() {
  const [shops, byId, maps] = await Promise.all([
    data("shops"), index("itemsById"), index("mapsByCode"),
  ]);

  const host = document.createElement("div");
  host.innerHTML = `
    <h1>ร้านค้า NPC</h1>
    <p class="lede">${n(shops.length)} ร้าน — ราคาที่โชว์ในหน้าไอเท็มคือราคาหลังปรับด้วย
    <code>OnSetItemPurchasePrice</code> แล้ว</p>`;

  const body = document.createElement("div");
  host.appendChild(body);

  const rows = shops.map((s) => ({
    ...s,
    mapName: maps.get(s.map)?.name ?? s.map,
    itemNames: s.items.map((id) => byId.get(id)?.name ?? "").join(" ").toLowerCase(),
  }));

  filterable({
    host: body,
    items: rows,
    controls: [
      { type: "search", key: "q", placeholder: "ชื่อร้าน แมพ หรือไอเท็มที่ขาย…",
        test: (s, v) => `${s.name} ${s.map} ${s.mapName}`.toLowerCase().includes(v) || s.itemNames.includes(v) },
    ],
    render: (list) =>
      table(list, [
        { key: "name", label: "ร้าน" },
        { key: "mapName", label: "แมพ", cls: "name",
          render: (s) => mapLink(maps.get(s.map), s.map) },
        { key: "pos", label: "พิกัด", cls: "mono", sortValue: (s) => s.x,
          render: (s) => `${s.x}, ${s.y}` },
        { key: "count", label: "จำนวนของ", num: true,
          sortValue: (s) => s.items.length, render: (s) => n(s.items.length) },
        { key: "items", label: "ขายอะไรบ้าง",
          sortValue: (s) => s.itemNames,
          render: (s) => s.items.map((id) => itemLink(byId.get(id))).join(", ") },
      ], { sort: "mapName", dir: "asc" }),
  });

  return host;
}
