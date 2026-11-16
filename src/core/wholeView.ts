// The frame drawn whole, for a view that isn't the game's own: nothing thinned for the hero (core/seeThrough.ts), no fog
// of what he can't see (core/sight.ts), the meadow's grass over all of it (world/meadow.ts). The developer mode's free
// camera sets it (src/dev/freeCam.ts, which production never loads): the game's own views thin, fog and draw the grass
// for where its camera stands, and the free camera flies off from there, from play, "in free cam mode, there is a
// circle beyond which grass disappears, it should not", "also in free cam we should not thin anything". Off unless
// set, uniforms and counts alone: no program is made as it switches. What the game asks for meanwhile is kept by each
// that reads it, and put back as it's let go, with the game frozen too.
let whole = false;
const told: ((whole: boolean) => void)[] = [];

/** Whether the frame is drawn whole. */
export const wholeView = (): boolean => whole;

/** `fn` called as the whole view is taken or let go: what's set a frame of the game's, set at once (a frozen game
 *  has no frame of its own). */
export function onWholeView(fn: (whole: boolean) => void): void {
  told.push(fn);
}

/** The frame drawn whole (`on`) or as the game's own view has it, from the next frame drawn. */
export function setWholeView(on: boolean): void {
  if (on === whole) return;
  whole = on;
  for (const fn of told) fn(on);
}
