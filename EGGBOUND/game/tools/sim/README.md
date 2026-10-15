# tools/sim — balance sims and UI checks

Moved here from the cloud session's scratchpad (2026-10-15) so work can continue on the VPS. Run everything from
`EGGBOUND/game`. Outputs (JSON targets, screenshots, bundles) go to `tools/sim/out/` (gitignored).

```
mkdir -p tools/sim/out
npx esbuild tools/sim/<name>.ts --bundle --platform=node --format=esm --outfile=tools/sim/out/<name>.mjs
node tools/sim/out/<name>.mjs <args>
```

| script | what it does |
|---|---|
| `bossre.ts` | boss stages after boss changes keep their win rates: `old` (record targets, run on the old code via `git stash`) → `easy` (factor on the boss unit → `ZONE_GEN[z].boss.hpMult/atkMult`) → `diff` (factor → `DIFF_K[z][d][4]`) → `check` · `ONLY=zone1,zone2` limits zones |
| `rezone.ts` | same idea for a whole zone when its pool changes (`g.k` + `DIFF_K`, every stage) |
| `peer2.ts` | a new monster against same-role peers: swap-in win rate over three base teams |
| `rarebal.ts` / `rareone.ts` | all-rare team advantage / one rare member, on non-saturated stages (cap: `tests/passives.ts`) |
| `hellcal2.ts` | hell difficulty calibration (team wearing the role kit) |
| `diffcal.ts` / `zonecal4.ts` / `bosscal.ts` | first calibrations of difficulty multipliers, zone `k`, Starborn boss HP |

Each file's header says how it works; several write `tools/sim/out/<name>_<mode>.json` and read it back in the next mode.

## UI checks (Playwright)

```
npm i --no-save playwright && npx playwright install --with-deps chromium   # once per machine
npm run build && node tools/sim/ui-boss.mjs
```
`ui-server.mjs` serves `dist/index.html` with the page head added (mode `none` = every separate file 404, like the
owner's phone in the Artifact app). `ui-boss.mjs` is the template: open zone sheets, start a boss fight through
`window.__eb`, watch the battle state, screenshot to `tools/sim/out/`. Test both 390×780 and 1280×760 when touching UI.
