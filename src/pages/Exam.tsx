import { useEffect, useRef, useState } from 'react';
import { navigate, useStore } from '../App';
import { getMock } from '../data';
import { CANDIDATE, Legend, StatusTile } from '../components/common';
import { LeftPanel, RightPanel } from '../components/QuestionView';
import { clearResponse, goTo, markAndNext, previous, saveAndNext, selectDraft, statusCounts, statusOf, tickTime, STATUS_LABEL } from '../lib/examState';
import { formatClock, inWarning, isExpired, remainingMs } from '../lib/timer';
import type { QStatus } from '../types';

export default function Exam({ attemptId }: { attemptId: string }) {
  const { getAttempt, updateAttempt, submitAttempt } = useStore();
  const attempt = getAttempt(attemptId);
  const mock = attempt ? getMock(attempt.mockId) : undefined;
  const [now, setNow] = useState(Date.now());
  const [confirming, setConfirming] = useState(false);
  const [isFs, setIsFs] = useState(!!document.fullscreenElement);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  // Redirects: unknown attempt → dashboard; submitted → result.
  useEffect(() => {
    if (!attempt) navigate('#/');
    else if (attempt.submittedAt !== null) navigate(`#/result/${attempt.id}`);
  }, [attempt]);

  // Wall-clock driven timer; auto-submits at the stored deadline.
  useEffect(() => {
    if (!attempt || attempt.submittedAt !== null) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (isExpired(t, attempt.deadline)) submitAttempt(attempt.id, true);
    }, 250);
    return () => window.clearInterval(id);
  }, [attempt?.id, attempt?.deadline, attempt?.submittedAt, submitAttempt]);

  // Per-question time accounting, persisted once per second.
  useEffect(() => {
    if (!attempt || attempt.submittedAt !== null) return;
    const id = window.setInterval(() => {
      updateAttempt(attempt.id, (a) => tickTime(a, Date.now(), document.visibilityState === 'visible'));
    }, 1000);
    return () => window.clearInterval(id);
  }, [attempt?.id, attempt?.submittedAt, updateAttempt]);

  useEffect(() => {
    const on = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);

  // Reset scroll position of both panes when the question changes (passage pane only when the passage changes).
  const q = mock && attempt ? mock.questions[attempt.current - 1] : undefined;
  const leftKey = q ? (q.section === 'RC' ? `p${q.passageNumber}` : `q${q.number}`) : '';
  useEffect(() => { leftRef.current?.scrollTo(0, 0); }, [leftKey]);
  useEffect(() => { rightRef.current?.scrollTo(0, 0); }, [q?.number]);

  if (!attempt || !mock || !q || attempt.submittedAt !== null) return <div className="page"><p className="container">Loading…</p></div>;

  const remaining = remainingMs(now, attempt.deadline);
  const warn = inWarning(now, attempt.deadline);
  const st = attempt.states[attempt.current - 1];
  const counts = statusCounts(attempt.states);
  const act = (f: typeof saveAndNext) => updateAttempt(attempt.id, (a) => f(tickTime(a, Date.now(), true)));
  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  return (
    <div className="exam">
      <header className="exam-header">
        <div className="eh-left">
          <div className="eh-brand">TIYA MADAN | CAT 2026</div>
          <div className="eh-sub">Candidate: <strong>{CANDIDATE}</strong> · {mock.title} · Section: <strong>VARC</strong></div>
        </div>
        <div className="eh-right">
          <button type="button" className="btn small ghost" onClick={toggleFs} aria-pressed={isFs}>{isFs ? 'Exit full screen' : 'Full screen'}</button>
          <div className={`timer${warn ? ' timer-warn' : ''}`} role="timer" aria-live="off" aria-label={`Time left ${formatClock(remaining)}`}>
            <span className="timer-label">Time Left</span>
            <span className="timer-value" data-testid="timer">{formatClock(remaining)}</span>
          </div>
        </div>
      </header>
      {warn && <div className="warn-strip" role="status">Less than five minutes remain. The test will be submitted automatically at 00:00.</div>}
      <div className="section-bar"><span className="section-tab active">VARC</span><span className="muted small">Question {attempt.current} of 24 · {q.section === 'RC' ? 'Reading Comprehension' : 'Verbal Ability'}</span></div>

      <div className="exam-body">
        <div className="exam-main">
          <div className="pane left" ref={leftRef} tabIndex={0} aria-label="Passage and directions"><LeftPanel mock={mock} q={q} /></div>
          <div className="pane right" ref={rightRef} aria-label="Question">
            <RightPanel q={q} value={st.draft} onChange={(v) => updateAttempt(attempt.id, (a) => selectDraft(a, v))} />
          </div>
        </div>
        <aside className="palette" aria-label="Question palette">
          <div className="palette-candidate"><div className="avatar" aria-hidden="true">TM</div><div><strong>{CANDIDATE}</strong><div className="muted small">{mock.title} · VARC</div></div></div>
          <Legend counts={counts} />
          <div className="palette-title">Choose a question</div>
          <div className="palette-grid">
            {attempt.states.map((s, i) => (
              <StatusTile key={i} status={statusOf(s)} label={i + 1} current={attempt.current === i + 1}
                onClick={() => updateAttempt(attempt.id, (a) => goTo(tickTime(a, Date.now(), true), i + 1))} />
            ))}
          </div>
          <button type="button" className="btn submit" onClick={() => setConfirming(true)}>Submit</button>
        </aside>
      </div>

      <footer className="exam-footer">
        <div className="ef-left">
          <button type="button" className="btn" onClick={() => act(markAndNext)}>Mark for Review &amp; Next</button>
          <button type="button" className="btn" onClick={() => act(clearResponse)}>Clear Response</button>
        </div>
        <div className="ef-right">
          <button type="button" className="btn" onClick={() => act(previous)} disabled={attempt.current === 1}>Previous</button>
          <button type="button" className="btn primary" onClick={() => act(saveAndNext)}>Save &amp; Next</button>
        </div>
      </footer>

      {confirming && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="submit-title">
          <div className="modal">
            <h2 id="submit-title">Exam summary — submit {mock.title}?</h2>
            <table className="info-table compact">
              <tbody>
                {(['answered', 'notAnswered', 'notVisited', 'marked', 'answeredMarked'] as QStatus[]).map((k) => (
                  <tr key={k}><th>{STATUS_LABEL[k]}</th><td>{counts[k]}</td></tr>
                ))}
                <tr><th>Time left</th><td>{formatClock(remaining)}</td></tr>
              </tbody>
            </table>
            <p className="small">After you submit, you cannot change any answer. Unsaved selections are not evaluated.</p>
            <div className="actions-row">
              <button type="button" className="btn" onClick={() => setConfirming(false)}>No, return to the test</button>
              <button type="button" className="btn primary" onClick={() => { setConfirming(false); submitAttempt(attempt.id, false); }}>Yes, submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
