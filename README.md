# TIYA MADAN | CAT 2026: VARC Examination Centre

**Live site:** https://parammadan.github.io/varc-practice-sim/ (deployed automatically from `main` by GitHub Actions; see `DEPLOY.md`).

This is a personal CAT-style computer-based-test simulator. It contains the five original VARC sectional mocks, each with 24 questions and a 40-minute limit. It is not affiliated with the IIMs or the official CAT.

## Commands

```bash
npm install
npm run dev        # local development server
npm run build      # import → validate → type-check → production build in dist/
npm run preview    # serve the production build at http://localhost:4173
npm test           # Vitest: scoring, exam state, timer, content validation
npm run e2e        # browser end-to-end checks (needs a build and Google Chrome)
```

Deployment and how to update the site: see `DEPLOY.md`. GitHub Pages deploys on every push to `main`.

## Layout

| Path | What it is |
|---|---|
| `content/mockN/MockN_QuestionPaper.md`, `content/mockN/MockN_Solutions.md` | Source papers and solutions: byte-identical copies of the originals. The app treats them as read-only input. |
| `scripts/parse.ts` | Markdown parser, shared by the import, validation and tests |
| `scripts/import-mocks.ts` | Builds `src/data/mocks.json` (the content data, kept separate from the UI) |
| `scripts/validate.ts` | Content validator. Writes `reports/IMPORT_VALIDATION.md` and fails the build if it finds an error. |
| `src/lib/` | Pure logic: `scoring.ts`, `examState.ts` (palette semantics), `timer.ts` (wall-clock deadline), `storage.ts` (localStorage, auto-submit, JSON backup) |
| `src/pages/` | Dashboard, pre-test details and instructions, Exam, Result, Review, Performance |
| `tests/` | Vitest suites |
| `e2e/e2e.mjs` | Playwright-core script that drives Chrome at 1366×768. Screenshots go in `e2e/screenshots/`. |
| `reports/` | Import validation report and QA report |

## How the exam engine behaves

| Rule | Behaviour |
|---|---|
| Deadline | Fixed when the attempt starts: `start + 40 min`. Refreshing or reopening the page never extends it. A test that expires while closed is auto-submitted the next time the site opens. |
| What gets marked | Only saved responses (Save & Next, or Mark for Review & Next) are evaluated. "Answered & Marked for Review" counts. A selection that wasn't saved is discarded when you navigate away or at submission. |
| Marking | +3 for a correct answer, −1 for a wrong MCQ, 0 for a wrong TITA, 0 for an unattempted question. Maximum 72. |

## Changing content

To change a question, edit the source Markdown, then run `npm run build`. The build re-imports and re-validates the papers.
