import { PRESENT, periodEnd, periodStart } from './dates';

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};
const NUM = '(\\d+(?:\\.\\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)';

const toNumber = (s: string) => (s in WORD_NUMBERS ? WORD_NUMBERS[s] : parseFloat(s));
const round1 = (n: number) => Math.round(n * 10) / 10;
const DAY_MS = 24 * 60 * 60 * 1000;
const AVG_MONTH_DAYS = 30.4375;

/** "8 months", "eight-month", "1 year 2 months", "1.5 years" -> months. */
export function parseDurationMonths(raw: string): number | null {
  const s = raw.toLowerCase();
  const years = s.match(new RegExp(`${NUM}[\\s-]*(?:years?|yrs?)`));
  const months = s.match(new RegExp(`${NUM}[\\s-]*months?`));
  if (!years && !months) return null;
  const total = (years ? toNumber(years[1]) * 12 : 0) + (months ? toNumber(months[1]) : 0);
  return round1(total);
}

export interface ExperienceEntry {
  /** ISO date (possibly partial). */
  start: string;
  /** ISO date (possibly partial) or 'PRESENT'. */
  end: string;
}

interface Interval {
  start: number;
  endExclusive: number;
}

function toInterval(entry: ExperienceEntry, now: Date): Interval | null {
  const start = periodStart(entry.start).getTime();
  const endDate = entry.end === PRESENT ? now : periodEnd(entry.end);
  const endExclusive = endDate.getTime() + DAY_MS;
  return Number.isNaN(start) || Number.isNaN(endExclusive) || endExclusive <= start
    ? null
    : { start, endExclusive };
}

function intervalMonths(i: Interval): number {
  const s = new Date(i.start);
  const e = new Date(i.endExclusive);
  const whole = (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth());
  return whole + (e.getUTCDate() - s.getUTCDate()) / AVG_MONTH_DAYS;
}

/** Months covered by the entries; overlapping periods are merged so nothing is counted twice. */
export function totalExperienceMonths(entries: ExperienceEntry[], now: Date): number {
  const intervals = entries
    .map((e) => toInterval(e, now))
    .filter((i): i is Interval => i !== null)
    .sort((a, b) => a.start - b.start);

  const merged: Interval[] = [];
  for (const i of intervals) {
    const last = merged[merged.length - 1];
    if (last && i.start <= last.endExclusive) last.endExclusive = Math.max(last.endExclusive, i.endExclusive);
    else merged.push({ ...i });
  }
  return round1(merged.reduce((sum, i) => sum + intervalMonths(i), 0));
}
