// `lab village`'s sun's step: what the frame draws when the sun has moved far enough for its kept shadow map to be
// drawn again (`world/arena.ts`, about every 20 s by the player's clock). From play, "FPS is not stable, even on high
// end hardware": that frame drew the scene a second time into a pixel and every still light's shadow cube with the
// sun's map, 870 draws and 4.1M triangles where its neighbours drew 450 and 0.2M, the arena's stage 28 to 41 ms of it
// on a phone's CPU (`lab perf --village --throttle 4`) and 5 to 40 ms in players' reports (traces 0BAM-GTXN, KAW8-MQ8M,
// Y8YJ-N70H). Then the frame as the step left the maps against every one of them drawn again at that moment: a map the
// step left alone and kept anyway would hold the hero's shadow where he stood. `canary` asks for every still shadow at
// the step, as it was: its cubes' draws must be counted.
import * as THREE from 'three';
import type { Lab } from './lab';
import { G } from '../../../src/state';
import { holdHour } from '../../../src/game/clock';
import { drawLampShadows } from '../../../src/world/props';
import { keepMoonShadow } from '../../../src/world/moonShadow';
import { groundHeight } from '../../../src/world/ground';
import { drawFrame } from './light';
import { changedShare } from './villageHallCull';
import type { LightsChecked } from './villageLights';

/** the frames given for the place to settle at an hour */
const SETTLE = 30;
/** the hours the sun is stepped from, by day and by night (the lamps' cubes are kept then too) */
const HOURS = [10, 0];
/** how far the hour is moved for a step (h): past an eighth of a unit of the sun's place, well short of a new look */
const STEP_HOURS = 0.25;
/** the frames watched after the hour moves (the breakables' casters take one first) */
const WATCHED = 4;
/** the most draws the step's frame may make in the scene's pass over a frame beside it (the lab's frames draw none
 *  unless asked: what's counted is the still draw's own render) */
const SCENE_OVER = 4;
/** where he stands, on the square among its lamps, and where he stood before the step */
const STAND: [number, number] = [-4, 4];
const STOOD: [number, number] = [2, 3];
/** the most of the frame that may differ between the maps as the step left them and all drawn again */
const MOST_CHANGED = 0.002;

/** What a frame drew: the scene's pass (by the game's camera), the sun's map and the point lights' cubes. */
interface Drawn { scene: number; sun: number; cubes: number; triangles: number }

/** Every draw of the frames run by `run`, the busiest frame's. */
async function busiestFrame(lab: Lab, frames: number): Promise<Drawn> {
  const gl = G.renderer;
  const own = gl.renderBufferDirect.bind(gl);
  let now: Drawn = { scene: 0, sun: 0, cubes: 0, triangles: 0 };
  gl.renderBufferDirect = (camera, scene, geometry, material, object, group) => {
    if (scene === G.scene && camera === G.camera) now.scene++;
    else if ((camera as THREE.OrthographicCamera).isOrthographicCamera) now.sun++;
    else if (!(scene as THREE.Scene | null)?.isScene) now.cubes++;
    own(camera, scene, geometry, material, object, group);
  };
  let busiest = now;
  try {
    for (let f = 0; f < frames; f++) {
      now = { scene: 0, sun: 0, cubes: 0, triangles: 0 };
      const before = gl.info.render.triangles;
      await lab.step(1);
      now.triangles = gl.info.render.triangles - before;
      if (now.scene + now.sun + now.cubes > busiest.scene + busiest.sun + busiest.cubes) busiest = now;
    }
  } finally {
    gl.renderBufferDirect = own;
  }
  return busiest;
}

const said = (drawn: Drawn): string => `${drawn.scene} draws in the scene, ${drawn.sun} in the sun's map, `
  + `${drawn.cubes} in the lights' cubes, ${Math.round(drawn.triangles / 1000)}k triangles`;

/** The hero stood at `spot`. */
function standAt([x, z]: [number, number]): void {
  G.player.walkTo = null;
  G.player.place(new THREE.Vector3(x, groundHeight(x, z), z), Math.PI);
}

/**
 * The frame now, the kept maps as the still draws left them, against the frame with every one drawn again: the share
 * that changed, at one moment (no frame runs between: the grass and the water move).
 */
function leftAgainstDrawnAgain(lab: Lab): number {
  const left = drawFrame(lab);
  drawLampShadows();
  G.arena.update(0, G.time);
  keepMoonShadow(false);
  const allAgain = drawFrame(lab);
  keepMoonShadow(true);
  return changedShare(left, allAgain);
}

/** The sun stepped by day and by night: its frame draws the sun's map again, and nothing else twice. */
export async function sunStepDrawsItsMap(lab: Lab, canary: boolean): Promise<LightsChecked> {
  const lines: string[] = [];
  const problems: string[] = [];
  let caught = false;
  try {
    for (const hour of HOURS) {
      holdHour(hour);
      standAt(STOOD);
      await lab.step(SETTLE);
      // (a frame drawn: the maps hold his shadow where he stands, as a player's do at a step)
      drawFrame(lab);
      const beside = await busiestFrame(lab, WATCHED);
      holdHour(hour + STEP_HOURS);
      if (canary) drawLampShadows();
      const step = await busiestFrame(lab, WATCHED);
      const line = `the sun stepped at ${hour}:00: ${said(step)}; a frame beside it: ${said(beside)}`;
      lines.push(line);
      if (step.sun <= beside.sun) problems.push(`${line}: the sun's map wasn't drawn again (the measure's own)`);
      const twice = step.scene > beside.scene + SCENE_OVER;
      const cubes = step.cubes > beside.cubes;
      if (twice) problems.push(`${line}: the scene drawn again for it`);
      if (cubes) problems.push(`${line}: the lights' cubes drawn again for it`);
      caught ||= cubes;
      // (then the lamps' own still draw, the sun's map left alone, his shadow in it where he stands)
      drawFrame(lab);
      drawLampShadows();
      await lab.step(2);
      standAt(STAND);
      await lab.step(SETTLE);
      const changed = leftAgainstDrawnAgain(lab);
      const share = (of: number): string => `${(of * 100).toFixed(2)}%`;
      const kept = `at ${hour}:00, walked off after the sun's step and the lamps' own draw, the frame as they left the `
        + `maps against all drawn again: ${share(changed)} changed`;
      lines.push(kept);
      if (changed > MOST_CHANGED) problems.push(`${kept}: over ${share(MOST_CHANGED)}`);
    }
  } finally {
    holdHour(null);
    await lab.step(SETTLE);
  }
  if (canary) return { lines, problems: [], caught, moments: [] };
  return { lines, problems, caught: null, moments: [] };
}
