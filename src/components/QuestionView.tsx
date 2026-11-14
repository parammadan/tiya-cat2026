import type { Mock, Question } from '../types';
import { Html, KIND_LABEL } from './common';
import { normaliseTita } from '../lib/examState';

const gapHtml = (html: string) => html.replace(/_{2,}\((\d)\)_{2,}/g, '<span class="gap">($1)</span>');

const PROMPT: Record<string, string> = {
  summary: 'Choose the option that best captures the essence of the passage.',
  placement: 'Choose the position (1, 2, 3 or 4) where the missing sentence fits best.',
  parajumble: 'Type the correct sequence of the four sentence numbers as four digits (format example: 1234).',
  oddoneout: 'Type the number of the odd sentence (a single digit).',
};

/** Left panel: passage for RC; directions and material for VA. */
export function LeftPanel({ mock, q }: { mock: Mock; q: Question }) {
  if (q.section === 'RC') {
    const p = mock.passages.find((x) => x.number === q.passageNumber)!;
    return (
      <div className="passage">
        <div className="panel-label">Passage {p.number} <span className="muted">(Questions {p.firstQ}–{p.lastQ})</span></div>
        <p className="directions">The passage below is accompanied by a set of questions. Choose the best answer to each question.</p>
        {p.paragraphsHtml.map((h, i) => <Html key={i} as="p" html={h} />)}
      </div>
    );
  }
  return (
    <div className="passage">
      <div className="panel-label">Verbal Ability <span className="muted">· {KIND_LABEL[q.kind]}</span></div>
      <Html as="p" className="directions" html={q.stemHtml} />
      {q.kind === 'summary' && q.bodyHtml.map((h, i) => <Html key={i} as="p" html={h} />)}
      {q.kind === 'placement' && (
        <>
          <div className="insert-sentence"><strong>Sentence:</strong> <Html as="span" html={q.insertSentenceHtml ?? ''} /></div>
          <p><strong>Paragraph:</strong> <Html as="span" html={gapHtml(q.placementParagraphHtml ?? '')} /></p>
        </>
      )}
      {(q.kind === 'parajumble' || q.kind === 'oddoneout') && (
        <ol className="sentences">
          {q.sentences.map((s) => <li key={s.n}><span className="sn">{s.n}.</span> <Html as="span" html={s.html} /></li>)}
        </ol>
      )}
    </div>
  );
}

interface RightProps {
  q: Question;
  value: string | null;
  onChange?: (v: string | null) => void;
  readOnly?: boolean;
  review?: { response: string | null };
}

/** Right panel: question stem and answer controls. In review mode, marks the candidate response and the key. */
export function RightPanel({ q, value, onChange, readOnly, review }: RightProps) {
  const isRc = q.section === 'RC';
  return (
    <div className="question">
      <div className="q-head">
        <span className="q-no">Question {q.number}</span>
        <span className="q-type">{q.isTita ? 'TITA' : 'MCQ'}</span>
        <span className="q-marks">{q.isTita ? '+3 / 0' : '+3 / −1'}</span>
      </div>
      {isRc ? <Html as="p" className="stem" html={q.stemHtml} /> : <p className="stem">{PROMPT[q.kind]}</p>}
      {!q.isTita ? (
        <div className="options" role="radiogroup" aria-label={`Options for question ${q.number}`}>
          {q.options.map((o) => {
            const checked = value === o.key;
            let rv = '';
            if (review) {
              if (o.key === q.answer) rv = ' opt-correct';
              else if (review.response === o.key) rv = ' opt-wrong';
            }
            return (
              <label key={o.key} className={`option${checked ? ' opt-selected' : ''}${rv}`}>
                <input type="radio" name={`q${q.number}`} value={o.key} checked={checked} disabled={readOnly}
                  onChange={() => onChange?.(o.key)} />
                <span className="opt-key">({o.key})</span>
                <Html as="span" className="opt-text" html={q.kind === 'placement' ? o.html : o.html} />
                {review && o.key === q.answer && <span className="opt-badge ok">Correct answer</span>}
                {review && review.response === o.key && o.key !== q.answer && <span className="opt-badge bad">Your answer</span>}
                {review && review.response === o.key && o.key === q.answer && <span className="opt-badge ok2">Your answer</span>}
              </label>
            );
          })}
        </div>
      ) : (
        <TitaInput q={q} value={value} onChange={onChange} readOnly={readOnly} review={review} />
      )}
    </div>
  );
}

function TitaInput({ q, value, onChange, readOnly, review }: RightProps) {
  const maxLen = q.kind === 'parajumble' ? 4 : 1;
  const set = (v: string) => onChange?.(normaliseTita(v.slice(0, maxLen)));
  const v = value ?? '';
  if (review) {
    const correct = review.response !== null && normaliseTita(review.response) === normaliseTita(q.answer);
    return (
      <div className="tita-review">
        <div>Your answer: <strong className={review.response === null ? 'muted' : correct ? 'txt-ok' : 'txt-bad'}>{review.response ?? 'Not attempted'}</strong></div>
        <div>Correct answer: <strong className="txt-ok">{q.answer}</strong></div>
      </div>
    );
  }
  return (
    <div className="tita">
      <label className="tita-label" htmlFor={`tita-${q.number}`}>Your answer</label>
      <input id={`tita-${q.number}`} className="tita-input" inputMode="numeric" autoComplete="off" spellCheck={false}
        maxLength={maxLen} value={v} disabled={readOnly} onChange={(e) => set(e.target.value)} aria-describedby={`tita-hint-${q.number}`}
        onKeyDown={(e) => {
          // Append-only entry (like the on-screen keypad): digits go to the end, Backspace removes the last digit.
          if (/^\d$/.test(e.key)) { e.preventDefault(); if (v.length < maxLen) set(v + e.key); }
          else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); set(v.slice(0, -1)); }
        }} />
      <div id={`tita-hint-${q.number}`} className="muted small">{maxLen === 4 ? 'Four digits, no spaces.' : 'One digit.'} No negative marking for TITA.</div>
      {!readOnly && (
        <div className="keypad" aria-label="On-screen keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((d) => (
            <button key={d} type="button" onClick={() => set(v.length >= maxLen ? v : v + d)}>{d}</button>
          ))}
          <button type="button" className="kp-wide" onClick={() => set(v.slice(0, -1))}>Backspace</button>
          <button type="button" className="kp-wide" onClick={() => onChange?.(null)}>Clear All</button>
        </div>
      )}
    </div>
  );
}
