// Deterministic scoring engine. +3 correct; −1 wrong MCQ; 0 wrong TITA; 0 unattempted. Max 72.
import type { Attempt, Mock, Question, ResultSnapshot } from '../types';
import { normaliseTita } from './examState';

export const MARKS = { correct: 3, wrongMcq: -1, wrongTita: 0, unattempted: 0 } as const;

export interface QuestionResult {
  number: number;
  section: 'RC' | 'VA';
  isTita: boolean;
  response: string | null;
  answer: string;
  outcome: 'correct' | 'incorrect' | 'unattempted';
  marks: number;
  marked: boolean;
  timeMs: number;
}

export function isCorrect(q: Pick<Question, 'isTita' | 'answer'>, response: string): boolean {
  if (q.isTita) return normaliseTita(response) === normaliseTita(q.answer);
  return response.trim().toUpperCase() === q.answer.trim().toUpperCase();
}

export function scoreQuestion(q: Pick<Question, 'number' | 'section' | 'isTita' | 'answer'>, response: string | null): { outcome: QuestionResult['outcome']; marks: number } {
  const r = response === null ? null : q.isTita ? normaliseTita(response) : response.trim() || null;
  if (r === null) return { outcome: 'unattempted', marks: MARKS.unattempted };
  if (isCorrect(q, r)) return { outcome: 'correct', marks: MARKS.correct };
  return { outcome: 'incorrect', marks: q.isTita ? MARKS.wrongTita : MARKS.wrongMcq };
}

export function scoreAttempt(mock: Mock, attempt: Attempt): { questions: QuestionResult[]; summary: ResultSnapshot } {
  const questions = mock.questions.map((q, i) => {
    const st = attempt.states[i];
    const response = st ? st.saved : null; // only saved responses are evaluated (CAT rule)
    const { outcome, marks } = scoreQuestion(q, response);
    return { number: q.number, section: q.section, isTita: q.isTita, response, answer: q.answer, outcome, marks, marked: !!st?.marked, timeMs: st?.timeMs ?? 0 };
  });
  return { questions, summary: summarise(questions, attempt) };
}

export function summarise(qs: QuestionResult[], attempt: Pick<Attempt, 'startedAt' | 'submittedAt' | 'deadline'>): ResultSnapshot {
  const correct = qs.filter((q) => q.outcome === 'correct').length;
  const incorrect = qs.filter((q) => q.outcome === 'incorrect').length;
  const unattempted = qs.filter((q) => q.outcome === 'unattempted').length;
  const attempted = correct + incorrect;
  const sum = (f: (q: QuestionResult) => boolean) => qs.filter(f).reduce((a, q) => a + q.marks, 0);
  const end = attempt.submittedAt ?? attempt.deadline;
  return {
    score: sum(() => true),
    correct, incorrect, unattempted, attempted,
    rcScore: sum((q) => q.section === 'RC'),
    vaScore: sum((q) => q.section === 'VA'),
    accuracy: attempted ? correct / attempted : 0,
    attemptRate: qs.length ? attempted / qs.length : 0,
    timeUsedMs: Math.max(0, Math.min(end, attempt.deadline) - attempt.startedAt),
  };
}

export const MAX_MARKS = 72;
