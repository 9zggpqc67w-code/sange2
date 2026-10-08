import { DEMO_MSC_COMPUTER_SCIENCE, REQUIREMENT_SETS } from './requirements.demo';

describe('demo requirement set', () => {
  it('is clearly marked as DEMO', () => {
    expect(DEMO_MSC_COMPUTER_SCIENCE.isDemo).toBe(true);
    expect(DEMO_MSC_COMPUTER_SCIENCE.disclaimer).toMatch(/not official/i);
  });

  it('does not make experience a requirement unless explicitly configured', () => {
    const exp = DEMO_MSC_COMPUTER_SCIENCE.requirements.filter((r) => r.type === 'EXPERIENCE_MONTHS');
    expect(exp).toHaveLength(0);
  });

  it('has unique requirement ids, positive weights, and is registered', () => {
    const ids = DEMO_MSC_COMPUTER_SCIENCE.requirements.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(DEMO_MSC_COMPUTER_SCIENCE.requirements.every((r) => r.weight > 0)).toBe(true);
    expect(REQUIREMENT_SETS[DEMO_MSC_COMPUTER_SCIENCE.id]).toBe(DEMO_MSC_COMPUTER_SCIENCE);
  });

  it('matches the demo package rules (CGPA 7.0/10, English 6.5)', () => {
    const gpa = DEMO_MSC_COMPUTER_SCIENCE.requirements.find((r) => r.type === 'GPA_MIN');
    const lang = DEMO_MSC_COMPUTER_SCIENCE.requirements.find((r) => r.type === 'LANGUAGE_LEVEL');
    expect(gpa?.params).toEqual({ min: 7.0, scale: 10 });
    expect(lang?.params).toMatchObject({ minOverall: 6.5 });
  });
});
