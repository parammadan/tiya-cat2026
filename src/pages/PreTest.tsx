import { useState } from 'react';
import { navigate, useStore } from '../App';
import { getMock } from '../data';
import { CANDIDATE, Legend, SiteFooter, SiteHeader } from '../components/common';

export default function PreTest({ mockId }: { mockId: number }) {
  const mock = getMock(mockId);
  const { startAttempt, activeAttemptFor } = useStore();
  const [step, setStep] = useState<'info' | 'instructions'>('info');
  const [agreed, setAgreed] = useState(false);
  if (!mock) return <div className="page"><SiteHeader /><main className="container"><p>Mock not found. <a href="#/">Back to dashboard</a></p></main></div>;
  const active = activeAttemptFor(mock.id);

  if (step === 'info') {
    return (
      <div className="page">
        <SiteHeader />
        <main className="container narrow">
          <h1 className="page-title">Examination Details</h1>
          <table className="info-table">
            <tbody>
              <tr><th>Candidate</th><td>{CANDIDATE}</td></tr>
              <tr><th>Examination</th><td>CAT 2026 — VARC Practice</td></tr>
              <tr><th>Paper</th><td>{mock.title}</td></tr>
              <tr><th>Section</th><td>Verbal Ability and Reading Comprehension (VARC)</td></tr>
              <tr><th>Duration</th><td>40 minutes</td></tr>
              <tr><th>Number of Questions</th><td>24 ({mock.mcqCount} MCQ, {mock.titaCount} TITA)</td></tr>
              <tr><th>Maximum Marks</th><td>72</td></tr>
            </tbody>
          </table>
          <div className="actions-row">
            <a className="btn" href="#/">Back</a>
            <button className="btn primary" onClick={() => setStep('instructions')}>Continue to Instructions</button>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const begin = () => {
    const a = startAttempt(mock.id);
    navigate(`#/exam/${a.id}`);
  };

  return (
    <div className="page">
      <SiteHeader />
      <main className="container narrow instructions">
        <h1 className="page-title">General Instructions — {mock.title}</h1>
        <p className="muted">Please read the instructions carefully.</p>

        <h2>1. Time</h2>
        <ul>
          <li>The test lasts <strong>40 minutes</strong>. The clock starts when you click <em>I Am Ready to Begin</em> and keeps running until you submit.</li>
          <li>The countdown in the top-right corner shows the time remaining. It turns red, with a small notice, in the last five minutes.</li>
          <li>The clock is tied to a fixed deadline. Refreshing the page, or closing and reopening the browser, does not pause or extend it.</li>
          <li>When the time runs out, the test is <strong>submitted automatically</strong>. You cannot pause the test.</li>
        </ul>

        <h2>2. Question palette</h2>
        <p>The palette on the right shows the status of each question with these symbols:</p>
        <Legend />
        <p className="small muted">Questions shown as <em>Answered &amp; Marked for Review</em> <strong>will be evaluated</strong>. Questions only <em>Marked for Review</em>, with no saved answer, will not.</p>

        <h2>3. Navigating and answering</h2>
        <ul>
          <li>Click a question number in the palette to go straight to that question. You can also use <em>Previous</em>.</li>
          <li><strong>MCQ:</strong> select one of the four options, then click <em>Save &amp; Next</em>. An answer is saved only when you click <em>Save &amp; Next</em> or <em>Mark for Review &amp; Next</em>. If you move to another question without saving, the selection is discarded.</li>
          <li><strong>TITA (Type In The Answer):</strong> type the number using the keyboard or the on-screen keypad, then save. Para jumbles need four digits (format example: 1234). Odd-sentence-out questions need a single digit.</li>
          <li><em>Mark for Review &amp; Next</em> saves your response (if you entered one), flags the question for review, and moves on.</li>
          <li><em>Clear Response</em> removes the selected or saved answer for the current question.</li>
          <li>Reading Comprehension questions show the passage on the left; scroll it independently. Verbal Ability questions show the directions and sentences on the left.</li>
        </ul>

        <h2>4. Marking scheme</h2>
        <table className="info-table compact">
          <tbody>
            <tr><th>Correct answer (MCQ or TITA)</th><td>+3</td></tr>
            <tr><th>Wrong answer, MCQ</th><td>−1</td></tr>
            <tr><th>Wrong answer, TITA</th><td>0</td></tr>
            <tr><th>Not attempted</th><td>0</td></tr>
          </tbody>
        </table>

        <h2>5. After the test</h2>
        <ul>
          <li>Your score, section-wise breakdown and full solutions become available as soon as you submit. Answers and explanations are never shown during the test.</li>
          <li>Each attempt is stored separately in this browser. Completed attempts can be reviewed but not changed.</li>
          <li>Optional: use the full-screen button in the test header for a distraction-free view.</li>
        </ul>

        <p className="small muted">This is a practice simulator for personal use. It is not an official CAT product and does not provide remote proctoring.</p>

        <label className="agree">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          I have read and understood the instructions. I agree to attempt this test under examination conditions.
        </label>
        <div className="actions-row">
          <button className="btn" onClick={() => setStep('info')}>Previous</button>
          {active ? (
            <button className="btn primary" onClick={() => navigate(`#/exam/${active.id}`)}>Resume Test in Progress</button>
          ) : (
            <button className="btn primary" disabled={!agreed} onClick={begin}>I Am Ready to Begin</button>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
