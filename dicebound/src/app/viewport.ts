/** Design resolution (CLAUDE.md §6). Everything is laid out in these units. */
export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;

export interface ViewportFit {
  readonly cssWidth: number;
  readonly cssHeight: number;
}

/**
 * Letterbox fit: integer scale when the window is at least design-sized (crisp
 * pixels), fractional below that so 1280x720 / 1280x800 still show the full frame.
 */
export function fitViewport(windowWidth: number, windowHeight: number): ViewportFit {
  const raw = Math.min(windowWidth / DESIGN_WIDTH, windowHeight / DESIGN_HEIGHT);
  const scale = raw >= 1 ? Math.floor(raw) : raw;
  return { cssWidth: DESIGN_WIDTH * scale, cssHeight: DESIGN_HEIGHT * scale };
}
