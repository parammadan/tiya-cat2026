import { useEffect } from 'react';
import { navigate, useStore } from '../App';
import { getMock } from '../data';
import { KIND_LABEL, MOTTO, SiteFooter, SiteHeader, fmtDate, pct } from '../components/common';
import { MAX_MARKS, scoreAttempt } from '../lib/scoring';
import { formatDuration } from '../lib/timer';

export default function Result({ attemptId }: { attemptId: string }) {
  const { getAttempt } = useStore();
  const attempt = getAttempt(attemptId);
  const mock = attempt ? getMock(attempt.mockId) : undefined;
  useEffect(() => {
    if (attempt && attempt.submittedAt === null) navigate(`#/exam/${attempt.id}`);
  }, [attempt]);
  if (!attempt || !mock) return <div className="page"><SiteHeader /><main className="container"><p>Attempt not found. <a href="#/">Back to dashboard</a></p></main></div>;
  if (attempt.submittedAt === null) return null;

  const { questions, summary: s } = scoreAttempt(mock, attempt);
  const rcCorrect = questions.filter((q) => q.section === 'RC' && q.outcome === 'correct').length;
  const vaCorrect = questions.filter((q) => q.section === 'VA' && q.outcome === 'correct').length;

  return (
    <div className="page">
      <SiteHeader />
      <main className="container">
        <h1 className="page-title">Result — {mock.title} <span className="muted">(Attempt #{attempt.attemptNo})</span></h1>
        <p className="muted">
          Submitted {fmtDate(attempt.submittedAt)}{attempt.autoSubmitted ? ' · submitted automatically when the time ran out' : ''}.
          Scores use CAT-style marking: +3 for a correct answer; −1 for a wrong MCQ; 0 for a wrong TITA; 0 if not attempted.
        </p>
        <section className="score-hero" aria-label="Score summary">
          <div className="score-main"><span className="score-num" data-testid="score">{s.score}</span><span className="score-max">/ {MAX_MARKS}</span><div className="muted small">Total score</div></div>
          <div className="stat-grid">
            <Stat label="Correct" value={s.correct} cls="ok" />
            <Stat label="Incorrect" value={s.incorrect} cls="bad" />
            <Stat label="Unattempted" value={s.unattempted} />
            <Stat label="Accuracy" value={pct(s.accuracy)} hint="correct ÷ attempted" />
            <Stat label="Attempt rate" value={pct(s.attemptRate)} hint="attempted ÷ 24" />
            <Stat label="RC score" value={`${s.rcScore} / 48`} hint={`${rcCorrect} of 16 correct`} />
            <Stat label="VA score" value={`${s.vaScore} / 24`} hint={`${vaCorrect} of 8 correct`} />
            <Stat label="Time used" value={formatDuration(s.timeUsedMs)} hint="of 40 minutes" />
          </div>
        </section>
        <p className="muted small">No percentile or rank is shown. This practice data cannot support one.</p>

        <div className="actions-row left">
          <a className="btn primary" href={`#/review/${attempt.id}`}>Review answers and explanations</a>
          <a className="btn" href="#/">Back to dashboard</a>
          <a className="btn" href="#/progress">Performance history</a>
        </div>

        <h2 className="section-title">Question-by-question performance</h2>
        <table className="data-table" data-testid="qtable">
          <thead><tr><th>Q</th><th>Section</th><th>Type</th><th>Your response</th><th>Correct answer</th><th>Outcome</th><th>Marks</th><th>Time on question</th><th></th></tr></thead>
          <tbody>
            {questions.map((r) => {
              const q = mock.questions[r.number - 1];
              return (
                <tr key={r.number} className={`row-${r.outcome}`}>
                  <td>{r.number}</td>
                  <td>{r.section}</td>
                  <td>{KIND_LABEL[q.kind]}{q.isTita ? ' (TITA)' : ''}</td>
                  <td>{r.response ?? <span className="muted">—</span>}</td>
                  <td>{r.answer}</td>
                  <td className={`outcome ${r.outcome}`}>{r.outcome === 'correct' ? 'Correct' : r.outcome === 'incorrect' ? 'Incorrect' : 'Not attempted'}{r.marked ? ' · marked' : ''}</td>
                  <td>{r.marks > 0 ? `+${r.marks}` : r.marks}</td>
                  <td>{formatDuration(r.timeMs)}</td>
                  <td><a href={`#/review/${attempt.id}/${r.number}`}>Review</a></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="muted small">Time on question counts only the time the question was on screen while the test tab was visible.</p>
        <p className="result-quote">“{MOTTO}”</p>
      </main>
      <SiteFooter />
    </div>
  );
}

function Stat({ label, value, hint, cls }: { label: string; value: string | number; hint?: string; cls?: string }) {
  return (
    <div className={`stat ${cls ?? ''}`}>
      <div className="stat-v">{value}</div>
      <div className="stat-l">{label}</div>
      {hint && <div className="stat-h">{hint}</div>}
    </div>
  );
}
