import { describe, expect, it } from 'vitest';
import { EXAM_MS, formatClock, inWarning, isExpired, makeDeadline, remainingMs } from '../src/lib/timer';
import { finalise, finaliseExpired, newAttempt, importJson, exportJson } from '../src/lib/storage';
import { MOCKS } from '../src/data';

describe('wall-clock timer', () => {
  it('every test lasts exactly 40 minutes from the start', () => {
    expect(EXAM_MS).toBe(2_400_000);
    expect(makeDeadline(5000)).toBe(5000 + 2_400_000);
  });
  it('displays 40:00 at start and 00:00 at expiry', () => {
    const d = makeDeadline(0);
    expect(formatClock(remainingMs(0, d))).toBe('40:00');
    expect(formatClock(remainingMs(1, d))).toBe('40:00');
    expect(formatClock(remainingMs(1000, d))).toBe('39:59');
    expect(formatClock(remainingMs(d - 1, d))).toBe('00:01');
    expect(formatClock(remainingMs(d, d))).toBe('00:00');
    expect(formatClock(remainingMs(d + 99_999, d))).toBe('00:00');
  });
  it('remaining time depends only on the stored deadline (refresh-safe)', () => {
    const a = newAttempt(1, [], 10_000);
    const afterReload = JSON.parse(JSON.stringify(a));
    expect(remainingMs(10_000 + 600_000, afterReload.deadline)).toBe(1_800_000);
  });
  it('warning window is the last five minutes only', () => {
    const d = makeDeadline(0);
    expect(inWarning(d - 300_001, d)).toBe(false);
    expect(inWarning(d - 300_000, d)).toBe(true);
    expect(inWarning(d, d)).toBe(false);
    expect(isExpired(d - 1, d)).toBe(false);
    expect(isExpired(d, d)).toBe(true);
  });
});

describe('auto-submission', () => {
  it('finalises expired attempts on load, discards drafts, and records the result', () => {
    const a = newAttempt(1, [], 0);
    a.states[0] = { ...a.states[0], saved: 'C', draft: 'C' };
    a.states[1] = { ...a.states[1], visited: true, draft: 'B' };
    const { store, changed } = finaliseExpired({ version: 1, attempts: [a] }, MOCKS, a.deadline + 5 * 60_000);
    expect(changed).toBe(true);
    const f = store.attempts[0];
    expect(f.submittedAt).toBe(a.deadline);
    expect(f.autoSubmitted).toBe(true);
    expect(f.states.every((s) => s.draft === null)).toBe(true);
    expect(f.result?.score).toBe(3);
    expect(f.result?.timeUsedMs).toBe(EXAM_MS);
  });
  it('leaves running attempts alone and is idempotent after submission', () => {
    const a = newAttempt(2, [], 0);
    expect(finaliseExpired({ version: 1, attempts: [a] }, MOCKS, a.deadline - 1).changed).toBe(false);
    const s1 = finalise(a, MOCKS[1], 1000, false);
    const s2 = finalise(s1, MOCKS[1], 999_999, true);
    expect(s2).toBe(s1);
    expect(s1.autoSubmitted).toBe(false);
  });
  it('separate attempt numbers for reattempts', () => {
    const a1 = newAttempt(3, [], 0);
    const a2 = newAttempt(3, [a1], 10);
    expect(a2.attemptNo).toBe(2);
    expect(a2.id).not.toBe(a1.id);
  });
});

describe('backup export/import', () => {
  it('round-trips and skips duplicates; rejects invalid entries', () => {
    const a = finalise(newAttempt(1, [], 0), MOCKS[0], 1000, false);
    const text = exportJson({ version: 1, attempts: [a] });
    const into = importJson({ version: 1, attempts: [] }, text);
    expect(into.added).toBe(1);
    const again = importJson(into.store, text);
    expect(again.added).toBe(0); expect(again.skipped).toBe(1);
    const bad = importJson({ version: 1, attempts: [] }, JSON.stringify({ attempts: [{ id: 1 }] }));
    expect(bad.rejected).toBe(1);
    expect(() => importJson({ version: 1, attempts: [] }, 'not json')).toThrow();
  });
});
