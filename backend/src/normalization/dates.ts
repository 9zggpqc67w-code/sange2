const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};

export type DatePrecision = 'year' | 'month' | 'day';

export type DateParse =
  | { kind: 'ok'; iso: string; precision: DatePrecision }
  | { kind: 'ambiguous'; candidates: [string, string] }
  | { kind: 'present' }
  | { kind: 'invalid' };

export const PRESENT = 'PRESENT';

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

function day(y: number, m: number, d: number): DateParse {
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return { kind: 'invalid' };
  return { kind: 'ok', iso: `${pad(y, 4)}-${pad(m)}-${pad(d)}`, precision: 'day' };
}
function month(y: number, m: number): DateParse {
  if (m < 1 || m > 12) return { kind: 'invalid' };
  return { kind: 'ok', iso: `${pad(y, 4)}-${pad(m)}`, precision: 'month' };
}

/**
 * Parses the date formats found in the demo documents. Formats that cannot be read
 * with certainty (e.g. 03/04/2021) are reported as ambiguous and never guessed.
 */
export function parseDate(raw: string): DateParse {
  const base = raw.trim().toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ');
  if (/^(present|current|ongoing|now|till date|to date)$/.test(base)) return { kind: 'present' };

  let m: RegExpMatchArray | null;

  if ((m = base.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return day(+m[1], +m[2], +m[3]);
  if ((m = base.match(/^(\d{4})-(\d{1,2})$/))) return month(+m[1], +m[2]);
  if ((m = base.match(/^(\d{4})$/))) return { kind: 'ok', iso: m[1], precision: 'year' };

  if ((m = base.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) {
    const a = +m[1];
    const b = +m[2];
    const y = +m[3];
    if (a > 12 && b <= 12) return day(y, b, a); // dd/mm/yyyy
    if (b > 12 && a <= 12) return day(y, a, b); // mm/dd/yyyy
    if (a > 12 && b > 12) return { kind: 'invalid' };
    if (a === b) return day(y, a, b);
    const dm = day(y, b, a);
    const md = day(y, a, b);
    if (dm.kind === 'ok' && md.kind === 'ok') return { kind: 'ambiguous', candidates: [dm.iso, md.iso] };
    return dm.kind === 'ok' ? dm : md;
  }

  const named = base.replace(/\./g, '');
  if ((m = named.match(/^(\d{1,2})(?:st|nd|rd|th)? ([a-z]+) (\d{4})$/)) && MONTHS[m[2]]) {
    return day(+m[3], MONTHS[m[2]], +m[1]);
  }
  if ((m = named.match(/^([a-z]+) (\d{1,2})(?:st|nd|rd|th)? (\d{4})$/)) && MONTHS[m[1]]) {
    return day(+m[3], MONTHS[m[1]], +m[2]);
  }
  if ((m = named.match(/^([a-z]+) (\d{4})$/)) && MONTHS[m[1]]) {
    return month(+m[2], MONTHS[m[1]]);
  }
  return { kind: 'invalid' };
}

/** ISO string (YYYY, YYYY-MM or YYYY-MM-DD), 'PRESENT', or null if unreadable/ambiguous. */
export function normalizeDate(raw: string): string | null {
  const parsed = parseDate(raw);
  if (parsed.kind === 'ok') return parsed.iso;
  if (parsed.kind === 'present') return PRESENT;
  return null;
}

/** First instant (UTC) covered by a possibly partial ISO date. */
export function periodStart(iso: string): Date {
  const [y, m = '1', d = '1'] = iso.split('-');
  return new Date(Date.UTC(+y, +m - 1, +d));
}

/** Last day (UTC) covered by a possibly partial ISO date. */
export function periodEnd(iso: string): Date {
  const [y, m, d] = iso.split('-');
  if (d) return new Date(Date.UTC(+y, +m - 1, +d));
  if (m) return new Date(Date.UTC(+y, +m, 0));
  return new Date(Date.UTC(+y, 11, 31));
}

/** Whole calendar months from `from` to `to` (to is later), floored. */
export function monthsSince(iso: string, now: Date): number {
  const s = periodStart(iso);
  let months = (now.getUTCFullYear() - s.getUTCFullYear()) * 12 + (now.getUTCMonth() - s.getUTCMonth());
  if (now.getUTCDate() < s.getUTCDate()) months -= 1;
  return months;
}
