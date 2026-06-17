/**
 * Date helpers for the cutoff clock and holiday-shifted effective dates.
 * The cutoff is a real UX object (PRD §4.1): before it -> today's price; after ->
 * next market day. Weekends/holidays shift to the next business day, and the UI
 * shows the EFFECTIVE date, never the tapped calendar date.
 */

// A few market holidays near the demo window so holiday-shift is demoable.
const HOLIDAYS = new Set<string>([
  "2026-06-19", // (illustrative)
  "2026-07-05", // matches PRD's "5 Jul is a holiday" example
  "2026-08-15", // Independence Day
]);

export function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

export function isHoliday(d: Date): boolean {
  return HOLIDAYS.has(iso(d)) || isWeekend(d);
}

export function nextBusinessDay(from: Date): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + 1);
  while (isHoliday(d)) d.setDate(d.getDate() + 1);
  return d;
}

/** First business day on/after `from`. */
export function businessDayOnOrAfter(from: Date): Date {
  const d = new Date(from);
  while (isHoliday(d)) d.setDate(d.getDate() + 1);
  return d;
}

export interface CutoffState {
  cutoffPassed: boolean;
  navDate: string; // ISO date the order will be priced on
  cutoffHour: number;
  msUntilCutoff: number; // for the live countdown (>0 only before cutoff today)
}

/**
 * Compute cutoff state from current time. `forcePassed` lets the dev panel jump
 * across the cutoff to demo the copy change without waiting for 3 PM.
 */
export function computeCutoff(
  cutoffHour: number,
  now: Date,
  forcePassed?: boolean,
): CutoffState {
  const todayIsHoliday = isHoliday(now);
  const cutoffToday = new Date(now);
  cutoffToday.setHours(cutoffHour, 0, 0, 0);

  let passed: boolean;
  if (forcePassed === true) passed = true;
  else if (forcePassed === false) passed = false;
  else passed = now.getTime() >= cutoffToday.getTime() || todayIsHoliday;

  const navDate = passed ? iso(nextBusinessDay(now)) : iso(businessDayOnOrAfter(now));
  const msUntilCutoff = passed ? 0 : cutoffToday.getTime() - now.getTime();

  return { cutoffPassed: passed, navDate, cutoffHour, msUntilCutoff };
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "18 Jun" style — the human, plain-language date the PRD uses everywhere. */
export function humanDate(isoStr: string): string {
  const d = new Date(isoStr + "T00:00:00");
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function humanDateFull(isoStr: string): string {
  const d = new Date(isoStr + "T00:00:00");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export function weekday(isoStr: string): string {
  const d = new Date(isoStr + "T00:00:00");
  return WEEKDAYS[d.getDay()];
}

export function addDaysIso(isoStr: string, days: number): string {
  const d = new Date(isoStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return iso(d);
}
