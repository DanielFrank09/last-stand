// The bug reports (reports.mjs): newest first, a page at a time ("Show more"), each opened to read it whole, what
// was expected, the facts the game added and its picture, fetched as it opens. Every string a player sent goes in as
// text (`textContent`), never as HTML.
import { readReport, readReports, reportPictureUrl } from './api';
import { byId, el } from './dom';
import { bytes } from './format';
import { when } from './summary';
import type { ReportLine } from './types';

const PAGE = 50;

/** A report opened: what was expected, the facts and the picture, read whole from the service. */
async function fill(body: HTMLElement, line: ReportLine): Promise<void> {
  const report = await readReport(line.code);
  // (the whole of what happened, where the list's line cut it short)
  const cut = report.text !== line.text;
  const parts: Node[] = cut ? [el('p', { className: 'said', textContent: report.text })] : [];
  if (report.expected) {
    parts.push(el('p', { className: 'said' }, el('span', { className: 'dim', textContent: 'Expected: ' }), report.expected));
  }
  parts.push(el('pre', { className: 'facts', textContent: report.facts.join('\n') }));
  if (report.picture) {
    const picture = el('img', { src: reportPictureUrl(line.code), alt: `report ${line.code}'s picture`, loading: 'lazy' });
    parts.push(el('a', { href: reportPictureUrl(line.code), target: '_blank', rel: 'noreferrer' }, picture));
  }
  body.replaceChildren(...parts);
}

/** What happened, cut short, opening onto the report whole. */
function happened(line: ReportLine): HTMLTableCellElement {
  const body = el('div', { className: 'whole', textContent: 'Reading…' });
  const details = el('details', {}, el('summary', { textContent: line.text }), body);
  let read = false;
  details.addEventListener('toggle', () => {
    if (!details.open || read) return;
    read = true;
    fill(body, line).catch((error: unknown) => {
      read = false;
      body.textContent = (error as Error).message;
    });
  });
  return el('td', { className: 'happened' }, details);
}

/** A cell named where a phone shows the row as a card. */
function labelled(cell: HTMLTableCellElement, label: string): HTMLTableCellElement {
  cell.dataset.k = label;
  return cell;
}

function row(line: ReportLine): HTMLTableRowElement {
  const picture = line.picture ? 'yes' : 'no';
  return el(
    'tr',
    {},
    el('td', { className: 'code', textContent: line.code }),
    el('td', { className: 'when' }, when(line.at)),
    labelled(el('td', { className: 'kind', textContent: line.kind }), 'kind'),
    happened(line),
    labelled(el('td', { className: 'num', textContent: `${picture}, ${bytes(line.bytes)}` }), 'picture'),
  );
}

/** The list's state: how many rows show, of how many. */
const state = { shown: 0, total: 0 };

async function more(): Promise<void> {
  const page = await readReports(state.shown, PAGE);
  byId('report-rows').append(...page.reports.map(row));
  state.shown += page.reports.length;
  state.total = page.total;
  const used = page.diskMax ? Math.round((100 * page.diskBytes) / page.diskMax) : 0;
  byId('report-count').textContent = `${state.shown} of ${state.total}, ${bytes(page.diskBytes)} `
    + `(${used}% of ${bytes(page.diskMax)}), kept ${page.keepDays} days`;
  byId('reports-more').hidden = state.shown >= state.total;
  byId('reports-empty').hidden = state.total > 0;
}

function showError(error: unknown): void {
  const empty = byId('reports-empty');
  empty.hidden = false;
  empty.textContent = (error as Error).message;
}

export function showReports(): void {
  byId('reports-more').addEventListener('click', () => more().catch(showError));
  more().catch(showError);
}
