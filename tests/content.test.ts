import { describe, expect, it } from 'vitest';
import { validateAll, EXPECTED } from '../scripts/validate.ts';
import { MOCKS } from '../src/data';

describe('imported content', () => {
  const reports = validateAll();
  it('validator reports zero errors for all five mocks', () => {
    for (const r of reports) expect(r.errors, `Mock ${r.mock}`).toEqual([]);
  });
  it('120 questions; 16 RC + 8 VA per mock; expected MCQ/TITA counts', () => {
    expect(MOCKS.length).toBe(5);
    expect(MOCKS.reduce((n, m) => n + m.questions.length, 0)).toBe(120);
    for (const m of MOCKS) {
      expect(m.questions.filter((q) => q.section === 'RC').length).toBe(16);
      expect(m.questions.filter((q) => q.section === 'VA').length).toBe(8);
      expect(m.mcqCount).toBe(EXPECTED[m.id].mcq);
      expect(m.titaCount).toBe(EXPECTED[m.id].tita);
      expect(m.questions.map((q) => q.number)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    }
  });
  it('Mock 2 has 19 MCQ and 5 TITA (blueprint correction)', () => {
    expect(MOCKS[1].mcqCount).toBe(19); expect(MOCKS[1].titaCount).toBe(5);
  });
  it('Mock 5 keeps its interleaved order', () => {
    const order = MOCKS[4].questions.map((q) => q.section[0]).join('');
    expect(order).toBe('VV' + 'RRRR' + 'V' + 'RRRR' + 'VV' + 'RRRR' + 'V' + 'RRRR' + 'VV');
    expect(MOCKS[4].questions[6].kind).toBe('oddoneout');
    expect(MOCKS[4].questions[17].kind).toBe('oddoneout');
  });
  it('every question has an answer, an explanation and options or a TITA format', () => {
    for (const m of MOCKS) for (const q of m.questions) {
      expect(q.answer).not.toBe('');
      expect(q.explanationHtml.length).toBeGreaterThan(100);
      if (q.isTita) expect(q.options.length).toBe(0); else expect(q.options.map((o) => o.key)).toEqual(['A', 'B', 'C', 'D']);
    }
  });
  it('difficulty summaries are recomputed from item labels', () => {
    const expected = { 1: [6, 12, 6, 0], 2: [1, 13, 9, 1], 3: [2, 10, 10, 2], 4: [2, 10, 11, 1], 5: [7, 13, 4, 0] } as Record<number, number[]>;
    for (const m of MOCKS) {
      const d = m.difficulty.recomputed;
      expect([d.easy, d.moderate, d.difficult, d.veryDifficult]).toEqual(expected[m.id]);
    }
  });
});
