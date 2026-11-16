// What a champion is handed in the ring: a title belt (a broad strap with a gold plate, in the colour of its level)
// or a tournament cup. Built from simple shapes, shown only in the ceremony (ceremony.js moves it). Presentation only.
const THREE = globalThis.THREE;

// strap colours, one per belt from the temple fair up to the world title
const STRAP = [0x8c2a1c, 0x1f4f96, 0x1c6b3c, 0x232329, 0x6a2296, 0xa87a12];

export function buildPrize(scene) {
  const gold = new THREE.MeshStandardMaterial({color: 0xf2c440, metalness: .85, roughness: .26, emissive: 0x5a3c00, emissiveIntensity: .45});
  const gem = new THREE.MeshStandardMaterial({color: 0xc81e2a, metalness: .3, roughness: .2, emissive: 0x500008, emissiveIntensity: .5});
  const strap = new THREE.MeshStandardMaterial({color: STRAP[0], roughness: .6, side: THREE.DoubleSide});
  const add = (g, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; g.add(m); return m; };

  // The belt: its own frame has x ahead (the plate), y up, the waist at the centre. R: the radius it is built at (metres);
  // the ceremony scales it to the champion's own waist.
  const belt = new THREE.Group(), R = .17, H = .1;
  add(belt, new THREE.CylinderGeometry(R, R, H, 32, 1, true), strap);
  add(belt, new THREE.CylinderGeometry(R + .004, R + .004, .012, 32, 1, true), gold, 0, H / 2 - .008);  // gold piping along both edges
  add(belt, new THREE.CylinderGeometry(R + .004, R + .004, .012, 32, 1, true), gold, 0, -H / 2 + .008);
  const disc = (r, t) => { const g = new THREE.CylinderGeometry(r, r, t, 28); g.rotateZ(Math.PI / 2); return g; }; // a plate facing along x
  add(belt, disc(.085, .024), gold, R + .006);                                                        // the main plate
  add(belt, disc(.034, .03), gem, R + .012);
  for (const s of [-1, 1]) { const a = s * .72, p = add(belt, disc(.05, .018), gold, Math.cos(a) * (R + .004), 0, Math.sin(a) * (R + .004)); p.rotation.y = -a; } // a side plate each side

  // The cup: stands on its base at the origin, about 34 cm tall
  const cup = new THREE.Group();
  add(cup, new THREE.CylinderGeometry(.07, .085, .03, 24), gold, 0, .015);
  add(cup, new THREE.CylinderGeometry(.02, .035, .09, 16), gold, 0, .075);
  add(cup, new THREE.SphereGeometry(.03, 16, 10), gold, 0, .13);
  const bowl = new THREE.LatheGeometry([[.025, 0], [.07, .03], [.095, .09], [.105, .17], [.11, .19]].map(p => new THREE.Vector2(p[0], p[1])), 28);
  const bm = add(cup, bowl, gold, 0, .14); bm.material = gold.clone(); bm.material.side = THREE.DoubleSide;
  for (const s of [-1, 1]) { const h = add(cup, new THREE.TorusGeometry(.045, .009, 8, 18, Math.PI), gold, 0, .25, s * .125); h.rotation.set(0, Math.PI / 2, -s * Math.PI / 2); } // a handle each side

  for (const g of [belt, cup]) { g.visible = false; scene.add(g); }
  return {
    // kind: 'belt' or 'cup'; tier: which level (the strap's colour). Returns the object to move about.
    R, // the radius the belt is built at
    get(kind, tier) { strap.color.setHex(STRAP[Math.max(0, Math.min(STRAP.length - 1, tier | 0))]); belt.visible = cup.visible = false; return kind === 'cup' ? cup : belt; },
    hide() { belt.visible = cup.visible = false; }
  };
}
