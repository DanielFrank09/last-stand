// `lab coop --scenarios duel`'s places (#627's review): each player picks his own place at the weapons rack, by the
// mouse or a finger, as Victor asked ("Click Side Two and end up there, if available. If already taken, it should
// ask the other player to free the spot and spectate instead"). Each step starts from parts the host sets
// (page/coopDuel.ts `coopDuelParts`) and plays one pick: a free place clicked, a free place tapped, a held place
// asked for by a click and given up, a held place asked for by a tap and kept by a tap. Judged on both games: where
// each player ends, the holder's prompt as it's asked and gone once answered, the asker's line while it waits and
// when it's refused. Then the rack's card and the prompt are fitted on the screens `src/ui/AGENTS.md` names: the
// card within the window with the prompt in it, and with the card shut the prompt within the window.
// `--canary`: the host's game loses every pick and answer a guest sends it, and the fit's prompt is pushed a window
// down: every step and every screen must find something wrong.

/** frames for a pick or an answer to cross the lab's link and come back as the host's word */
const PICK_FRAMES = 240;

/** the parts each step starts from, the pick it plays (whose page, which part, whose place, by what), the answer the
 *  holder gives (none: a free place), and where each player must end */
const STEPS = [
  {
    name: 'a free place clicked',
    from: { host: '0', guest: 'watch' },
    pick: { role: 'guest', part: '1', whose: 'free', by: 'click' },
    end: { host: '0', guest: '1' },
  },
  {
    name: 'a free place tapped',
    from: { host: 'watch', guest: '1' },
    pick: { role: 'guest', part: '0', whose: 'free', by: 'tap' },
    end: { host: 'watch', guest: '0' },
  },
  {
    name: 'the host\'s place asked for by a click and given up',
    from: { host: '0', guest: '1' },
    pick: { role: 'guest', part: '0', whose: 'partner', by: 'click' },
    answer: { role: 'host', yes: true, by: 'click' },
    end: { host: 'watch', guest: '0' },
  },
  {
    name: 'the guest\'s place asked for by a tap and kept by a tap',
    from: { host: '0', guest: '1' },
    pick: { role: 'host', part: '1', whose: 'partner', by: 'tap' },
    answer: { role: 'guest', yes: false, by: 'tap' },
    end: { host: '0', guest: '1' },
  },
];

/** the screens the card and the prompt are fitted on (css px): `src/ui/AGENTS.md`'s desktops, phone and tablets, and
 *  the shortest phone held sideways the watching bar is fitted on */
const FIT_SCREENS = [
  { width: 1024, height: 700, ratio: 1 },
  { width: 1920, height: 1080, ratio: 1 },
  { width: 844, height: 390, ratio: 3 },
  { width: 751, height: 298, ratio: 3.75 },
  { width: 1180, height: 820, ratio: 2 },
  { width: 820, height: 1180, ratio: 2 },
];

const SIDE_NAMES = { 0: 'Side one', 1: 'Side two' };

/** Where each player stands on each game, in a line: `host 0, guest watch`. */
const partsLine = (menus) => `the host's game: host ${menus.host.mine}, guest ${menus.host.partner}; `
  + `the guest's: guest ${menus.guest.mine}, host ${menus.guest.partner}`;

/** The problems with where the players stand on both games against `want` (`{ host, guest }`). */
function partsWrong(menus, want, when) {
  const shown = [
    ['host', 'the host\'s game', menus.host.mine], ['guest', 'the host\'s game', menus.host.partner],
    ['guest', 'the guest\'s game', menus.guest.mine], ['host', 'the guest\'s game', menus.guest.partner],
  ];
  return shown.filter(([role, , part]) => part !== want[role])
    .map(([role, game, part]) => `${when}: the ${role} is on ${part} on ${game}, not ${want[role]}`);
}

/**
 * One step played on `pair` (`call` a page's function by role). Returns its problems, its lines added to `lines`.
 * `picture` pictures both screens as the holder is asked, by a name of its own.
 */
