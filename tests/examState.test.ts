import { describe, expect, it } from 'vitest';
import { clearResponse, emptyStates, goTo, markAndNext, previous, saveAndNext, selectDraft, statusCounts, statusOf, tickTime, normaliseTita } from '../src/lib/examState';
import type { Attempt } from '../src/types';

const fresh = (): Attempt => {
  const states = emptyStates(); states[0] = { ...states[0], visited: true };
  return { id: 'x', mockId: 1, attemptNo: 1, startedAt: 0, deadline: 2_400_000, submittedAt: null, autoSubmitted: false, current: 1, states, lastTickAt: 0, result: null };
};

describe('palette semantics', () => {
  it('starts with Q1 not answered and the rest not visited', () => {
    const c = statusCounts(fresh().states);
    expect(c).toEqual({ notVisited: 23, notAnswered: 1, answered: 0, marked: 0, answeredMarked: 0 });
  });
  it('Save & Next saves the selection and moves on', () => {
    let a = selectDraft(fresh(), 'B');
    a = saveAndNext(a);
    expect(statusOf(a.states[0])).toBe('answered');
    expect(a.states[0].saved).toBe('B');
    expect(a.current).toBe(2);
    expect(statusOf(a.states[1])).toBe('notAnswered');
  });
  it('navigating away without saving discards the selection', () => {
    let a = selectDraft(fresh(), 'B');
    a = goTo(a, 5);
    expect(a.states[0].saved).toBeNull();
    expect(a.states[0].draft).toBeNull();
    expect(statusOf(a.states[0])).toBe('notAnswered');
    expect(statusOf(a.states[4])).toBe('notAnswered');
  });
  it('Mark for Review & Next: with an answer → answered & marked; without → marked', () => {
    let a = markAndNext(selectDraft(fresh(), 'D'));
    expect(statusOf(a.states[0])).toBe('answeredMarked');
    a = markAndNext(a);
    expect(statusOf(a.states[1])).toBe('marked');
    expect(a.current).toBe(3);
  });
  it('Save & Next on a marked question clears the mark', () => {
    let a = markAndNext(selectDraft(fresh(), 'D'));
    a = goTo(a, 1);
    expect(a.states[0].draft).toBe('D');
    a = saveAndNext(a);
    expect(statusOf(a.states[0])).toBe('answered');
  });
  it('Clear Response removes saved answer but keeps the review mark', () => {
    let a = markAndNext(selectDraft(fresh(), 'A'));
    a = goTo(a, 1);
    a = clearResponse(a);
    expect(a.states[0].saved).toBeNull();
    expect(statusOf(a.states[0])).toBe('marked');
    a = saveAndNext(goTo(clearResponse(goTo(saveAndNext(selectDraft(a, 'C')), 1)), 1));
    expect(statusOf(a.states[0])).toBe('notAnswered');
  });
  it('Previous goes back and stays at Q1; Save & Next stays on Q24', () => {
    let a = previous(fresh());
    expect(a.current).toBe(1);
    a = goTo(a, 24);
    a = saveAndNext(selectDraft(a, 'A'));
    expect(a.current).toBe(24);
    expect(statusOf(a.states[23])).toBe('answered');
    expect(previous(a).current).toBe(23);
  });
  it('TITA entries are normalised to digits', () => {
    expect(normaliseTita('2 1-4a3')).toBe('2143');
    expect(normaliseTita('')).toBeNull();
    expect(normaliseTita('abc')).toBeNull();
  });
  it('time accounting adds capped deltas only while visible', () => {
    let a = tickTime(fresh(), 1000, true);
    expect(a.states[0].timeMs).toBe(1000);
    a = tickTime(a, 61_000, true); // long gap capped at 5 s
    expect(a.states[0].timeMs).toBe(6000);
    a = tickTime(a, 62_000, false);
    expect(a.states[0].timeMs).toBe(6000);
    expect(a.lastTickAt).toBe(62_000);
  });
});
