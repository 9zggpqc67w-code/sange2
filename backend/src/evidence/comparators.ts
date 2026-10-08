import { gradeFraction, type Grade } from '../normalization/grades';
import { namesMatch } from '../normalization/names';

export type ComparatorKind = 'exact' | 'textContains' | 'name' | 'date' | 'number' | 'gpa';

interface Comparator {
  equivalent(a: unknown, b: unknown): boolean;
  /** When equivalent values differ in precision, which one to keep. */
  prefer?(a: unknown, b: unknown): unknown;
}

const MIN_CONTAINS_LENGTH = 4;

export const COMPARATORS: Record<ComparatorKind, Comparator> = {
  exact: { equivalent: (a, b) => a === b },

  textContains: {
    equivalent: (a, b) => {
      if (typeof a !== 'string' || typeof b !== 'string') return false;
      if (a === b) return true;
      const [short, long] = a.length <= b.length ? [a, b] : [b, a];
      return short.length >= MIN_CONTAINS_LENGTH && long.includes(short);
    },
    prefer: (a, b) => (String(a).length >= String(b).length ? a : b),
  },

  name: { equivalent: (a, b) => typeof a === 'string' && typeof b === 'string' && namesMatch(a, b) },

  // "2025-01" and "2025-01-01" are compatible (one is just less precise); "2024" vs "2025" is not.
  date: {
    equivalent: (a, b) => {
      if (typeof a !== 'string' || typeof b !== 'string') return false;
      const [short, long] = a.length <= b.length ? [a, b] : [b, a];
      return long === short || long.startsWith(`${short}-`);
    },
    prefer: (a, b) => (String(a).length >= String(b).length ? a : b),
  },

  number: {
    equivalent: (a, b) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-9,
  },

  // Grades are compared as fractions of their own scale; 0.05 points on a 10-point scale of tolerance.
  gpa: {
    equivalent: (a, b) => {
      const ga = a as Grade;
      const gb = b as Grade;
      if (!ga || !gb || typeof ga.value !== 'number' || typeof gb.value !== 'number') return false;
      return Math.abs(gradeFraction(ga) - gradeFraction(gb)) <= 0.0005;
    },
  },
};