async function playStep(pair, call, step, lines, picture) {
  const problems = [];
  const menus = async () => {
    const [host, guest] = await Promise.all([call('host', 'coopDuelMenu'), call('guest', 'coopDuelMenu')]);
    return { host, guest };
  };
  await call('host', 'coopDuelParts', step.from);
  await pair.run(PICK_FRAMES);
  const before = await menus();
  problems.push(...partsWrong(before, step.from, 'set up'));

  const { pick, answer } = step;
  const found = await call(pick.role, 'coopDuelPlace', { part: pick.part, whose: pick.whose, by: pick.by });
  if (!found) problems.push(`the ${pick.role}'s menu has no ${pick.whose} place on ${pick.part}`);
  await pair.run(PICK_FRAMES);
  if (answer) {
    const asked = await menus();
    const prompt = asked[answer.role].prompt;
    const note = asked[pick.role].note;
    lines.push(`  asked: the ${answer.role}'s prompt "${prompt}"; the ${pick.role}'s line "${note}"`);
    await picture?.(`asked-${pick.role}`);
    if (!prompt.includes(SIDE_NAMES[pick.part])) problems.push(`the ${answer.role} was never asked for its place`);
    if (asked[pick.role].prompt) problems.push(`the ${pick.role} is shown the prompt for its own ask`);
    if (!note.startsWith('Asked')) problems.push(`the ${pick.role}'s line doesn't say it asked`);
    await call(answer.role, 'coopDuelAnswer', { yes: answer.yes, by: answer.by });
    await pair.run(PICK_FRAMES);
  }
  const after = await menus();
  lines.push(`  after: ${partsLine(after)}`);
  problems.push(...partsWrong(after, step.end, 'after'));
  if (answer && after[answer.role].prompt) problems.push(`the ${answer.role}'s prompt stayed up once answered`);
  if (answer && !answer.yes && !after[pick.role].note.includes('keeps the place')) {
    problems.push(`the ${pick.role} wasn't told its ask was refused ("${after[pick.role].note}")`);
  }
  return problems;
}

/** The card and the prompt fitted on every screen of `FIT_SCREENS` on the guest's page (in touch mode after its
 *  taps). Returns their problems, its lines added to `lines`. */
async function fitAll(call, lines, canary) {
  const problems = [];
  for (const screen of FIT_SCREENS) {
    const fit = await call('guest', 'coopDuelFit', { screen, canary });
    lines.push(`  ${fit.line}${fit.problems.length ? `: ${fit.problems.join('; ')}` : ''}`);
    if (!canary) problems.push(...fit.problems);
    else if (!fit.problems.some((problem) => problem.includes('prompt'))) {
      problems.push(`places: the canary's prompt pushed off the screen went unseen on ${fit.line}`);
    }
  }
  return problems;
}

/** Both screens pictured as they stand, `out/coop/duel-<name>-<role>.png`. */
async function pictureBoth(pair, lines, name) {
  lines.push(`  pictured ${(await pair.picture(`duel-${name}`)).join(', ')}`);
}

/**
 * Plays every step of the places on `pair` and fits the menu (`callPage` the page's functions by name). Leaves the
 * host on side one, the guest on side two, for the match. Returns the problems found, its lines added to `lines`.
 */
export async function takePlaces(pair, callPage, lines, { canary = false, pictures = false } = {}) {
  const problems = [];
  const call = (role, fn, args) => callPage(role === 'host' ? pair.host : pair.guest, fn, args);
  await call('host', 'coopDuelLosePicks', { on: canary });
  for (const step of STEPS) {
    lines.push(`places: ${step.name}`);
    const picture = pictures ? (name) => pictureBoth(pair, lines, name) : null;
    const found = await playStep(pair, call, step, lines, picture);
    lines.push(...found.map((problem) => `  ${canary ? 'caught' : 'problem'}: ${problem}`));
    if (!canary) problems.push(...found.map((problem) => `places: ${step.name}: ${problem}`));
    else if (!found.length) problems.push(`places: the canary's lost picks went unseen in ${step.name}`);
    if (step === STEPS[STEPS.length - 1]) {
      lines.push('places: the rack\'s card and the ask\'s prompt fitted');
      problems.push(...await fitAll(call, lines, canary));
    }
    const touched = await Promise.all([call('host', 'coopDuelMouseBack'), call('guest', 'coopDuelMouseBack')]);
    if (step.pick.by === 'tap' && !touched[['host', 'guest'].indexOf(step.pick.role)]) {
      problems.push(`places: ${step.name}: the ${step.pick.role}'s tap never put its page in touch mode`);
    }
  }
  await call('host', 'coopDuelLosePicks', { on: false });
  await call('host', 'coopDuelParts', { host: '0', guest: '1' });
  await pair.run(PICK_FRAMES);
  return problems;
}
