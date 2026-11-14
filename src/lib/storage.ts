// Browser-local persistence for attempts. No backend; data stays on this device.
import type { Attempt, Mock } from '../types';
import { emptyStates } from './examState';
import { makeDeadline, isExpired } from './timer';
import { scoreAttempt } from './scoring';

export const STORAGE_KEY = 'tiya-cat2026.v1';

export interface Store { version: 1; attempts: Attempt[] }

function safeGet(): string | null { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } }
function safeSet(v: string): boolean { try { localStorage.setItem(STORAGE_KEY, v); return true; } catch { return false; } }

export function loadStore(): Store {
  const raw = safeGet();
  if (!raw) return { version: 1, attempts: [] };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.attempts)) return { version: 1, attempts: parsed.attempts.filter(isAttempt) };
  } catch { /* fall through */ }
  return { version: 1, attempts: [] };
}

export function saveStore(s: Store): boolean { return safeSet(JSON.stringify(s)); }

export function isAttempt(a: unknown): a is Attempt {
  const x = a as Attempt;
  return !!x && typeof x.id === 'string' && typeof x.mockId === 'number' && typeof x.startedAt === 'number' && typeof x.deadline === 'number'
    && Array.isArray(x.states) && x.states.length === 24 && x.states.every((s) => s && typeof s.visited === 'boolean');
}

export function newAttempt(mockId: number, existing: Attempt[], now: number): Attempt {
  const attemptNo = existing.filter((a) => a.mockId === mockId).length + 1;
  const states = emptyStates();
  states[0] = { ...states[0], visited: true };
  return { id: `m${mockId}-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`, mockId, attemptNo, startedAt: now, deadline: makeDeadline(now),
    submittedAt: null, autoSubmitted: false, current: 1, states, lastTickAt: now, result: null };
}

/** Finalise an attempt: drop unsaved drafts, freeze, and store the result snapshot. Idempotent. */
export function finalise(a: Attempt, mock: Mock, now: number, auto: boolean): Attempt {
  if (a.submittedAt !== null) return a;
  const submittedAt = Math.min(now, a.deadline);
  const frozen: Attempt = { ...a, submittedAt, autoSubmitted: auto, states: a.states.map((s) => ({ ...s, draft: null })) };
  return { ...frozen, result: scoreAttempt(mock, frozen).summary };
}

/** Auto-submit every active attempt whose deadline has passed (e.g. candidate returns after closing the browser). */
export function finaliseExpired(store: Store, mocks: Mock[], now: number): { store: Store; changed: boolean } {
  let changed = false;
  const attempts = store.attempts.map((a) => {
    if (a.submittedAt === null && isExpired(now, a.deadline)) {
      const mock = mocks.find((m) => m.id === a.mockId);
      if (mock) { changed = true; return finalise(a, mock, now, true); }
    }
    return a;
  });
  return { store: { ...store, attempts }, changed };
}

export function exportJson(store: Store): string {
  return JSON.stringify({ app: 'tiya-cat2026-varc', version: 1, exportedAt: new Date().toISOString(), attempts: store.attempts }, null, 2);
}

/** Merge attempts from a backup. Existing attempts with the same id are kept; invalid entries are rejected. */
export function importJson(store: Store, text: string): { store: Store; added: number; skipped: number; rejected: number } {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('The file is not valid JSON.'); }
  const list = (parsed as { attempts?: unknown })?.attempts;
  if (!Array.isArray(list)) throw new Error('No "attempts" list found in this file.');
  const ids = new Set(store.attempts.map((a) => a.id));
  let added = 0, skipped = 0, rejected = 0;
  const incoming: Attempt[] = [];
  for (const a of list) {
    if (!isAttempt(a)) { rejected++; continue; }
    if (ids.has(a.id)) { skipped++; continue; }
    ids.add(a.id); incoming.push(a); added++;
  }
  return { store: { ...store, attempts: [...store.attempts, ...incoming].sort((x, y) => x.startedAt - y.startedAt) }, added, skipped, rejected };
}
