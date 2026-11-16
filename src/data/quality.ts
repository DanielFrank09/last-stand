// Graphics quality presets. None of these settings change shader variants, so they
// can be switched live without a compile hitch (see core/shaders.ts).
import { VILLAGE } from '../core/beta';

export type QualityLevel = 'high' | 'medium' | 'low' | 'verylow';
export type QualitySetting = 'auto' | QualityLevel;

export interface QualityPreset {
  label: string;
  /** the most pixels the scene renders, counted on the screen (Infinity: all the screen's own); never by the OS's
   *  scaling, which says nothing of what the hardware draws. Every level renders them all: what a level cuts is
   *  other work ("I want to run the game at full phone res") */
  pixels: number;
  /** MSAA samples on the scene render target (0 = off) */
  msaa: number;
  /** directional (moon) shadow map resolution */
  shadowMap: number;
  /** character parts with a smaller bounding radius don't cast shadows (each caster is a draw call) */
  minCasterRadius: number;
  /** the heroes' geometric detail (hair locks, fur tufts, curve segments), 1 = full; taken when a hero is built */
  heroDetail: number;
  /** enemies further than this from the local player (m) skip the leg IK (models/ik.ts): their walk cycle's own legs */
  ikRange: number;
  /** the floors' relief: the most steps down each view ray (core/parallax.ts), 0 = flat */
  relief: number;
  /** how far apart the grass's blades stand, against High's, each as many times wider (`setGrassSpread` in
   *  world/meadow.ts): twice, a quarter of the blades cover the ground as before, a quarter of the vertices shaded
   *  (on an S25 Edge at full res the grass was 21 ms of an 80 ms frame; Very low's four times, a sixteenth: a laptop's
   *  integrated GPU drew 5 frames a second over the shoulder, the grass 296k of its 534k triangles) */
  grassSpread: number;
  /** whether the grass's near blades are tufts of thin blades, each its own way (`setGrassTufts` in world/meadow.ts):
   *  three times their vertices, High's alone */
  grassTufts: boolean;
  /** the share of the village's lamps' reach, and whether they read the shadows' map of what stands round them
   *  (`setLampQuality` in core/lamps.ts) */
  lampReach: number;
  lampShadows: boolean;
  /** whether the village draws what moves into its kept shadow maps only on frames it moved
   *  (`world/shadowsOnMove.ts`): every level's now (a hero on High is 134k triangles a shadow pass, drawn again each
   *  frame he stood still: from play, 1.28M triangles facing a wall, "our users are really struggling") */
  shadowsOnMove: boolean;
  /** the rounds a skirt's cloth is draped over the limbs a frame (`setDrapeRounds` in entities/models/armor.ts) */
  drapeRounds: number;
  /** whether the frame may be shown in HDR on a display in HDR mode (`setHdrAllowed` in core/hdr.ts): its copy of
   *  the frame at the screen's pixels cost a 4K laptop's integrated GPU 26 ms of 38 */
  hdr: boolean;
  /** whether the props sculpted for close looks are drawn coarser (the crypt's skulls: `setSkullDetail` in
   *  world/skull.ts) */
  coarseProps: boolean;
  /** the share of the scene's pixels each way bloom draws at (`setBloomShare` in core/renderer.ts): Low's half,
   *  a quarter of the pixels (an S25 Edge's bloom was 6 ms of an 80 ms frame at full res) */
  bloomShare: number;   // (0: no bloom at all, Very low's)
  /** whether the sun's (moon's) shadow is drawn every other frame, whatever the frame rate (`setShadowInTurns` in
   *  core/renderer.ts): its pass draws every caster again */
  shadowInTurns: boolean;
  /** whether the sun's shadow is of what stands still alone, drawn only when that changes (`setSunShadowStill` in
   *  world/props.ts): its pass drew the whole biome again each time; the heroes and foes cast none by it then */
  stillSunShadow: boolean;
  /** the share of the floor's clutter drawn: grass, ferns, pebbles, rocks, bones (`setClutterShare` in
   *  world/culling.ts) */
  clutter: number;
  /** the share of the thicket's leaf cards drawn (`setLeafShare` in world/culling.ts) */
  leaves: number;
  /** the share of the particles a burst, a puff of smoke or debris spawns (`setParticleShare` in fx/particles.ts):
   *  each is drawn over what's behind it, so fewer is less of the GPU's fill */
  particles: number;
  /** whether worn gear glows in its rarity's colour where the player hasn't chosen (Settings' Gear glow,
   *  `setGearGlowByLevel` in core/materials.ts): 3 to 10% of the frame where glowing gear fills the view */
  gearGlow: boolean;
  /** whether the village's and the Thornwood's trees are drawn as simple ones, each a model of a few pieces
   *  (`setSimpleTrees` in world/simpleTrees.ts): geometries alone */
  simpleTrees: boolean;
}

