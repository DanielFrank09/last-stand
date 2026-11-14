// `lab village`'s lamp hand-over: what the frames draw as the hero comes to other lamps by night and the casting
// lights move to them (`castOnNearest` in game/village.ts). From play, "FPS is not stable, even on high end hardware",
// and #593: a hand-over drew both lamps' cubes whole in one frame, twelve faces of the village, 142 to 167 draws and
// 3.5M triangles on Very low. Now a face of the moved light's cube a frame, the light giving nothing until its cube is
// whole. Then the frame as the hand-over left the kept cubes against all drawn again at that moment. `canary` asks
// for every lamp's cube at once at the hand-over, as it was: its faces in one frame must be counted.
import { G } from '../../../src/state';
import type { Lab } from './lab';
import { holdHour } from '../../../src/game/clock';
import { drawLampShadows } from '../../../src/world/props';
import { busiestFrame, leftAgainstDrawnAgain, standAt, type Drawn } from './villageSunStep';
import type { LightsChecked } from './villageLights';

/** the hour the lamps cast at */
const MIDNIGHT = 0;
/** the frames given for the lamps' lights to settle on the lamps nearest him */
const SETTLE = 90;
/** the frames watched after he's stood by other lamps: a shadow's fade out, both lights' cubes a face a frame */
const WATCHED = 90;
/** how far from a lamp's foot he stands (m) */
const OFF = 1.5;
/** the most cube faces a frame of a hand-over may draw into */
const FACES_MOST = 1;
/** the faces two cubes have: the least a hand-over of both lights draws over its frames */
const FACES_BOTH = 12;
/** the most of the frame that may differ between the cubes as the hand-over left them and all drawn again */
const MOST_CHANGED = 0.002;

/** A stand beside the street lamp `index`. */
function besideLamp(index: number): [number, number] {
  const lamp = G.arena.village.lanterns[index];
  return [lamp.x + OFF, lamp.z];
}

/** The street lamp furthest from the lamp `from`: by it, neither of the two nearest lamps is one of `from`'s. */
function furthestLamp(from: number): number {
  const lamps = G.arena.village.lanterns;
  let furthest = from;
  for (let index = 0; index < lamps.length; index++) {
    if (lamps[index].distanceTo(lamps[from]) > lamps[furthest].distanceTo(lamps[from])) furthest = index;
  }
  return furthest;
}

/** The casting lights handed from one pair of lamps to another: no frame of it draws more than a face of a cube. */
export async function lampHandOverByFaces(lab: Lab, canary: boolean): Promise<LightsChecked> {
  holdHour(MIDNIGHT);
  try {
    standAt(besideLamp(0));
    await lab.step(SETTLE);
    standAt(besideLamp(furthestLamp(0)));
    if (canary) drawLampShadows();
    const frames: Drawn[] = [];
    const busiest = await busiestFrame(lab, WATCHED, frames);
    const faces = frames.reduce((sum, frame) => sum + frame.faces, 0);
    const drawing = frames.filter((frame) => frame.faces > 0).length;
    const changed = leftAgainstDrawnAgain(lab);
    const line = `the lamps' lights handed on at midnight: ${faces} cube faces drawn over ${drawing} frames, the busiest `
      + `frame ${busiest.faces} faces, ${busiest.cubes} draws and ${Math.round(busiest.triangles / 1000)}k triangles; `
      + `after it the frame against all drawn again ${(changed * 100).toFixed(2)}% changed`;
    const atOnce = busiest.faces > FACES_MOST;
    if (canary) return { lines: [line], problems: [], caught: atOnce, moments: [] };
    const problems: string[] = [];
    if (faces < FACES_BOTH) problems.push(`${line}: both lights never moved to his lamps (the measure's own)`);
    if (atOnce) problems.push(`${line}: over ${FACES_MOST} a frame`);
    if (changed > MOST_CHANGED) problems.push(`${line}: over ${(MOST_CHANGED * 100).toFixed(2)}%`);
    return { lines: [line], problems, caught: null, moments: [] };
  } finally {
    holdHour(null);
    await lab.step(SETTLE);
  }
}
