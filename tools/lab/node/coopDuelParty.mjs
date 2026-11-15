// `lab coop --scenarios duel --party 3|4`: a duel in a party of more than two (#406), each game a page of its own.
// Three games: a 1 v 1 with the third watching (out of the arena, no rival of its own, its camera on a fighter, the
// result its own "The duel is over"). Four games: a 2 v 2 (each game two rivals and no other foe; one of a side down
// doesn't end the round, both do; no hero is hurt by his own side). Each player takes his place in the menu himself,
// every guest who fights readies, the host begins; the struck heroes are down to a little life on their own games
// and the others strike at the rival nearest them on their own screens (page/coopDuel.ts). Judged on every game: the
// same parts, the same score and winner, each fall, the result each player's own, and all back in the village.
import { labError } from './errors.mjs';

const MENU_FRAMES = 300;
const START_FRAMES = 2400;
const COUNT_FRAMES = 900;
const BLOWS_FRAMES = 900;
const BACK_FRAMES = 900;
/** how long the round is watched with one of a side down, which mustn't end it */
const ONE_DOWN_FRAMES = 150;

const TAGS = ['Host', 'Guest', 'Third', 'Fourth'];
/** each player's part: three games, the third watches; four, the first two against the last two */
const PARTS = { 3: ['0', '1', 'watch'], 4: ['0', '0', '1', '1'] };
/** where each game's hero stands for the blows, the two sides 3 m apart, a side's two 3 m abreast */
const SPOTS = { 3: [[10.5, 22], [13.5, 22], [0, 0]], 4: [[10.5, 22], [10.5, 25], [13.5, 22], [13.5, 25]] };
/** the spot each hero faces: his rival across */
const ACROSS = { 3: [1, 0, 0], 4: [2, 3, 0, 1] };

const scoreOf = (state) => (state.duel ? state.duel.score.join(' : ') : 'no duel');
const same = (values) => values.every((value) => value === values[0]);

