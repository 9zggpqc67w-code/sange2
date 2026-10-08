export interface Grade {
  value: number;
  scale: number;
}

/**
 * Parses an explicit grade with its scale: "8.42 / 10.00", "8.42 out of 10", "78%".
 * A bare number is rejected because its scale cannot be known. Only higher-is-better
 * scales are supported; no conversion to other grading systems is attempted.
 */
export function parseGrade(raw: string): Grade | null {
  const s = raw.trim().toLowerCase().replace(/(\d),(\d)/g, '$1.$2');
  let m = s.match(/(\d+(?:\.\d+)?)\s*(?:\/|out of)\s*(\d+(?:\.\d+)?)/);
  let value: number;
  let scale: number;
  if (m) {
    value = parseFloat(m[1]);
    scale = parseFloat(m[2]);
  } else if ((m = s.match(/(\d+(?:\.\d+)?)\s*%/))) {
    value = parseFloat(m[1]);
    scale = 100;
  } else {
    return null;
  }
  if (!(scale > 0) || value < 0 || value > scale) return null;
  return { value, scale };
}

export const gradeFraction = (g: Grade): number => g.value / g.scale;

/** True if grade `g` is at least `min` on a scale of `minScale` (compared as fractions). */
export function gradeMeetsMinimum(g: Grade, min: number, minScale: number): boolean {
  return gradeFraction(g) + 1e-9 >= min / minScale;
}
