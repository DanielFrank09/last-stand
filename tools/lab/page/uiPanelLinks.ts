// `lab ui`'s `panelLinks`: the row of links at the foot of the panels' lobby's hero panel (`index.html`'s
// `.menu-links`, the lobby without the village beta: run it with `--panels`). Report a bug is the row's fifth link
// (from the owner, of it left out as "a fifth link wrapped onto the panel's corner": "should finish?"), and Install a
// sixth where the browser can install the game, which the state shows as such a browser does. They stand in rows of
// three, each in its column: every link must be on a row's line and in its column, inside the panel and the window,
// none over another, each found at its middle; Report a bug must open the form; the panel's body says how far it
// scrolls. In the village the row isn't shown, and the state says so and checks nothing.
// `canary` lays the row out as it was, one line that wraps (the sixth link alone on a second line), which must be found
// off its place.
import { G } from '../../../src/state';
import { VILLAGE } from '../../../src/core/beta';
import { PANEL_LINKS_CANARY } from './uiReportCanaries';

/** What the state found: its lines and its problems. */
export interface PanelLinksFound { lines: string[]; problems: string[] }


/** how far a link's middle may stand from its row's line, or its left edge from its column's, and be in its place
 *  (css px) */
const PLACE_SLACK = 2;
/** links a row */
const PER_ROW = 3;

const row = (): HTMLElement | null => document.querySelector<HTMLElement>('#menu .menu-links');
/** whether the bug report's form is up, read from the page (an A/B's other side may have none: its game isn't
 *  imported, so the state runs there too) */
const formUp = (): boolean => !!document.querySelector('#bug-report:not(.hidden)');
const install = (): HTMLElement | null => document.getElementById('btn-install');

/** whether Install was hidden before the state showed it (put back as it closes) */
let installHidden = true;

/** The panels' lobby's row with Install shown, as a browser that can install the game shows it. */
export function openPanelLinks(canary: boolean): void {
  if (VILLAGE) return;
  if (G.mode !== 'menu') throw new Error('lab: ui: panelLinks needs the lobby');
  const button = install();
  installHidden = button?.classList.contains('hidden') ?? true;
  button?.classList.remove('hidden');
  if (canary) layOutAsBefore();
}

/** The canary's plant: the row as one line that wraps, as it was before its rows of three. */
function layOutAsBefore(): void {
  const style = row()?.style;
  if (!style) return;
  style.display = 'flex';
  style.flexWrap = 'wrap';
  style.justifyContent = 'space-between';
}

/** The row as it was. */
export function closePanelLinks(): void {
  row()?.removeAttribute('style');
  if (installHidden) install()?.classList.add('hidden');
  if (formUp()) document.querySelector<HTMLElement>('#br-cancel')?.click();
}

/** How far the hero panel's body scrolls (css px of its content past its height). */
function panelScroll(): number {
  const body = row()?.closest<HTMLElement>('.ml-body');
  return body ? body.scrollHeight - body.clientHeight : 0;
}

/** Whether `link` is what a press at its middle lands on. */
function foundAt(link: HTMLElement): boolean {
  const box = link.getBoundingClientRect();
  const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
  return !!hit && (hit === link || link.contains(hit));
}

/** Whether `inner` lies within `outer` (a pixel's rounding allowed). */
function inside(inner: DOMRect, outer: DOMRect): boolean {
  const slack = 0.5;
  const across = inner.left >= outer.left - slack && inner.right <= outer.right + slack;
  return across && inner.top >= outer.top - slack && inner.bottom <= outer.bottom + slack;
}

/** Whether two boxes share any area. */
function overlap(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** Each link shown: on the row's line, in the panel and the window, none over another, found; Report a bug opens. */
export function panelLinksShown(): PanelLinksFound {
  if (VILLAGE) return { lines: ['  panelLinks: the village shows no panel links (run it with --panels)'], problems: [] };
  const problems: string[] = [];
  const shown = [...row()?.children ?? []].filter((link): link is HTMLElement => {
    return link instanceof HTMLElement && link.checkVisibility();
  });
  const panel = row()?.closest('.panel')?.getBoundingClientRect();
  const view = new DOMRect(0, 0, innerWidth, innerHeight);
  if (!panel || !shown.length) return { lines: [], problems: ['panelLinks: the panel\'s row of links isn\'t shown'] };
  const boxes = shown.map((link) => link.getBoundingClientRect());
  shown.forEach((link, i) => {
    const name = `"${link.textContent?.trim()}"`;
    const box = boxes[i];
    const rowFirst = boxes[i - (i % PER_ROW)];
    const lineOff = Math.abs(box.top + box.height / 2 - (rowFirst.top + rowFirst.height / 2));
    const columnOff = i < PER_ROW ? 0 : Math.abs(box.left - boxes[i % PER_ROW].left);
    if (lineOff > PLACE_SLACK || columnOff > PLACE_SLACK) {
      problems.push(`panelLinks: ${name} is ${PANEL_LINKS_CANARY.name}`);
    }
    if (!inside(box, panel)) problems.push(`panelLinks: ${name} reaches out of the panel`);
    if (!inside(box, view)) problems.push(`panelLinks: ${name} reaches out of the window`);
    if (boxes.some((other, j) => j !== i && overlap(box, other))) problems.push(`panelLinks: ${name} lies over another`);
    if (!foundAt(link)) problems.push(`panelLinks: something lies over ${name}`);
  });
  const report = document.querySelector<HTMLElement>('#menu .menu-links .report-link');
  if (!report) problems.push('panelLinks: no Report a bug in the row');
  report?.click();
  const opens = formUp();
  if (report && !opens) problems.push('panelLinks: Report a bug didn\'t open the form');
  const labels = shown.map((link) => link.textContent?.trim()).join(' | ');
  const withInstall = panelScroll();
  install()?.classList.add('hidden');
  const withoutInstall = panelScroll();
  install()?.classList.remove('hidden');
  const lines = [
    `  panelLinks: ${shown.length} links (${labels}), in ${Math.ceil(shown.length / PER_ROW)} rows; `
      + `Report a bug ${opens ? 'opened the form' : 'opened nothing'}`,
    `  the panel scrolls ${withInstall} px, ${withoutInstall} px with Install hidden`,
  ];
  return { lines, problems };
}
