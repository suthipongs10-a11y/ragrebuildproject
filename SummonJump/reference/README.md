# reference/
- demo_v3.html — playable prototype (single file, art embedded). Baseline for feel: movement, combat, RO damage numbers, spirit ultimate, menus.
- demo_v3_src/ — readable source of the prototype (game1–5.js, shell.html, _tiles.js). Port mechanics from here; do not copy the single-file structure.
- legacy_art/ — processed WebP of the first 45 ChatGPT images + manifest.json (layer ground/platform top lines, hero parts crop boxes). Import as pack P00_legacy.
- Hero rig pivots (parts-sheet pixel coords): head [225,392], torso [715,483], uarm [1050,165], farm [1340,175], thigh [180,578], shin [515,592], scarf [1090,628], sword grip [1255,645]. Torso attach points: neck (-25,-365), shoulder (-15,-288), back elbow (-167,-105), scarf (-75,-345); hip at torso pivot; knee offset (-20,327).
