# QA report: TIYA MADAN | CAT 2026 VARC Examination Centre

**Date:** 14 Nov 2026.
**Build:** React 19, TypeScript, Vite 8. Static output in `dist/`, about 170 KB gzipped.

## Results

| Check | Method | Result |
|---|---|---|
| Content import (120 questions) | `npm run validate` → `reports/IMPORT_VALIDATION.md` | **PASS:** 0 errors, 4 warnings (difficulty tables, below) |
| Unit and content tests | `npm test` (Vitest) | **33/33 pass** |
| Browser end-to-end | `npm run e2e`: headless Chrome at **1366 × 768** against the production build | **56/56 pass** |
| Type check and production build | `npm run build` (import → validate → `tsc` → `vite build`) | **PASS** |

## What the automated checks cover

### Content

- **Counts:** 5 mocks, 120 questions; every mock has questions 1–24 once each and in order, with 16 RC and 8 VA.
- **MCQ/TITA:** counts are 20/4, 19/5, 21/3, 20/4 and 22/2. Mock 2 is 19/5, which corrects the old blueprint figure.
- **Text:** every passage, stem, option and sentence appears verbatim in the source Markdown.
- **Keys and explanations:** each one is matched to its source table and explanation heading.
- **Stale data:** the generated JSON must match a fresh import.

### Scoring

The tests cover:

- +3 for a correct answer, −1 for a wrong MCQ, 0 for a wrong TITA and 0 for an unattempted question;
- all-correct scoring 72 and all-wrong scoring −(number of MCQs), checked on every mock;
- a mixed attempt, including the RC/VA split;
- unsaved selections not being evaluated;
- "Answered & Marked for Review" answers being evaluated.

### Exam states

The tests cover:

- Save & Next, Mark for Review & Next and Clear Response;
- a selection being discarded if you navigate away without saving;
- the first and last question boundaries;
- TITA input normalisation.

### Timer

The tests cover:

- the clock reading 40:00 at the start and 00:00 at expiry;
- the deadline being fixed when the attempt is created, so a refresh cannot change it;
- the five-minute warning window;
- an expired attempt being auto-submitted when the page loads, with time used capped at 40 minutes;
- submission being idempotent.

### In the browser

- **Start and screens:**
  - all 5 tests start;
  - "I Am Ready to Begin" stays disabled until the instructions are acknowledged;
  - the exam fits 1366 × 768 without page scrolling, and the passage panel scrolls independently;
  - no answer or explanation is visible during a test.
- **Palette:** colour states change correctly for each action.
- **TITA:** input is limited to 4 digits.
- **Persistence:** a refresh keeps the timer, the answers and the current question.
- **Submission:**
  - the submit summary appears;
  - the scored result matches a hand calculation (8/72);
  - a submitted attempt cannot be reopened for editing.
- **Review:** the review filters work.
- **Auto-submit:**
  - returning after the deadline auto-submits the attempt;
  - reaching 00:00 while the test is open auto-submits it;
  - the five-minute warning appears.
- **Mock 5:** its interleaved order (VA → P1 → VA → P2 → VA → P3 → VA → P4 → VA) renders in sequence.
- **History:**
  - reattempts are saved as separate records;
  - the performance graph renders;
  - JSON export works.
- **Errors:** no console errors.

Screenshots are in `e2e/screenshots/`.

## Defects found and fixed during QA

1. **TITA typing order.** Typing into the TITA box after focus could insert digits at the start (for example 1432 instead of 2143). The TITA field is now append-only, like the on-screen keypad.
2. **Answer leak in the format example.** The TITA format example "2413" was the real key to Mock 2 Q17. The example is now "1234", which is not a key in any mock.
3. **Skill-miss table.** It mixed unattempted questions with wrong ones. They are now separate columns, and the table is ranked by actual errors.

## Content corrections applied in the app (sources unchanged)

- **Difficulty tables:** the difficulty summary tables in Mocks 2–5 do not match their own per-question labels. The app recomputes them and changes no label:

  | Mock | Recomputed (E/M/D/VD) | Source table |
  |---|---|---|
  | 2 | 1/13/9/1 | 1/12/10/1 |
  | 3 | 2/10/10/2 | 2/9/11/2 |
  | 4 | 2/10/11/1 | 2/9/12/1 |
  | 5 | 7/13/4/0 | 8/12/4/0 |

- **Mock 2:** shown as 19 MCQ / 5 TITA.

## Remaining limitations

- **Content correctness.** Validation is structural and textual. It proves the site faithfully reproduces the papers. It does not independently prove that every intended answer is intellectually right. The blind-solver audits in `BLUEPRINT.md` addressed that, with their stated limits.
- **Difficulty labels** are the setter's estimates. They have not been calibrated against real candidate data, and no percentile or rank is shown.
- **Takeaways.** Only 31 of the 120 solutions contain a separate takeaway line. The review screen shows those and does not invent the rest. For the other questions, the learning point sits inside the explanation.
- **Not secure.** Answer keys are in the downloaded bundle and can be read with developer tools. There is no proctoring. Full screen is optional, and nothing stops a candidate opening other tabs.
- **Clock.** The timer uses the device clock. Changing the system time while a test is running would change the remaining time.
- **Storage.**
  - History lives in this browser's `localStorage`: private windows, clearing site data or switching browser or device lose it. Use **Export** regularly.
  - There is no cross-device sync.
  - Two tabs open on the same attempt are kept in sync through storage events, but simultaneous edits are last-write-wins.
- **Time per question** counts only on-screen, visible-tab time, in steps of up to 5 s. Treat it as approximate.
- **Interface reference.** The interface follows the widely documented CAT conventions: the palette colours and shapes, Save & Next, Mark for Review & Next, Clear Response, and evaluation of answered-and-marked questions. I did not open the live 2026 official mock (iimcat.ac.in) in this session, so minor differences from this year's official interface are possible. No official assets are used.
- **Layout.** The design is desktop-first. Phones get a basic stacked layout only.
- **Hosting.** The site is not deployed: no hosting account was available. See `DEPLOY.md`.
