import { useStore, navigate } from '../App';
import { MOCKS } from '../data';
import { ASPIRATION, CANDIDATE, MOTTO, SiteFooter, SiteHeader, fmtDate, pct } from '../components/common';
import { MAX_MARKS } from '../lib/scoring';
import { formatClock, remainingMs } from '../lib/timer';

export default function Dashboard() {
  const { store, activeAttemptFor, storageOk } = useStore();
  return (
    <div className="page">
      <SiteHeader />
      <main className="container">
        <section className="candidate-hero" aria-label="Candidate">
          <div className="hero-id">
            <span className="k">Candidate</span>
            <div className="hero-name">{CANDIDATE}</div>
            <div className="hero-aim">{ASPIRATION}</div>
            <p className="hero-quote">“{MOTTO}”</p>
          </div>
          <dl className="hero-facts">
            <div><dt>Examination</dt><dd>CAT 2026 — VARC Practice</dd></div>
            <div><dt>Papers available</dt><dd>5 sectional mocks · 24 questions · 40 minutes each</dd></div>
            <div><dt>Attempts recorded</dt><dd>{store.attempts.filter((a) => a.submittedAt !== null).length} completed</dd></div>
          </dl>
        </section>
        {!storageOk && <div className="notice warn">This browser is blocking local storage. Progress cannot be saved. Please disable private browsing or allow site data.</div>}

        <h1 className="page-title">Available Tests</h1>
        <div className="mock-grid">
          {MOCKS.map((m) => {
            const attempts = store.attempts.filter((a) => a.mockId === m.id);
            const done = attempts.filter((a) => a.result).sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0));
            const active = activeAttemptFor(m.id);
            const best = done.length ? Math.max(...done.map((a) => a.result!.score)) : null;
            return (
              <article className="mock-card" key={m.id}>
                <header>
                  <h2>{m.title}</h2>
                  <span className="focus">{m.focus}</span>
                </header>
                <dl className="mock-meta">
                  <div><dt>Questions</dt><dd>24 ({m.mcqCount} MCQ · {m.titaCount} TITA)</dd></div>
                  <div><dt>Duration</dt><dd>40 minutes</dd></div>
                  <div><dt>Maximum marks</dt><dd>{MAX_MARKS}</dd></div>
                  <div><dt>Attempts</dt><dd>{done.length}{best !== null ? ` · best ${best}/${MAX_MARKS}` : ''}</dd></div>
                </dl>
                <div className="mock-actions">
                  {active ? (
                    <button className="btn primary" onClick={() => navigate(`#/exam/${active.id}`)}>Resume test · {formatClock(remainingMs(Date.now(), active.deadline))} left</button>
                  ) : (
                    <button className="btn primary" onClick={() => navigate(`#/mock/${m.id}`)}>{done.length ? 'Reattempt test' : 'Start test'}</button>
                  )}
                </div>
                {done.length > 0 && (
                  <table className="mini-history">
                    <thead><tr><th>Attempt</th><th>Date</th><th>Score</th><th>Accuracy</th><th></th></tr></thead>
                    <tbody>
                      {done.map((a) => (
                        <tr key={a.id}>
                          <td>#{a.attemptNo}</td>
                          <td>{fmtDate(a.submittedAt!)}</td>
                          <td><strong>{a.result!.score}</strong>/{MAX_MARKS}</td>
                          <td>{pct(a.result!.accuracy)}</td>
                          <td className="links"><a href={`#/result/${a.id}`}>Result</a> · <a href={`#/review/${a.id}`}>Review</a></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </article>
            );
          })}
        </div>
        <p className="muted small">Attempt history is stored only in this browser. It does not sync between devices. Use <a href="#/progress">Performance → Export</a> to keep a backup.</p>
      </main>
      <SiteFooter />
    </div>
  );
}
