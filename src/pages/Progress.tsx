import { useRef, useState } from 'react';
import { useStore } from '../App';
import { MOCKS, getMock } from '../data';
import { SiteFooter, SiteHeader, fmtDate, pct } from '../components/common';
import { MAX_MARKS, scoreAttempt } from '../lib/scoring';
import { formatDuration } from '../lib/timer';
import { exportJson, importJson } from '../lib/storage';
import type { Attempt } from '../types';

/** Collapse category labels such as "VA: odd sentence out (TITA)" into a skill name. */
export function skillOf(category: string) {
  return category.replace(/\s*\(TITA\)\s*/i, '').replace(/\s*\("[^"]*"\)/, '').trim();
}

export default function Progress() {
  const { store, replaceStore } = useStore();
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const done = store.attempts.filter((a) => a.submittedAt !== null && a.result).sort((a, b) => (a.submittedAt ?? 0) - (b.submittedAt ?? 0));

  // Aggregates
  const skill = new Map<string, { seen: number; wrong: number; skipped: number }>();
  let rcPts = 0, vaPts = 0, rcAtt = 0, rcCor = 0, vaAtt = 0, vaCor = 0;
  const time = { rc: 0, rcN: 0, va: 0, vaN: 0 };
  for (const a of done) {
    const mock = getMock(a.mockId); if (!mock) continue;
    const { questions } = scoreAttempt(mock, a);
    questions.forEach((r, i) => {
      const q = mock.questions[i];
      const k = skillOf(q.category);
      const cur = skill.get(k) ?? { seen: 0, wrong: 0, skipped: 0 };
      cur.seen++; if (r.outcome === 'incorrect') cur.wrong++; if (r.outcome === 'unattempted') cur.skipped++;
      skill.set(k, cur);
      if (r.section === 'RC') { rcPts += r.marks; if (r.outcome !== 'unattempted') rcAtt++; if (r.outcome === 'correct') rcCor++; if (r.timeMs > 0) { time.rc += r.timeMs; time.rcN++; } }
      else { vaPts += r.marks; if (r.outcome !== 'unattempted') vaAtt++; if (r.outcome === 'correct') vaCor++; if (r.timeMs > 0) { time.va += r.timeMs; time.vaN++; } }
    });
  }
  // Rank by answers actually got wrong; unattempted shown separately so untouched categories do not dominate.
  const skills = [...skill.entries()].filter(([, v]) => v.wrong + v.skipped > 0)
    .sort((a, b) => b[1].wrong - a[1].wrong || b[1].wrong / b[1].seen - a[1].wrong / a[1].seen || b[1].skipped - a[1].skipped).slice(0, 10);

  const doExport = () => {
    const blob = new Blob([exportJson(store)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `tiya-cat2026-attempts-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    setMsg(`Exported ${store.attempts.length} attempt(s).`);
  };
  const doImport = async (f: File) => {
    try {
      const r = importJson(store, await f.text());
      replaceStore(r.store);
      setMsg(`Imported ${r.added} attempt(s). ${r.skipped} were already present and ${r.rejected} were invalid and ignored.`);
    } catch (e) { setMsg((e as Error).message); }
  };

  return (
    <div className="page">
      <SiteHeader />
      <main className="container">
        <h1 className="page-title">Performance</h1>
        <p className="muted">All data on this page is stored only in this browser on this device. It does not sync automatically to other devices or browsers. Export a backup and import it elsewhere if needed.</p>

        <div className="actions-row left">
          <button className="btn" onClick={doExport}>Export attempt history (JSON)</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>Import from backup</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = ''; }} />
        </div>
        {msg && <div className="notice" role="status">{msg}</div>}

        {done.length === 0 ? <p>No completed attempts yet. <a href="#/">Start a mock</a>.</p> : (
          <>
            <h2 className="section-title">Score progression</h2>
            <ScoreGraph attempts={done} />

            <h2 className="section-title">Mock summary</h2>
            <table className="data-table">
              <thead><tr><th>Mock</th><th>Focus</th><th>Attempts</th><th>Best</th><th>Latest</th><th>Latest accuracy</th></tr></thead>
              <tbody>
                {MOCKS.map((m) => {
                  const as = done.filter((a) => a.mockId === m.id);
                  const last = as[as.length - 1];
                  return (
                    <tr key={m.id}>
                      <td>{m.title}</td><td>{m.focus}</td><td>{as.length}</td>
                      <td>{as.length ? `${Math.max(...as.map((a) => a.result!.score))}/${MAX_MARKS}` : '—'}</td>
                      <td>{last ? `${last.result!.score}/${MAX_MARKS}` : '—'}</td>
                      <td>{last ? pct(last.result!.accuracy) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <h2 className="section-title">RC versus VA (all completed attempts)</h2>
            <div className="stat-grid wide">
              <div className="stat"><div className="stat-v">{pct(rcPts / (48 * done.length))}</div><div className="stat-l">RC marks obtained</div><div className="stat-h">{rcPts} of {48 * done.length} possible</div></div>
              <div className="stat"><div className="stat-v">{rcAtt ? pct(rcCor / rcAtt) : '—'}</div><div className="stat-l">RC accuracy</div><div className="stat-h">{rcCor} correct of {rcAtt} attempted</div></div>
              <div className="stat"><div className="stat-v">{pct(vaPts / (24 * done.length))}</div><div className="stat-l">VA marks obtained</div><div className="stat-h">{vaPts} of {24 * done.length} possible</div></div>
              <div className="stat"><div className="stat-v">{vaAtt ? pct(vaCor / vaAtt) : '—'}</div><div className="stat-l">VA accuracy</div><div className="stat-h">{vaCor} correct of {vaAtt} attempted</div></div>
              <div className="stat"><div className="stat-v">{time.rcN ? formatDuration(time.rc / time.rcN) : '—'}</div><div className="stat-l">Avg time per RC question</div><div className="stat-h">questions viewed</div></div>
              <div className="stat"><div className="stat-v">{time.vaN ? formatDuration(time.va / time.vaN) : '—'}</div><div className="stat-l">Avg time per VA question</div><div className="stat-h">questions viewed</div></div>
            </div>

            <h2 className="section-title">Frequently missed skill categories</h2>
            {skills.length === 0 ? <p className="muted">Nothing missed yet.</p> : (
              <table className="data-table">
                <thead><tr><th>Skill category (from the solution key)</th><th>Answered incorrectly</th><th>Left unattempted</th><th>Seen</th><th>Error rate when attempted</th></tr></thead>
                <tbody>{skills.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v.wrong}</td><td>{v.skipped}</td><td>{v.seen}</td><td>{v.seen - v.skipped ? pct(v.wrong / (v.seen - v.skipped)) : '—'}</td></tr>)}</tbody>
              </table>
            )}

            <h2 className="section-title">All attempts</h2>
            <table className="data-table">
              <thead><tr><th>Date</th><th>Mock</th><th>Attempt</th><th>Score</th><th>C / I / U</th><th>Accuracy</th><th>RC</th><th>VA</th><th>Time used</th><th></th></tr></thead>
              <tbody>
                {[...done].reverse().map((a) => (
                  <tr key={a.id}>
                    <td>{fmtDate(a.submittedAt!)}</td><td>Mock {a.mockId}</td><td>#{a.attemptNo}{a.autoSubmitted ? ' (auto)' : ''}</td>
                    <td><strong>{a.result!.score}</strong>/{MAX_MARKS}</td>
                    <td>{a.result!.correct} / {a.result!.incorrect} / {a.result!.unattempted}</td>
                    <td>{pct(a.result!.accuracy)}</td><td>{a.result!.rcScore}/48</td><td>{a.result!.vaScore}/24</td>
                    <td>{formatDuration(a.result!.timeUsedMs)}</td>
                    <td className="links"><a href={`#/result/${a.id}`}>Result</a> · <a href={`#/review/${a.id}`}>Review</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function ScoreGraph({ attempts }: { attempts: Attempt[] }) {
  const W = 760, H = 240, P = { l: 44, r: 16, t: 14, b: 34 };
  const scores = attempts.map((a) => a.result!.score);
  const yMin = Math.min(0, ...scores), yMax = MAX_MARKS;
  const x = (i: number) => P.l + (attempts.length === 1 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (attempts.length - 1));
  const y = (v: number) => P.t + ((yMax - v) * (H - P.t - P.b)) / (yMax - yMin);
  const ticks = [yMin, 0, 18, 36, 54, 72].filter((v, i, arr) => arr.indexOf(v) === i && v >= yMin);
  return (
    <figure className="graph">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Scores over ${attempts.length} attempts: ${scores.join(', ')}`}>
        {ticks.map((t) => (
          <g key={t}><line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} className="grid" /><text x={P.l - 8} y={y(t) + 4} textAnchor="end" className="axis">{t}</text></g>
        ))}
        <polyline fill="none" className="line" points={attempts.map((a, i) => `${x(i)},${y(a.result!.score)}`).join(' ')} />
        {attempts.map((a, i) => (
          <g key={a.id}>
            <circle cx={x(i)} cy={y(a.result!.score)} r={4} className="dot"><title>{`Mock ${a.mockId} #${a.attemptNo}: ${a.result!.score}/72`}</title></circle>
            <text x={x(i)} y={H - 12} textAnchor="middle" className="axis">M{a.mockId}{a.attemptNo > 1 ? `#${a.attemptNo}` : ''}</text>
          </g>
        ))}
      </svg>
      <figcaption className="muted small">Total score (out of 72) for each completed attempt, in date order.</figcaption>
    </figure>
  );
}
