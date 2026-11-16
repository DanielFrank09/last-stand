// What the foes a charge meets do to it (Bull Rush): each weighs its kind's heft, more for an elite and less for one
// the charge killed. The living it carries load it (#397): each weight carried slows it, gear's All Damage % lightens
// the load, and at its most the charge stops where it is; a boss is never carried and stops it. And from a weight met
// on, he's staggered at its stop (#560), the longer the heavier, up to a cap. A small charge is slowed a little and
// stuns nothing, so the skill still moves him (`RamDef`, `PushDef` in types.ts, tuned in the skill's data).
import type { EnemyDef, PushDef, RamDef } from '../types';

/** A foe as the charge met it: its kind, and whether it's an elite. */
export interface Rammed { def: EnemyDef; hero: boolean }

/** The weight `foe` puts up as `ram`'s charge meets it (`killed`: the blow killed it, and it gives little). */
export function heftOf(ram: RamDef, foe: Rammed, killed: boolean): number {
  return (foe.def.heft ?? 1) * (foe.hero ? ram.elite : 1) * (killed ? ram.killed : 1);
}

/** How long `ram`'s charge stuns him at its stop, having met `weight` of foes (s; 0 under its least weight). */
export function stunOf(ram: RamDef, weight: number): number {
  if (weight < ram.at) return 0;
  const share = Math.min(1, (weight - ram.at) / Math.max(1e-6, ram.full - ram.at));
  return ram.least + (ram.most - ram.least) * share;
}

/** The load `push`'s charge bears carrying `weight` of living foes, for a hero of `damagePct` All Damage. */
export function loadOf(push: PushDef, weight: number, damagePct: number): number {
  return weight / (1 + push.gear * Math.max(0, damagePct) / 100);
}

/** The share of its speed `push`'s charge keeps bearing `load` (0 once it's at its most: it stops). */
export function paceOf(push: PushDef, load: number): number {
  if (load >= push.most) return 0;
  return Math.max(0, 1 - push.slow * load);
}
