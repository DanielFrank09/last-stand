// `lab pace`: the hero walking on a screen whose browser times its frames on another screen's ticks (#552, from play:
// "playing on a secondary monitor with lower refresh rate lags"). Chrome on Windows gave a window on a 60 Hz monitor
// beside a 145 Hz one its frames on the 145 Hz ticks: 2 and 3 of them in turn, 13.8 and 20.7 ms, while the screen
// showed each frame for 16.7 (traces T9NG-CZ79, GYKX-N2GP, 0HSJ-60QV). Stepped by those, the hero went a half further
// in one shown frame than in the next, every frame. Each frame's step is measured against the time the screen shows
// it, as a pace (m/s as shown), and judged by its jerk: how far a frame's pace stands off the mean of the frames
// either side of it, a share of the steady pace, at most `MOST_JERK`. A judder flips from frame to frame; the hero's
// own stride (`entities/movement.ts`, pushing off each foot) changes his pace over a step, which is many frames, and a
// pace judged against its median read his stride as a 7% judder at an even 60. The game's step (`G.dt`) against the
// time shown is reported beside it, and the game's time must keep the frames' clock. The scenarios: an even 60 (the
// lab's own clock), a 60 Hz screen timed on 145 Hz ticks, and the window moved from a 144 Hz screen to the 60 Hz one
// mid-walk (`lab.showOn`). `canary` steps the ticked screen's frames as they come (`holdFramePace` in
// `src/core/framePace.ts`), as main did: its judder must be found.
import type { Fixture, Lab, Report } from './lab';
import { G } from '../../../src/state';

declare global {
  interface Window {
    /** the game's pacing held (`holdFramePace`, a dev build's): absent on a commit from before it, as an A/B's main */
    __holdFramePace?: (on: boolean) => void;
  }
}

/** Holds the game's frames stepped as they come while `on`; false where the game has no pacing to hold. */
function holdPace(on: boolean): boolean {
  if (!window.__holdFramePace) return false;
  window.__holdFramePace(on);
  return true;
}

/** What `lab pace` is given: the set-up, the scenarios, and whether the canary runs. */
export interface PaceOptions { fixture: Fixture; scenarios: PaceScenario[]; canary: boolean }

/** A screen and the ticks its browser times frames on: the rate it shows (Hz), the ticks' (Hz), and its size. */
interface Screen { shows: number; ticks: number; width: number; height: number }

/** The scenarios, each a screen or two the window is on in turn. */
export type PaceScenario = 'even' | 'ticked' | 'moved';

const SIXTY_EVEN: Screen = { shows: 60, ticks: 60, width: 1920, height: 1080 };
const SIXTY_TICKED: Screen = { shows: 60, ticks: 145, width: 1920, height: 1080 };
const FAST: Screen = { shows: 144, ticks: 144, width: 2560, height: 1440 };

/** each scenario's screens, the window on each for `FRAMES_ON` frames in turn */
const SCREENS: Record<PaceScenario, Screen[]> = {
  even: [SIXTY_EVEN],
  ticked: [SIXTY_TICKED],
  moved: [FAST, SIXTY_TICKED],
};

/** the frames on each screen, and those of it left out as he starts walking or the window moves (they settle) */
const FRAMES_ON = 180;
const SETTLE_FRAMES = 40;
/** the most a shown frame's pace may stand off the mean of the frames either side of it, a share of the steady pace */
const MOST_JERK = 0.06;
/** the frames' clock's grid (ms): every time the lab's clock hands out is on it */
const GRID = 1 / 1024;

/** One frame: the time the screen showed it for (ms), how far the hero went in it (m), and the game's step (s). */
interface Shown { shownMs: number; step: number; dt: number }

/** What the window on one screen found: the most jerk of his pace, and the most the game's step strayed. */
interface OnScreen { jerk: number; dtStray: number }

/** What a scenario found: each screen's, how far he went, and how far the game's time left the frames' clock. */
interface Walked { screens: OnScreen[]; walked: number; timeGapMs: number }

/** `ms` on the clock's grid. */
const onGrid = (ms: number): number => Math.round(ms / GRID) * GRID;

/** When the browser times the frame the screen shows at `shownMs`: at the next of its ticks, on the clock's grid. */
function timedAt(screen: Screen, shownMs: number): number {
  const tick = 1000 / screen.ticks;
  return onGrid(Math.ceil(shownMs / tick - 1e-9) * tick);
}

/** The middle of a list of numbers. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** The most a value stands off the mean of its two neighbours, a share of the values' median. */
function jerkOf(values: number[]): number {
  const steady = median(values);
  let most = 0;
  for (let i = 1; i < values.length - 1; i++) {
    const between = (values[i - 1] + values[i + 1]) / 2;
    most = Math.max(most, Math.abs(values[i] - between) / steady);
  }
  return most;
}

/** The most a value strays from the values' median, a share of it. */
function strayOf(values: number[]): number {
  const steady = median(values);
  return Math.max(...values.map((value) => Math.abs(value - steady) / steady));
}

