/** Every tunable of the asset pipeline lives here (no magic numbers in the steps). */
export type ResizeKernel = 'nearest' | 'lanczos';

export const CONFIG = {
  packs: ['01_characters', '02_monsters', '03_icons', '04_ui', '05_effects'] as const,
  rawDir: 'raw',
  outDir: 'assets',
  reportPath: 'docs/ASSET_REPORT.md',

  /** Chosen by the project owner after looking at docs/asset-samples (CLAUDE.md §4.5). */
  resizeKernel: 'lanczos' as ResizeKernel,
  sharpenSigma: 0.5,

  /** Raw alpha is noisy (bodies ~252, background up to ~7); snap it to clean 0/255 edges. */
  alphaOpaqueMin: 128,
  /** Effects sit on black: a pixel counts as "lit" above this max(r,g,b). */
  blackLitMin: 20,

  /** A component is a "body" (its own pose) if it is at least this share of the largest one. */
  bodyAreaShare: 0.2,
  /** Specks smaller than this many pixels are dropped as noise. */
  speckArea: 6,
  /** Erosion radii tried, in order, to break thin bridges between touching poses. */
  erosionRadii: [0, 2, 4, 7],

  /** Tile sheets are full-bleed: look this far around the expected seam for the real one. */
  tileSeamSearch: 48,
  tileSeamInset: 4,

  atlasSize: 2048,
  atlasPadding: 2,
  sceneWebpQuality: 92,

  sampleFiles: [
    ['01_characters', 'char_warrior_t1_sheet.png'],
    ['03_icons', 'icons_relics1.png'],
    ['05_effects', 'fx_explosion.png'],
  ] as const,
  samplesDir: 'docs/asset-samples',
} as const;
