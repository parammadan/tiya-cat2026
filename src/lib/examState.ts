// Pure state transitions for the examination interface (CAT-style semantics).
import type { Attempt, QState, QStatus } from '../types';

export const QUESTION_COUNT = 24;

export function emptyStates(n = QUESTION_COUNT): QState[] {
  return Array.from({ length: n }, () => ({ visited: false, saved: null, draft: null, marked: false, timeMs: 0 }));
}

export function statusOf(s: QState): QStatus {
  if (!s.visited) return 'notVisited';
  if (s.marked && s.saved !== null) return 'answeredMarked';
  if (s.marked) return 'marked';
  if (s.saved !== null) return 'answered';
  return 'notAnswered';
}

export const STATUS_LABEL: Record<QStatus, string> = {
  notVisited: 'Not Visited',
  notAnswered: 'Not Answered',
  answered: 'Answered',
  marked: 'Marked for Review',
  answeredMarked: 'Answered & Marked for Review',
};

/** Normalise a TITA entry: digits only. Empty → null. */
export function normaliseTita(v: string): string | null {
  const d = v.replace(/\D/g, '');
  return d.length ? d : null;
}

function withState(a: Attempt, i: number, patch: Partial<QState>): Attempt {
  const states = a.states.map((s, k) => (k === i ? { ...s, ...patch } : s));
  return { ...a, states };
}

/** Go to question n (1-based). Any unsaved draft on the question being left is discarded. */
export function goTo(a: Attempt, n: number): Attempt {
  const target = Math.min(Math.max(1, n), a.states.length);
  const leaving = a.current - 1;
  let next = withState(a, leaving, { draft: a.states[leaving].saved });
  next = withState(next, target - 1, { visited: true, draft: next.states[target - 1].saved });
  return { ...next, current: target };
}

export function selectDraft(a: Attempt, value: string | null): Attempt {
  return withState(a, a.current - 1, { draft: value, visited: true });
}

function advance(a: Attempt): Attempt {
  return a.current < a.states.length ? goTo(a, a.current + 1) : a;
}

/** "Save & Next": saves the on-screen response (or nothing), clears the review mark, and moves on. */
export function saveAndNext(a: Attempt): Attempt {
  const i = a.current - 1;
  const draft = a.states[i].draft;
  return advance(withState(a, i, { saved: draft, marked: false, visited: true }));
}

/** "Mark for Review & Next": saves the on-screen response (if any), sets the review mark, and moves on. */
export function markAndNext(a: Attempt): Attempt {
  const i = a.current - 1;
  const draft = a.states[i].draft;
  return advance(withState(a, i, { saved: draft, marked: true, visited: true }));
}

/** "Clear Response": removes both the on-screen and the saved response. The review mark is kept. */
export function clearResponse(a: Attempt): Attempt {
  return withState(a, a.current - 1, { draft: null, saved: null });
}

export function previous(a: Attempt): Attempt {
  return a.current > 1 ? goTo(a, a.current - 1) : a;
}

/** Add elapsed on-screen time to the current question (capped to ignore sleeps and closed tabs). */
export function tickTime(a: Attempt, now: number, visible: boolean, capMs = 5000): Attempt {
  const delta = Math.max(0, Math.min(now - a.lastTickAt, capMs));
  const i = a.current - 1;
  const states = visible ? a.states.map((s, k) => (k === i ? { ...s, timeMs: s.timeMs + delta } : s)) : a.states;
  return { ...a, states, lastTickAt: now };
}

export function statusCounts(states: QState[]): Record<QStatus, number> {
  const c: Record<QStatus, number> = { notVisited: 0, notAnswered: 0, answered: 0, marked: 0, answeredMarked: 0 };
  states.forEach((s) => { c[statusOf(s)]++; });
  return c;
}