export const QUALITY: Record<QualityLevel, QualityPreset> = {
  high:    { label: 'High',     pixels: 2_073_600, msaa: 0, shadowMap: 1024, minCasterRadius: 0.2,  heroDetail: 0.5,  ikRange: 18, relief: 0, grassSpread: 2, grassTufts: false, lampReach: 0.85, lampShadows: false, shadowsOnMove: true, bloomShare: 0.25, drapeRounds: 1, shadowInTurns: true, particles: 0.6,  hdr: false, coarseProps: true, stillSunShadow: false, clutter: 0.5,  leaves: 0.5,  gearGlow: false, simpleTrees: true },
  medium:  { label: 'Medium',   pixels: 1_300_000, msaa: 0, shadowMap: 512,  minCasterRadius: 0.25, heroDetail: 0.35, ikRange: 12, relief: 0, grassSpread: 3, grassTufts: false, lampReach: 0.7,  lampShadows: false, shadowsOnMove: true, bloomShare: 0.25, drapeRounds: 1, shadowInTurns: true, particles: 0.45, hdr: false, coarseProps: true, stillSunShadow: true,  clutter: 0.35, leaves: 0.35, gearGlow: false, simpleTrees: true },
  low:     { label: 'Low',      pixels: 921_600,   msaa: 0, shadowMap: 512,  minCasterRadius: 0.3,  heroDetail: 0.2,  ikRange: 6,  relief: 0, grassSpread: 4, grassTufts: false, lampReach: 0.6,  lampShadows: false, shadowsOnMove: true, bloomShare: 0,    drapeRounds: 1, shadowInTurns: true, particles: 0.3,  hdr: false, coarseProps: true, stillSunShadow: true,  clutter: 0.2,  leaves: 0.2,  gearGlow: false, simpleTrees: true },
  // (below Low, tuned so even a 10-year-old ThinkPad integrated GPU runs smoothly)
  verylow: { label: 'Very low', pixels: 518_400,   msaa: 0, shadowMap: 256,  minCasterRadius: 0.4,  heroDetail: 0.15, ikRange: 0,  relief: 0, grassSpread: 6, grassTufts: false, lampReach: 0.5,  lampShadows: false, shadowsOnMove: true, drapeRounds: 1,    hdr: false, coarseProps: true, bloomShare: 0,    shadowInTurns: true, particles: 0.15, stillSunShadow: true,  clutter: 0.1,  leaves: 0.1,  gearGlow: false, simpleTrees: true },
};

export const QUALITY_ORDER: QualityLevel[] = ['high', 'medium', 'low', 'verylow'];

/**
 * Auto quality: a level down when the average FPS stays below `minFps` for `window` seconds (frames over 250 ms,
 * hitches, left out of it), the screen's own pixels kept at every level (from play, "I want to run the game at full
 * phone res, if we need to cut, we need to cut something else, not resolution"); or to Low at once after
 * `quickWindow` seconds whose middle frame is under `farBelow` of it (a hitch doesn't move the middle). A frame longer
 * than `longestFrame` s is no measure (a tab switch, a breakpoint). What the hardware holds is measured, never guessed
 * from the device or the OS's scaling. From play, a step at a time, 6 s each, a phone's first visit (Auto starting
 * from High) drew a few frames a second for half a minute ("insane slowdown when choosing a hero upon first entry
 * into the game, on phone"), and a laptop's integrated GPU switched to Auto ran at 5 frames a second "for the first
 * minute or two" (`npm run lab -- auto`: to Low in 3.4 s, where it holds 7.8 frames a second at its full 4.4 Mpx).
 */
export const AUTO_QUALITY = { minFps: 50, window: 4, quickWindow: 1, farBelow: 0.5, settle: 2, longestFrame: 1 };
