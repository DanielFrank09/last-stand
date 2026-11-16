// Bull Rush's blows by the weapons held (tools/lab `rush`'s `bonus`, #398): the charge cast through its first set of
// foes, living on its line, with a shield and with a lone one-hander, each on a fresh set-up. Every blow it lands
// (a crit's share taken off) must be within the damage the class's data gives the charge held that way (its own, or
// its style's tuning: a shield's weight behind it), times the hero's modifiers and the roll's spread: the two ranges
// don't meet, so a shield's charge striking a one-hander's blows is caught. With the canary the shield's tuning is
// dropped from the charge the hero knows as it's cast with a shield, as a bonus lost would be: its blows must be
// found short. Each way's tooltip is pictured as the hotbar shows it, and must say the charge's trade-offs (its load
// and its stagger, `.tt-ram`) and, with a shield, the shield's bonus.
import { middleOf, type Lab, type Pictured } from './lab';
import type { HeldStyle, SkillDef } from '../../../src/types';
import { SKILL_KEYS } from '../../../src/loot/loadout';
import { hideTooltip, showTooltipAt, skillTooltip } from '../../../src/ui/tooltip';
import { G } from '../../../src/state';
import { DAMAGE_ROLL, damageScale } from '../../../src/combat/damage';
import { castThrough, firstSet, type Blow, type RushOptions } from './rush';

/** the ways of holding weapons the charge is cast with: a shield's, and a lone one-hander's, its own damage */
const STYLES: HeldStyle[] = ['shield', 'oneHanded'];
/** the style the canary drops the charge's tuning from */
const DROPPED: HeldStyle = 'shield';
/** how far a blow may be off its range: the roll's own rounding (a hit's amount isn't rounded, so a hair) */
const SLACK = 0.01;

/** What the bonus part found: its lines and problems, and with the canary what it missed. */
export interface BonusFound {
  lines: string[];
  problems: string[];
  canary: string[];
  moments: Pictured[];
}

/** A blow's range for the charge held `style`'s way: the data's damage for it times the hero's modifiers, rolled. */
interface Range {
  damage: number;
  low: number;
  high: number;
}

/** The charge as its class's data has it, before any style's tuning. */
function ownDef(): SkillDef {
  const def = G.player.cls.skills.find((skill) => skill.impl === 'bullRush');
  if (!def) throw new Error('lab: rush: the hero has no Bull Rush');
  return def;
}

/** What a blow of the charge held `style`'s way may deal, by its class's data and the hero's modifiers now. */
function rangeOf(style: HeldStyle): Range {
  const def = ownDef();
  const damage = def.styles?.[style]?.damage ?? def.damage ?? 0;
  const scaled = damage * damageScale(G.player.stats, def.tags);
  return { damage, low: scaled * DAMAGE_ROLL.low, high: scaled * DAMAGE_ROLL.high };
}

/** A blow's amount with a crit's share taken off. */
function plainOf(blow: Blow): number {
  return blow.crit ? blow.amount / (1 + G.player.stats.critDmg / 100) : blow.amount;
}

/** With the canary, the shield's tuning dropped from the charge the hero knows: whether it was. */
function dropBonus(): boolean {
  const known = G.player.known.get('bullRush');
  if (!known) return false;
  known.def = ownDef();
  return true;
}

const whole = (value: number): string => String(Math.round(value));

/** The charge's tooltip as the hotbar shows it held `style`'s way (its own content, shown where its slot is: hovered,
 *  the mouse's moves timed out on a loaded machine): pictured, and what it fails to say as problems. */
async function tooltipOf(lab: Lab, style: HeldStyle, pictures: boolean): Promise<{
  moment: Pictured | null; problems: string[];
}> {
  const known = G.player.known.get('bullRush');
  const key = SKILL_KEYS.find((each) => G.player.skillAt(each) === known);
  const slot = key ? document.querySelectorAll<HTMLElement>('#hotbar .slot')[SKILL_KEYS.indexOf(key)] : undefined;
  if (!known || !slot) return { moment: null, problems: [`${style}: the charge has no slot on the hotbar`] };
  const at = middleOf(slot);
  showTooltipAt(skillTooltip(known.def)(), { clientX: at.x, clientY: at.y });
  const tip = document.querySelector('#tooltip');
  const problems: string[] = [];
  if (!tip?.querySelector('.tt-ram')) problems.push(`${style}: the tooltip says nothing of the load or the stagger`);
  const note = known.def.styleNote;
  if (note && !tip?.textContent?.includes(note)) problems.push(`${style}: the tooltip leaves out "${note}"`);
  const moment = pictures ? await lab.screen(`Bull Rush's tooltip, ${style}`, [], '#tooltip') : null;
  hideTooltip();
  return { moment, problems };
}

/** The charge cast with each of `STYLES`, its blows held to the data's damage for that way of holding the weapons. */
export async function bonusOf(lab: Lab, options: RushOptions): Promise<BonusFound> {
  const found: BonusFound = { lines: ['  blows by the weapons held:'], problems: [], canary: [], moments: [] };
  let caught = false;
  let dropped = false;
  for (const style of STYLES) {
    const drop = options.canary && style === DROPPED;
    const styled: RushOptions = { ...options, fixture: { ...options.fixture, gear: style } };
    const plan = { canary: false, pictures: false, before: drop ? () => { dropped = dropBonus(); } : undefined };
    const cast = await castThrough(lab, styled, firstSet(), plan);
    const range = rangeOf(style);
    const blows = cast.followed.flatMap((one) => one.blows);
    const plain = blows.map(plainOf);
    const outside = plain.filter((amount) => amount < range.low - SLACK || amount > range.high + SLACK);
    const dealt = plain.length ? `${whole(Math.min(...plain))}–${whole(Math.max(...plain))}` : 'none';
    const stated = `${whole(range.low)}–${whole(range.high)} (base ${range.damage})`;
    found.lines.push(`    ${style}: ${blows.length} blows dealt ${dealt}, its data's ${stated}`);
    const tooltip = await tooltipOf(lab, style, options.pictures);
    if (tooltip.moment) found.moments.push(tooltip.moment);
    const problems: string[] = [...tooltip.problems];
    const foes = cast.followed.length;
    if (blows.length < foes) problems.push(`${style}: ${blows.length} blows on ${foes} foes`);
    if (outside.length) {
      const listed = outside.map(whole).join(', ');
      problems.push(`${style}: ${outside.length} of ${blows.length} blows outside ${stated} (${listed})`);
    }
    for (const problem of problems) found.lines.push(`    ! ${problem}`);
    found.problems.push(...problems);
    if (drop) caught = problems.some((problem) => problem.includes('outside'));
  }
  if (!options.canary) return found;
  found.lines.push(`canary: the ${DROPPED}'s bonus dropped ${caught ? 'caught' : 'missed'}`);
  if (!dropped) found.canary.push(`the canary never dropped the ${DROPPED}'s bonus`);
  else if (!caught) found.canary.push(`the canary's ${DROPPED} bonus dropped went unseen`);
  return found;
}
