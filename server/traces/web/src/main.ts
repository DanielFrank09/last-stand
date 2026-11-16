// The traces page: the summary, then the list, then the bug reports.
import './style.css';
import { showList } from './list';
import { showReports } from './reports';
import { showSummary } from './summary';

void showSummary();
showList();
showReports();
