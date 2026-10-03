import {
  addDays,
  differenceInCalendarDays,
  format,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
  endOfMonth,
  subDays,
} from 'date-fns';

/** All record dates are stored as local calendar dates: "yyyy-MM-dd". */
export const toISO = (date) => format(date, 'yyyy-MM-dd');
export const todayISO = () => toISO(new Date());
export const parse = (iso) => (iso ? parseISO(iso) : null);
export const isISODate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && isValid(parseISO(s));

export const addDaysISO = (iso, n) => toISO(addDays(parseISO(iso), n));
export const subDaysISO = (iso, n) => toISO(subDays(parseISO(iso), n));
export const diffDays = (a, b) => differenceInCalendarDays(parseISO(a), parseISO(b));
export const daysFromToday = (iso, today = todayISO()) => (iso ? diffDays(iso, today) : null);

export const weekStartISO = (iso, weekStartsOn = 1) => toISO(startOfWeek(parseISO(iso), { weekStartsOn }));
export const monthStartISO = (iso) => toISO(startOfMonth(parseISO(iso)));
export const monthEndISO = (iso) => toISO(endOfMonth(parseISO(iso)));
export const monthKey = (iso) => iso.slice(0, 7);

export const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export const WEEKDAY_LABELS = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
export const weekdayKey = (iso) => WEEKDAYS[parseISO(iso).getDay()];

/** Inclusive list of ISO dates from start to end. */
export function rangeISO(start, end) {
  const out = [];
  if (!start || !end || start > end) return out;
  let d = parseISO(start);
  const last = parseISO(end);
  while (d <= last) {
    out.push(toISO(d));
    d = addDays(d, 1);
  }
  return out;
}

export function fmtDate(iso, pattern = 'd MMM yyyy') {
  if (!iso) return '—';
  const d = parseISO(iso);
  return isValid(d) ? format(d, pattern) : '—';
}

export const fmtShort = (iso) => fmtDate(iso, 'd MMM');
export const fmtMonth = (key) => fmtDate(`${key}-01`, 'MMM yyyy');
export const fmtDateTime = (isoDateTime) => {
  if (!isoDateTime) return '—';
  const d = new Date(isoDateTime);
  return isValid(d) ? format(d, 'd MMM yyyy, HH:mm') : '—';
};

/** "Today", "Tomorrow", "in 3 days", "2 days ago" */
export function relativeDay(iso, today = todayISO()) {
  if (!iso) return '';
  const n = diffDays(iso, today);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n > 1 && n < 7) return `in ${n} days`;
  if (n >= 7 && n < 60) return `in ${Math.round(n / 7)} wk`;
  if (n < -1 && n > -60) return `${-n} days ago`;
  return fmtDate(iso);
}

export const nowISO = () => new Date().toISOString();
