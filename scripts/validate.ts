// Validates the imported mock data against the original Markdown sources.
// Writes reports/IMPORT_VALIDATION.md and exits non-zero if any error is found.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePaper, parseSolutions } from './parse.ts';
import { buildMock, sourcePaths } from './import-mocks.ts';

const here = dirname(fileURLToPath(import.meta.url));
export const EXPECTED: Record<number, { mcq: number; tita: number }> = {
  1: { mcq: 20, tita: 4 }, 2: { mcq: 19, tita: 5 }, 3: { mcq: 21, tita: 3 }, 4: { mcq: 20, tita: 4 }, 5: { mcq: 22, tita: 2 },
};

export interface MockReport {
  mock: number; errors: string[]; warnings: string[];
  stats: { questions: number; rc: number; va: number; mcq: number; tita: number; passages: number; words: number[]; kinds: Record<string, number>; order: string };
  difficulty: { recomputed: Record<string, number>; stated: Record<string, number> | null; mismatch: boolean };
}

const words = (s: string) => (s.match(/[A-Za-z0-9][A-Za-z0-9'’\-]*/g) || []).length;

export function validateMock(n: number): MockReport {
  const src = sourcePaths(n);
  const paperMd = readFileSync(src.paper, 'utf8');
  const solMd = readFileSync(src.solutions, 'utf8');
  const paper = parsePaper(paperMd);
  const sol = parseSolutions(solMd);
  const errors: string[] = []; const warnings: string[] = [];
  const qs = paper.questions;

  // 1. Missing / duplicate questions
  const nums = qs.map((q) => q.number);
  const dup = nums.filter((x, i) => nums.indexOf(x) !== i);
  if (dup.length) errors.push(`Duplicate question numbers: ${[...new Set(dup)].join(', ')}`);
  for (let i = 1; i <= 24; i++) if (!nums.includes(i)) errors.push(`Missing question ${i}`);
  if (qs.length !== 24) errors.push(`Expected 24 questions, parsed ${qs.length}`);
  nums.forEach((x, i) => { if (x !== i + 1) errors.push(`Question order broken at position ${i + 1} (found Q${x})`); });
  const srcQCount = (paperMd.match(/^\*\*\d+\.\*\*/gm) || []).length;
  if (srcQCount !== qs.length) errors.push(`Source has ${srcQCount} question markers but ${qs.length} were parsed`);

  // 2. Sections, passages and answer choices
  const rc = qs.filter((q) => q.section === 'RC'); const va = qs.filter((q) => q.section === 'VA');
  if (rc.length !== 16) errors.push(`Expected 16 RC questions, found ${rc.length}`);
  if (va.length !== 8) errors.push(`Expected 8 VA questions, found ${va.length}`);
  if (paper.passages.length !== 4) errors.push(`Expected 4 passages, found ${paper.passages.length}`);
  for (const p of paper.passages) {
    if (!p.paragraphs.length) errors.push(`Passage ${p.number} has no paragraphs`);
    const inP = rc.filter((q) => q.passageNumber === p.number).map((q) => q.number);
    const want: number[] = []; for (let i = p.firstQ; i <= p.lastQ; i++) want.push(i);
    if (inP.join() !== want.join()) errors.push(`Passage ${p.number} heading says Q${p.firstQ}–${p.lastQ} but holds [${inP.join(', ')}]`);
    const w = words(p.paragraphs.join(' '));
    if (w < 480 || w > 540) warnings.push(`Passage ${p.number} is ${w} words (target 480–540)`);
  }
  const srcOptLines = (paperMd.match(/^\([A-D]\) /gm) || []).length;
  const parsedOpts = qs.reduce((a, q) => a + q.options.length, 0);
  if (srcOptLines !== parsedOpts) errors.push(`Source has ${srcOptLines} option lines but ${parsedOpts} were parsed`);
  for (const q of qs) {
    if (!q.stem.trim()) errors.push(`Q${q.number}: empty stem`);
    if (q.isTita) {
      if (q.options.length) errors.push(`Q${q.number}: TITA question has options`);
      if (q.kind === 'parajumble' && q.sentences.length !== 4) errors.push(`Q${q.number}: para jumble needs 4 sentences, has ${q.sentences.length}`);
      if (q.kind === 'oddoneout' && q.sentences.length !== 5) errors.push(`Q${q.number}: odd-one-out needs 5 sentences, has ${q.sentences.length}`);
    } else {
      const keys = q.options.map((o) => o.key).join('');
      if (keys !== 'ABCD') errors.push(`Q${q.number}: options are [${keys}], expected ABCD`);
      q.options.forEach((o) => { if (!o.text.trim()) errors.push(`Q${q.number}(${o.key}): empty option`); });
      if (q.kind === 'summary' && !q.body.length) errors.push(`Q${q.number}: summary question missing its paragraph`);
      if (q.kind === 'placement' && (!q.insertSentence || !q.placementParagraph)) errors.push(`Q${q.number}: sentence placement missing sentence or paragraph`);
      if (q.kind === 'placement') for (const g of [1, 2, 3, 4]) if (!q.placementParagraph?.includes(`(${g})`)) errors.push(`Q${q.number}: placement paragraph missing gap (${g})`);
    }
  }

  // 3. MCQ / TITA counts
  const mcq = qs.filter((q) => !q.isTita).length; const tita = qs.filter((q) => q.isTita).length;
  if (mcq !== EXPECTED[n].mcq || tita !== EXPECTED[n].tita) errors.push(`MCQ/TITA = ${mcq}/${tita}, expected ${EXPECTED[n].mcq}/${EXPECTED[n].tita}`);
  if (paper.statedMcq !== null && (paper.statedMcq !== mcq || paper.statedTitaCount !== tita)) errors.push(`Paper instructions state ${paper.statedMcq} MCQ / ${paper.statedTitaCount} TITA but the paper has ${mcq}/${tita}`);
  const titaNums = qs.filter((q) => q.isTita).map((q) => q.number);
  if (paper.statedTita.join() !== titaNums.join()) errors.push(`Instructions list TITA questions [${paper.statedTita.join(', ')}] but TITA items are [${titaNums.join(', ')}]`);

  // 4. Answers and explanations
  const keyBy = new Map(sol.keyRows.map((r) => [r.number, r]));
  if (sol.keyRows.length !== 24) errors.push(`Answer-key table has ${sol.keyRows.length} rows, expected 24`);
  for (const q of qs) {
    const k = keyBy.get(q.number);
    if (!k) { errors.push(`Q${q.number}: no answer-key row`); continue; }
    if (!k.category) errors.push(`Q${q.number}: missing category`);
    if (!['Easy', 'Moderate', 'Difficult', 'Very difficult'].includes(k.difficulty)) errors.push(`Q${q.number}: unrecognised difficulty "${k.difficulty}"`);
    const ex = sol.explanations[q.number];
    if (!ex || ex.markdown.length < 80) errors.push(`Q${q.number}: missing or very short explanation`);
    else if (ex.headingAnswer !== k.answer) errors.push(`Q${q.number}: key table says ${k.answer} but explanation heading says ${ex.headingAnswer}`);
    if (q.isTita) {
      if (!/^\d+$/.test(k.answer)) errors.push(`Q${q.number}: TITA key "${k.answer}" is not numeric`);
      if (q.kind === 'parajumble' && k.answer.split('').sort().join('') !== '1234') errors.push(`Q${q.number}: para-jumble key ${k.answer} is not a permutation of 1234`);
      if (q.kind === 'oddoneout' && !/^[1-5]$/.test(k.answer)) errors.push(`Q${q.number}: odd-one-out key ${k.answer} is not 1–5`);
    } else if (!/^[A-D]$/.test(k.answer)) errors.push(`Q${q.number}: MCQ key "${k.answer}" is not A–D`);
    if ((k.category.startsWith('RC') && q.section !== 'RC') || (k.category.startsWith('VA') && q.section !== 'VA')) errors.push(`Q${q.number}: key category "${k.category}" disagrees with paper section ${q.section}`);
  }
  for (const p of paper.passages) if (!sol.passageNotes[p.number]) warnings.push(`Passage ${p.number}: no passage notes found in solutions`);

  // 5. Structured data vs source: every raw fragment must appear verbatim in the source file
  for (const p of paper.passages) for (const para of p.paragraphs) if (!paperMd.includes(para)) errors.push(`Passage ${p.number}: paragraph text not found verbatim in source`);
  for (const q of qs) {
    const frags = [q.stem, ...q.body, ...q.sentences.map((s) => s.text), ...q.options.map((o) => o.text), q.insertSentence ?? '', q.placementParagraph ?? ''].filter(Boolean);
    for (const f of frags) if (!paperMd.includes(f)) errors.push(`Q${q.number}: fragment not found verbatim in source: "${f.slice(0, 40)}…"`);
  }
  // Generated JSON must match a fresh import (catches stale data)
  const jsonPath = join(here, '..', 'src', 'data', 'mocks.json');
  if (existsSync(jsonPath)) {
    const stored = JSON.parse(readFileSync(jsonPath, 'utf8'))[n - 1];
    const fresh = JSON.parse(JSON.stringify(buildMock(n)));
    if (JSON.stringify(stored) !== JSON.stringify(fresh)) errors.push(`src/data/mocks.json is stale for Mock ${n}; re-run npm run import`);
  } else errors.push('src/data/mocks.json does not exist; run npm run import');

  // 6. Difficulty summary: recompute from per-question labels
  const rec = { easy: 0, moderate: 0, difficult: 0, veryDifficult: 0 };
  for (const r of sol.keyRows) { const d = r.difficulty.toLowerCase(); if (d === 'easy') rec.easy++; else if (d === 'moderate') rec.moderate++; else if (d === 'difficult') rec.difficult++; else if (d === 'very difficult') rec.veryDifficult++; }
  const stated = sol.statedDifficulty;
  const mismatch = !!stated && (stated.easy !== rec.easy || stated.moderate !== rec.moderate || stated.difficult !== rec.difficult || stated.veryDifficult !== rec.veryDifficult);
  if (mismatch) warnings.push(`Difficulty summary table in source (E/M/D/VD = ${stated!.easy}/${stated!.moderate}/${stated!.difficult}/${stated!.veryDifficult}) disagrees with per-question labels (${rec.easy}/${rec.moderate}/${rec.difficult}/${rec.veryDifficult}). The simulator uses the recomputed values; source left unchanged.`);

  const kinds: Record<string, number> = {};
  qs.forEach((q) => { kinds[q.kind] = (kinds[q.kind] || 0) + 1; });
  const order = qs.map((q) => (q.section === 'RC' ? `P${q.passageNumber}` : q.kind === 'summary' ? 'Sum' : q.kind === 'placement' ? 'SP' : q.kind === 'parajumble' ? 'PJ' : 'OOO'))
    .reduce<string[]>((a, s) => { if (a[a.length - 1]?.split('×')[0] === s) { const [k, c] = a[a.length - 1].split('×'); a[a.length - 1] = `${k}×${(+c || 1) + 1}`; } else a.push(s); return a; }, []).join(' → ');
  return { mock: n, errors, warnings, stats: { questions: qs.length, rc: rc.length, va: va.length, mcq, tita, passages: paper.passages.length, words: paper.passages.map((p) => words(p.paragraphs.join(' '))), kinds, order }, difficulty: { recomputed: rec, stated, mismatch } };
}

export function validateAll() { return [1, 2, 3, 4, 5].map(validateMock); }

function renderReport(reports: MockReport[]) {
  const totalQ = reports.reduce((a, r) => a + r.stats.questions, 0);
  const errs = reports.reduce((a, r) => a + r.errors.length, 0);
  const L: string[] = [];
  L.push('# Import validation report', '', `Generated: ${new Date().toISOString()}`, '');
  L.push(`**Result:** ${errs === 0 ? 'PASS' : 'FAIL'}: ${totalQ} questions imported from 5 mocks, ${errs} error(s).`, '');
  L.push('**Sources:** `mockN/MockN_QuestionPaper.md` and `mockN/MockN_Solutions.md`. These files are read-only inputs and were not modified.', '');
  L.push('## Summary', '', '| Mock | Questions | RC | VA | MCQ | TITA | Passages | Passage words | Errors | Warnings |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const r of reports) L.push(`| ${r.mock} | ${r.stats.questions} | ${r.stats.rc} | ${r.stats.va} | ${r.stats.mcq} | ${r.stats.tita} | ${r.stats.passages} | ${r.stats.words.join(' / ')} | ${r.errors.length} | ${r.warnings.length} |`);
  L.push('', '## Question order (as rendered)', '');
  for (const r of reports) L.push(`- **Mock ${r.mock}:** ${r.stats.order}`);
  L.push('', '## Difficulty summaries (recomputed from per-question labels)', '', '| Mock | Recomputed E/M/D/VD | Stated in source table | Consistent? |', '|---|---|---|---|');
  for (const r of reports) { const c = r.difficulty.recomputed; const s = r.difficulty.stated; L.push(`| ${r.mock} | ${c.easy}/${c.moderate}/${c.difficult}/${c.veryDifficult} | ${s ? `${s.easy}/${s.moderate}/${s.difficult}/${s.veryDifficult}` : 'n/a'} | ${r.difficulty.mismatch ? 'No: the app uses the recomputed values' : 'Yes'} |`); }
  L.push('', 'No individual difficulty label was changed.', '', '## Checks performed', '');
  L.push('Every mock was checked for each of the following:', '');
  L.push('- **Questions:** exactly questions 1–24, each appearing once and in order. The parsed count matches the number of question markers in the source.');
  L.push('- **Structure:** 16 RC and 8 VA questions, 4 passages, and every passage holds exactly the questions its heading names.');
  L.push('- **Options:** every MCQ has non-empty options A–D. The total number of option lines matches the source.');
  L.push('- **TITA:** TITA items have no options. Para jumbles have 4 sentences and odd-one-out items have 5.');
  L.push('- **Counts:** MCQ/TITA counts match the expected table and the paper\'s own instruction line, and the TITA question numbers match the instructions.');
  L.push('- **Answers:** every question has an answer-key row, a category, a recognised difficulty and a substantive explanation. The explanation heading agrees with the key table.');
  L.push('- **Key format:** MCQ keys are A–D. Para-jumble keys are permutations of 1234. Odd-one-out keys are 1–5.');
  L.push('- **Sections:** the key category prefix (RC/VA) agrees with the paper section.');
  L.push('- **Verbatim text:** every passage paragraph, stem, option, sentence, summary paragraph and placement paragraph appears verbatim in the source file.');
  L.push('- **Freshness:** `src/data/mocks.json` is identical to a fresh import, so stale data is detected.');
  L.push('', '## Errors and warnings', '');
  for (const r of reports) {
    L.push(`### Mock ${r.mock}`);
    if (!r.errors.length && !r.warnings.length) L.push('No errors or warnings.');
    r.errors.forEach((e) => L.push(`- ERROR: ${e}`));
    r.warnings.forEach((w) => L.push(`- Warning: ${w}`));
    L.push('');
  }
  L.push('## Limits of this validation', '');
  L.push('These checks are structural and textual. They confirm that the simulator shows exactly what the source papers contain, with the source keys and explanations. They do **not** independently verify that each question\'s intended answer is intellectually correct. That was handled separately, by the blind-solver audits recorded in `BLUEPRINT.md`.');
  return L.join('\n');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const reports = validateAll();
  mkdirSync(join(here, '..', 'reports'), { recursive: true });
  writeFileSync(join(here, '..', 'reports', 'IMPORT_VALIDATION.md'), renderReport(reports));
  const errs = reports.reduce((a, r) => a + r.errors.length, 0);
  for (const r of reports) {
    console.log(`Mock ${r.mock}: ${r.stats.questions}Q RC ${r.stats.rc}/VA ${r.stats.va} MCQ ${r.stats.mcq}/TITA ${r.stats.tita} | errors ${r.errors.length} warnings ${r.warnings.length}`);
    r.errors.forEach((e) => console.log('  ERROR', e));
    r.warnings.forEach((w) => console.log('  warn ', w));
  }
  console.log(errs ? `FAIL (${errs} errors)` : 'PASS — report written to reports/IMPORT_VALIDATION.md');
  process.exit(errs ? 1 : 0);
}
