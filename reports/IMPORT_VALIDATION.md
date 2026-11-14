# Import validation report

Generated: 2026-11-14T23:12:52.666Z

**Result:** PASS: 120 questions imported from 5 mocks, 0 error(s).

**Sources:** `mockN/MockN_QuestionPaper.md` and `mockN/MockN_Solutions.md`. These files are read-only inputs and were not modified.

## Summary

| Mock | Questions | RC | VA | MCQ | TITA | Passages | Passage words | Errors | Warnings |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 24 | 16 | 8 | 20 | 4 | 4 | 519 / 512 / 497 / 506 | 0 | 0 |
| 2 | 24 | 16 | 8 | 19 | 5 | 4 | 498 / 505 / 505 / 496 | 0 | 1 |
| 3 | 24 | 16 | 8 | 21 | 3 | 4 | 484 / 483 / 495 / 492 | 0 | 1 |
| 4 | 24 | 16 | 8 | 20 | 4 | 4 | 489 / 504 / 493 / 493 | 0 | 1 |
| 5 | 24 | 16 | 8 | 22 | 2 | 4 | 487 / 493 / 485 / 481 | 0 | 1 |

## Question order (as rendered)

- **Mock 1:** P1×4 → P2×4 → P3×4 → P4×4 → PJ×2 → OOO×2 → Sum×2 → SP×2
- **Mock 2:** P1×4 → P2×4 → P3×4 → P4×4 → PJ×3 → OOO×2 → Sum×3
- **Mock 3:** P1×4 → P2×4 → P3×4 → P4×4 → PJ×3 → SP×2 → Sum×3
- **Mock 4:** P1×4 → P2×4 → P3×4 → P4×4 → PJ×2 → OOO×2 → Sum×2 → SP×2
- **Mock 5:** Sum → SP → P1×4 → OOO → P2×4 → Sum → SP → P3×4 → OOO → P4×4 → Sum → SP

## Difficulty summaries (recomputed from per-question labels)

| Mock | Recomputed E/M/D/VD | Stated in source table | Consistent? |
|---|---|---|---|
| 1 | 6/12/6/0 | 6/12/6/0 | Yes |
| 2 | 1/13/9/1 | 1/12/10/1 | No: the app uses the recomputed values |
| 3 | 2/10/10/2 | 2/9/11/2 | No: the app uses the recomputed values |
| 4 | 2/10/11/1 | 2/9/12/1 | No: the app uses the recomputed values |
| 5 | 7/13/4/0 | 8/12/4/0 | No: the app uses the recomputed values |

No individual difficulty label was changed.

## Checks performed

Every mock was checked for each of the following:

- **Questions:** exactly questions 1–24, each appearing once and in order. The parsed count matches the number of question markers in the source.
- **Structure:** 16 RC and 8 VA questions, 4 passages, and every passage holds exactly the questions its heading names.
- **Options:** every MCQ has non-empty options A–D. The total number of option lines matches the source.
- **TITA:** TITA items have no options. Para jumbles have 4 sentences and odd-one-out items have 5.
- **Counts:** MCQ/TITA counts match the expected table and the paper's own instruction line, and the TITA question numbers match the instructions.
- **Answers:** every question has an answer-key row, a category, a recognised difficulty and a substantive explanation. The explanation heading agrees with the key table.
- **Key format:** MCQ keys are A–D. Para-jumble keys are permutations of 1234. Odd-one-out keys are 1–5.
- **Sections:** the key category prefix (RC/VA) agrees with the paper section.
- **Verbatim text:** every passage paragraph, stem, option, sentence, summary paragraph and placement paragraph appears verbatim in the source file.
- **Freshness:** `src/data/mocks.json` is identical to a fresh import, so stale data is detected.

## Errors and warnings

### Mock 1
No errors or warnings.

### Mock 2
- Warning: Difficulty summary table in source (E/M/D/VD = 1/12/10/1) disagrees with per-question labels (1/13/9/1). The simulator uses the recomputed values; source left unchanged.

### Mock 3
- Warning: Difficulty summary table in source (E/M/D/VD = 2/9/11/2) disagrees with per-question labels (2/10/10/2). The simulator uses the recomputed values; source left unchanged.

### Mock 4
- Warning: Difficulty summary table in source (E/M/D/VD = 2/9/12/1) disagrees with per-question labels (2/10/11/1). The simulator uses the recomputed values; source left unchanged.

### Mock 5
- Warning: Difficulty summary table in source (E/M/D/VD = 8/12/4/0) disagrees with per-question labels (7/13/4/0). The simulator uses the recomputed values; source left unchanged.

## Limits of this validation

These checks are structural and textual. They confirm that the simulator shows exactly what the source papers contain, with the source keys and explanations. They do **not** independently verify that each question's intended answer is intellectually correct. That was handled separately, by the blind-solver audits recorded in `BLUEPRINT.md`.