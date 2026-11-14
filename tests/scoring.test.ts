import { describe, expect, it } from 'vitest';
import { scoreAttempt, scoreQuestion, MAX_MARKS } from '../src/lib/scoring';
import { emptyStates } from '../src/lib/examState';
import { MOCKS } from '../src/data';
import type { Attempt } from '../src/types';

const base = (mockId: number, start = 1_000_000): Attempt => ({
  id: 't', mockId, attemptNo: 1, startedAt: start, deadline: start + 2_400_000, submittedAt: start + 600_000,
  autoSubmitted: false, current: 1, states: emptyStates(), lastTickAt: start, result: null,
});
const withSaved = (a: Attempt, saved: Record<number, string | null>, marked: number[] = []): Attempt => ({
  ...a, states: a.states.map((s, i) => ({ ...s, visited: true, saved: saved[i + 1] ?? null, marked: marked.includes(i + 1) })),
});
const wrongMcq = (ans: string) => (['A', 'B', 'C', 'D'].find((k) => k !== ans) as string);

describe('scoreQuestion', () => {
  const mcq = { number: 1, section: 'RC' as const, isTita: false, answer: 'C' };
  const tita = { number: 17, section: 'VA' as const, isTita: true, answer: '2143' };
  it('MCQ correct +3, wrong −1, blank 0', () => {
    expect(scoreQuestion(mcq, 'C')).toEqual({ outcome: 'correct', marks: 3 });
    expect(scoreQuestion(mcq, 'A')).toEqual({ outcome: 'incorrect', marks: -1 });
    expect(scoreQuestion(mcq, null)).toEqual({ outcome: 'unattempted', marks: 0 });
    expect(scoreQuestion(mcq, ' c ')).toEqual({ outcome: 'correct', marks: 3 });
  });
  it('TITA correct +3, wrong 0, blank 0; non-digits ignored', () => {
    expect(scoreQuestion(tita, '2143')).toEqual({ outcome: 'correct', marks: 3 });
    expect(scoreQuestion(tita, '2 1 4 3')).toEqual({ outcome: 'correct', marks: 3 });
    expect(scoreQuestion(tita, '1234')).toEqual({ outcome: 'incorrect', marks: 0 });
    expect(scoreQuestion(tita, '')).toEqual({ outcome: 'unattempted', marks: 0 });
    expect(scoreQuestion(tita, null)).toEqual({ outcome: 'unattempted', marks: 0 });
  });
});

describe('scoreAttempt on every mock', () => {
  for (const mock of MOCKS) {
    it(`Mock ${mock.id}: all correct = 72, all wrong = −MCQ count, blank = 0`, () => {
      const allRight = withSaved(base(mock.id), Object.fromEntries(mock.questions.map((q) => [q.number, q.answer])));
      const r1 = scoreAttempt(mock, allRight).summary;
      expect(r1.score).toBe(MAX_MARKS);
      expect(r1.correct).toBe(24); expect(r1.accuracy).toBe(1); expect(r1.attemptRate).toBe(1);
      expect(r1.rcScore).toBe(48); expect(r1.vaScore).toBe(24);

      const allWrong = withSaved(base(mock.id), Object.fromEntries(mock.questions.map((q) => [q.number, q.isTita ? (q.answer === '1' ? '2' : '1') : wrongMcq(q.answer)])));
      const r2 = scoreAttempt(mock, allWrong).summary;
      expect(r2.score).toBe(-mock.mcqCount);
      expect(r2.incorrect).toBe(24); expect(r2.accuracy).toBe(0);

      const blank = scoreAttempt(mock, base(mock.id)).summary;
      expect(blank).toMatchObject({ score: 0, correct: 0, incorrect: 0, unattempted: 24, attempted: 0, accuracy: 0, attemptRate: 0 });
    });
  }
  it('mixed attempt on Mock 1 adds up and splits RC/VA correctly', () => {
    const m = MOCKS[0];
    // Q1 C correct (+3), Q2 wrong (−1), Q17 TITA 2143 correct (+3), Q18 TITA wrong (0), Q21 B correct (+3)
    const a = withSaved(base(1), { 1: 'C', 2: 'A', 17: '2143', 18: '1234', 21: 'B' });
    const { summary, questions } = scoreAttempt(m, a);
    expect(summary.score).toBe(8);
    expect(summary.rcScore).toBe(2);
    expect(summary.vaScore).toBe(6);
    expect(summary.correct).toBe(3); expect(summary.incorrect).toBe(2); expect(summary.unattempted).toBe(19);
    expect(summary.accuracy).toBeCloseTo(0.6); expect(summary.attemptRate).toBeCloseTo(5 / 24);
    expect(questions[17].marks).toBe(0);
    expect(summary.timeUsedMs).toBe(600_000);
  });
  it('unsaved drafts are never evaluated; answered-and-marked are evaluated', () => {
    const m = MOCKS[0];
    let a = withSaved(base(1), { 1: 'C' }, [1]);
    a = { ...a, states: a.states.map((s, i) => (i === 1 ? { ...s, draft: 'B' } : s)) };
    const r = scoreAttempt(m, a).summary;
    expect(r.score).toBe(3); expect(r.attempted).toBe(1);
  });
  it('time used is capped at 40 minutes for auto-submitted attempts', () => {
    const a = { ...base(1), submittedAt: null };
    expect(scoreAttempt(MOCKS[0], a).summary.timeUsedMs).toBe(2_400_000);
  });
});