/** Plays the party's duel on `pair` (its room open and full already). Returns the problems found. */
export async function fightPartyDuel(pair, callPage, lines, { pictures = false } = {}) {
  const count = pair.pages.length, parts = PARTS[count], problems = [];
  if (!parts) throw labError('coop: a party\'s duel is three or four games');
  const every = (fn, args) => Promise.all(pair.pages.map((page, index) => callPage(page, fn, args?.(index))));
  const picture = async (name) => { if (pictures) lines.push(`pictured ${(await pair.picture(`duel${count}-${name}`)).join(', ')}`); };
  const winners = parts.flatMap((part, index) => (part === '0' ? [index] : []));
  const losers = parts.flatMap((part, index) => (part === '1' ? [index] : []));

  // --- the menu: the host's choices, each player's own place, the guests who fight ready ----------------
  await callPage(pair.host, 'coopDuelSetUp', { ground: 'crypt', wins: 1, gear: true, size: count === 4 ? 2 : 1 });
  await pair.run(MENU_FRAMES);
  // (side one first, then side two, then the watchers: a place is taken only where one is free)
  for (const part of ['watch', '0', '1']) {
    for (const [index, page] of pair.pages.entries()) {
      if (parts[index] !== part || await callPage(page, 'coopDuelPart') === part) continue;
      const there = await callPage(page, 'coopDuelPlace', { part, whose: 'free', by: 'click' });
      if (!there) problems.push(`${TAGS[index]} found no free place on ${part} to click`);
      await pair.run(MENU_FRAMES);
    }
  }
  let menus = await every('coopDuelMenu');
  const shown = menus.map((menu) => JSON.stringify(menu.sides.map((side) => side.map((name) => name.replace(' (ready)', '')))));
  lines.push(`the places taken, each by its own player: ${shown[0]} on the host's${same(shown) ? ', the same on every game' : ''}`);
  if (!same(shown)) problems.push(`the games' menus disagree on the places (${shown.join(' | ')})`);
  const took = await every('coopDuelPart');
  if (took.join() !== parts.join()) problems.push(`the players' parts are ${took.join(', ')}, not ${parts.join(', ')}`);
  if (!menus[0].disabled) problems.push('the host could begin before the guests who fight were ready');
  for (const [index, page] of pair.pages.entries()) {
    if (index === 0 || parts[index] === 'watch') continue;
    await callPage(page, 'coopDuelGo');
  }
  await pair.run(MENU_FRAMES);
  menus = await every('coopDuelMenu');
  lines.push(`the fighters ready: the host's button ${menus[0].disabled ? 'still dead' : 'live'} ("${menus[0].note}")`);
  if (menus[0].disabled) problems.push(`the host's Begin stayed dead once the fighters were ready ("${menus[0].note}")`);
  await picture('menu');

  // --- the start ----------------------------------------------------------------------------------
  await callPage(pair.host, 'coopDuelGo');
  const fought = (host, guest, all) => all.every((state) => state.duel?.round === 1 && state.duel.phase === 'fight');
  let states = await pair.until(fought, START_FRAMES + COUNT_FRAMES, 'the duel\'s first round was never fought on every game');
  const rivals = count === 4 ? 2 : 1;
  for (const [index, state] of states.entries()) {
    const watches = parts[index] === 'watch';
    const want = watches ? 0 : rivals;
    if (state.duel.rivals !== want) problems.push(`${TAGS[index]}'s game has ${state.duel.rivals} rivals, not ${want}`);
    if (state.duel.foes) problems.push(`${TAGS[index]}'s game has ${state.duel.foes} foes in the duel`);
    if (String(state.duel.side ?? 'watch') !== parts[index]) problems.push(`${TAGS[index]} is on ${state.duel.side} in the duel, not ${parts[index]}`);
    if (watches && (state.duel.heroShown || !state.out)) problems.push(`${TAGS[index]} watches and its hero is still in the arena`);
    if (watches && !state.duel.watching) problems.push(`${TAGS[index]} watches with no watching bar shown`);
  }
  lines.push(`round 1 on every game: rivals ${states.map((state) => state.duel.rivals).join(', ')}; other foes ${states.map((state) => state.duel.foes).join(', ')}`
    + (count === 3 ? `; the third watching ("${states[2].duel.watching}")` : ''));

  // --- the blows ----------------------------------------------------------------------------------
  const spots = SPOTS[count], across = ACROSS[count];
  // (a watcher's hero is out of the arena: nothing of it is placed)
  const placeFighters = (weak) => Promise.all([...winners, ...losers].map((index) => callPage(pair.pages[index], 'coopDuelRound', {
    role: index === 0 ? 'host' : 'guest', spot: spots[index], faces: spots[across[index]],
    strikes: winners.includes(index), weak: weak.includes(index),
  })));
  if (count === 4) {
    await placeFighters([losers[0]]);
    const firstDown = (host, guest, all) => all.every((state) => state.duel) && !all[losers[0]].duel.alive;
    await pair.until(firstDown, BLOWS_FRAMES, 'the first struck hero never fell');
    states = await pair.run(ONE_DOWN_FRAMES);
    const still = states.every((state) => state.duel?.phase === 'fight' && scoreOf(state) === '0 : 0');
    lines.push(`one of side two down: the round ${still ? 'goes on' : 'ended'} on every game (${states.map((state) => state.duel?.phase).join(', ')})`);
    if (!still) problems.push('a round ended with one of a side of two still standing');
    await picture('fight');
    await placeFighters([losers[1]]);
  } else {
    await placeFighters(losers);
    await pair.run(40);
    await picture('fight');
  }
  const done = (host, guest, all) => all.every((state) => state.duel?.phase === 'done');
  states = await pair.until(done, BLOWS_FRAMES + BACK_FRAMES, 'the match never ended on every game');
  const scores = states.map(scoreOf), won = states.map((state) => state.duel.winner);
  const cards = states.map((state) => state.duel.resultShown);
  lines.push(`the match: ${scores[0]}, side ${won[0]} wins${same(scores) && same(won) ? ' on every game' : ''}; shown ${cards.map((card, index) => `${TAGS[index]} "${card}"`).join(', ')}`);
  if (!same(scores) || !same(won)) problems.push(`the games disagree on the match (${scores.join(' | ')}; winners ${won.join(', ')})`);
  if (won[0] !== 0) problems.push('side one struck every blow and didn\'t win');
  for (const [index, card] of cards.entries()) {
    const want = parts[index] === 'watch' ? 'The duel is over' : parts[index] === '0' ? 'Victory' : 'Defeat';
    if (card !== want) problems.push(`${TAGS[index]}'s result says "${card}", not "${want}"`);
  }
  for (const index of winners) {
    if (!states[index].duel.alive) problems.push(`${TAGS[index]}, of the side that struck, is down (hurt by his own side?)`);
  }
  await picture('result');
  const back = (host, guest, all) => all.every((state) => state.mode === 'menu' && !state.duel);
  states = await pair.until(back, BACK_FRAMES, 'the games never came back to the village after the match');
  const outStill = states.flatMap((state, index) => (state.out ? [TAGS[index]] : []));
  lines.push(`back in the village on every game${outStill.length ? `; still out: ${outStill.join(', ')}` : ', every hero in it again'}`);
  if (outStill.length) problems.push(`${outStill.join(', ')} came back from the duel still out of the game`);
  return problems;
}