/** What the frames on a screen found. */
function judgedOn(frames: Shown[]): OnScreen {
  const paces = frames.map((frame) => frame.step / frame.shownMs);
  const steps = frames.map((frame) => (frame.dt * 1000) / frame.shownMs);
  return { jerk: jerkOf(paces), dtStray: strayOf(steps) };
}

/** The hero walked across `screens` in turn, each frame timed as its browser times it. */
async function walk(lab: Lab, fixture: Fixture, screens: Screen[]): Promise<Walked> {
  await lab.setup(fixture);
  const clock = window.__labClock;
  const wasFrame = clock.frame;
  const found: OnScreen[] = [];
  const start = lab.player.pos.clone();
  const timeStart = G.time;
  const clockStart = clock.t;
  let shownAt = 0;
  try {
    for (const screen of screens) {
      await lab.showOn({ width: screen.width, height: screen.height, ratio: 1 });
      found.push(judgedOn(await walkOn(lab, screen, shownAt)));
      shownAt += (FRAMES_ON * 1000) / screen.shows;
    }
  } finally {
    clock.frame = wasFrame;
  }
  const timeGapMs = Math.abs((G.time - timeStart) * 1000 - (clock.t - clockStart));
  return { screens: found, walked: lab.player.pos.distanceTo(start), timeGapMs };
}

/** `FRAMES_ON` frames walked on `screen` from `startMs` of shown time; the frames after he settles. */
async function walkOn(lab: Lab, screen: Screen, startMs: number): Promise<Shown[]> {
  const clock = window.__labClock;
  const shownEvery = 1000 / screen.shows;
  const frames: Shown[] = [];
  let last = lab.player.pos.clone();
  const timed = (frame: number): number => timedAt(screen, startMs + frame * shownEvery);
  await lab.step(FRAMES_ON, (frame) => {
    clock.frame = timed(frame + 1) - timed(frame);
    return { keys: ['w'] };
  }, (frame) => {
    const now = lab.player.pos.clone();
    if (frame >= SETTLE_FRAMES) frames.push({ shownMs: shownEvery, step: now.distanceTo(last), dt: G.dt });
    last = now;
  });
  return frames;
}

const percent = (share: number): string => `${(share * 100).toFixed(1)}%`;

/** A scenario's lines and problems. */
function judged(scenario: PaceScenario, walked: Walked): { lines: string[]; problems: string[] } {
  const screens = SCREENS[scenario];
  const each = screens.map((screen, index) => `${screen.shows} Hz timed at ${screen.ticks} Hz: his pace's jerk `
    + `${percent(walked.screens[index].jerk)}, the game's step strays ${percent(walked.screens[index].dtStray)}`);
  const lines = [`${scenario}: ${each.join('; then ')}; walked ${walked.walked.toFixed(1)} m, the game's time `
    + `${walked.timeGapMs.toFixed(2)} ms off the frames' clock`];
  const problems: string[] = [];
  if (walked.walked < 2) problems.push(`${scenario}: the hero never walked`);
  walked.screens.forEach((found, index) => {
    if (found.jerk > MOST_JERK) {
      problems.push(`${scenario}: on the ${screens[index].shows} Hz screen a shown frame's pace stands `
        + `${percent(found.jerk)} off its neighbours' (at most ${percent(MOST_JERK)}): the world judders`);
    }
  });
  // (a frame's step at most is owed to the clock: more is game time lost or gained)
  if (walked.timeGapMs > 1000 / 60) problems.push(`${scenario}: the game's time left the frames' clock by `
    + `${walked.timeGapMs.toFixed(1)} ms`);
  return { lines, problems };
}

/** `lab pace`: the hero walked on each scenario's screens, each frame's step against the time it was shown. */
export async function paceFrames(lab: Lab, options: PaceOptions): Promise<Report> {
  const lines: string[] = [];
  const problems: string[] = [];
  for (const scenario of options.scenarios) {
    const found = judged(scenario, await walk(lab, options.fixture, SCREENS[scenario]));
    lines.push(...found.lines);
    problems.push(...found.problems);
  }
  lines.push(...problems.map((problem) => `! ${problem}`));
  if (!options.canary) return { text: lines.join('\n'), problems };
  // (a commit from before the pacing steps every frame as it comes already: its scenarios are the canary's)
  if (!holdPace(true)) {
    lines.push('canary: this game has no pacing to hold (its frames are stepped as they come)');
    return { text: lines.join('\n'), problems };
  }
  let canary: { lines: string[]; problems: string[] };
  try {
    canary = judged('ticked', await walk(lab, options.fixture, SCREENS.ticked));
  } finally {
    holdPace(false);
  }
  const caught = canary.problems.some((problem) => problem.includes('judders'));
  lines.push(`canary, frames stepped as they come: ${canary.lines[0]}`);
  lines.push(`canary: the judder ${caught ? 'caught' : 'went unseen'}`);
  const missed = caught ? [] : ['canary: frames stepped as they come on 145 Hz ticks went unseen'];
  return { text: lines.join('\n'), problems: [...problems, ...missed] };
}
