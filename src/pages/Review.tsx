import { useEffect, useMemo, useRef, useState } from 'react';
import { navigate, useStore } from '../App';
import { getMock } from '../data';
import { Html, KIND_LABEL, SiteHeader } from '../components/common';
import { LeftPanel, RightPanel } from '../components/QuestionView';
import { scoreAttempt } from '../lib/scoring';
import { formatDuration } from '../lib/timer';

type Filter = 'all' | 'incorrect' | 'unattempted' | 'marked';

export default function Review({ attemptId, initialQ }: { attemptId: string; initialQ?: number }) {
  const { getAttempt } = useStore();
  const attempt = getAttempt(attemptId);
  const mock = attempt ? getMock(attempt.mockId) : undefined;
  const [filter, setFilter] = useState<Filter>('all');
  const [current, setCurrent] = useState<number>(initialQ && initialQ >= 1 && initialQ <= 24 ? initialQ : 1);
  const [showNotes, setShowNotes] = useState(false);
  const rightRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (attempt && attempt.submittedAt === null) navigate(`#/exam/${attempt.id}`); }, [attempt]);
  useEffect(() => { rightRef.current?.scrollTo(0, 0); }, [current]);

  const scored = useMemo(() => (mock && attempt ? scoreAttempt(mock, attempt) : null), [mock, attempt]);
  if (!attempt || !mock || !scored) return <div className="page"><SiteHeader /><main className="container"><p>Attempt not found. <a href="#/">Back to dashboard</a></p></main></div>;
  if (attempt.submittedAt === null) return null;

  const list = scored.questions.filter((r) =>
    filter === 'all' ? true : filter === 'incorrect' ? r.outcome === 'incorrect' : filter === 'unattempted' ? r.outcome === 'unattempted' : r.marked);
  const counts = {
    all: 24,
    incorrect: scored.questions.filter((r) => r.outcome === 'incorrect').length,
    unattempted: scored.questions.filter((r) => r.outcome === 'unattempted').length,
    marked: scored.questions.filter((r) => r.marked).length,
  };
  const r = scored.questions[current - 1];
  const q = mock.questions[current - 1];
  const passage = q.passageNumber ? mock.passages.find((p) => p.number === q.passageNumber) : undefined;
  const idx = list.findIndex((x) => x.number === current);
  const go = (n: number) => setCurrent(n);

  return (
    <div className="review">
      <SiteHeader right={<a href={`#/result/${attempt.id}`}>Result</a>} />
      <div className="review-bar">
        <div><strong>Answer review — {mock.title}</strong> <span className="muted">· Attempt #{attempt.attemptNo} · Score {scored.summary.score}/72 · read-only</span></div>
        <div className="filters" role="tablist" aria-label="Filter questions">
          {(['all', 'incorrect', 'unattempted', 'marked'] as Filter[]).map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} className={`chip${filter === f ? ' chip-on' : ''}`}
              onClick={() => { setFilter(f); const first = scored.questions.find((x) => f === 'all' || (f === 'incorrect' ? x.outcome === 'incorrect' : f === 'unattempted' ? x.outcome === 'unattempted' : x.marked)); if (first) setCurrent(first.number); }}>
              {f === 'all' ? 'All questions' : f === 'incorrect' ? 'Incorrect' : f === 'unattempted' ? 'Unattempted' : 'Marked for review'} ({counts[f]})
            </button>
          ))}
        </div>
      </div>
      <div className="review-qnav" aria-label="Questions in this filter">
        {list.length === 0 && <span className="muted small">No questions in this filter.</span>}
        {list.map((x) => (
          <button key={x.number} className={`qchip q-${x.outcome}${x.number === current ? ' q-current' : ''}`} onClick={() => go(x.number)}
            aria-label={`Question ${x.number}: ${x.outcome}`}>{x.number}</button>
        ))}
      </div>
      <div className="review-body">
        <div className="pane left" tabIndex={0}><LeftPanel mock={mock} q={q} /></div>
        <div className="pane right" ref={rightRef}>
          <div className={`verdict v-${r.outcome}`}>
            {r.outcome === 'correct' ? 'Correct' : r.outcome === 'incorrect' ? 'Incorrect' : 'Not attempted'} · {r.marks > 0 ? `+${r.marks}` : r.marks} marks
            {r.marked && <span className="muted"> · marked for review</span>}
            <span className="muted"> · time on question {formatDuration(r.timeMs)}</span>
          </div>
          <RightPanel q={q} value={r.response} readOnly review={{ response: r.response }} />
          <div className="review-meta">
            <div><span className="k">Your response</span><span className="v">{r.response ?? 'Not attempted'}</span></div>
            <div><span className="k">Correct answer</span><span className="v">{q.answer}</span></div>
            <div><span className="k">Reasoning skill</span><span className="v">{q.category}</span></div>
            <div><span className="k">Difficulty estimate</span><span className="v">{q.difficulty}</span></div>
            <div><span className="k">Type</span><span className="v">{KIND_LABEL[q.kind]}{q.isTita ? ' (TITA)' : ''}</span></div>
          </div>
          <section className="explanation" aria-label="Explanation">
            <h3>Explanation</h3>
            <p className="muted small">{q.explanationHeading}</p>
            <Html html={q.explanationHtml} />
            {q.takeawayHtml && <div className="takeaway"><strong>Learning takeaway:</strong> <Html as="span" html={q.takeawayHtml} /></div>}
          </section>
          {passage && passage.notesHtml && (
            <section className="explanation notes">
              <button className="linkish" onClick={() => setShowNotes((v) => !v)} aria-expanded={showNotes}>{showNotes ? 'Hide' : 'Show'} passage structure notes: {passage.notesTitle}</button>
              {showNotes && <Html html={passage.notesHtml} />}
            </section>
          )}
          <div className="actions-row">
            <button className="btn" disabled={idx <= 0} onClick={() => go(list[idx - 1].number)}>Previous</button>
            <button className="btn primary" disabled={idx < 0 || idx >= list.length - 1} onClick={() => go(list[idx + 1].number)}>Next</button>
          </div>
          <details className="paper-notes">
            <summary>Diagnostic guide for {mock.title}</summary>
            {mock.strategyHtml && <><h4>Strategy note</h4><Html html={mock.strategyHtml} /></>}
            <h4>Diagnostic guide</h4>
            <Html html={mock.diagnosticHtml} />
            <p className="muted small">Difficulty spread recomputed from the per-question labels: Easy {mock.difficulty.recomputed.easy}, Moderate {mock.difficulty.recomputed.moderate}, Difficult {mock.difficulty.recomputed.difficult}, Very difficult {mock.difficulty.recomputed.veryDifficult}. These labels are the setter's estimates and have not been validated against real candidate responses.</p>
          </details>
        </div>
      </div>
    </div>
  );
}
