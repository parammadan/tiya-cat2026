// Imports the five original Markdown mocks into src/data/mocks.json.
// The source files are read-only inputs; nothing in ../mockN is modified.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePaper, parseSolutions, md2html, inline, splitTakeaway, difficultyCounts } from './parse.ts';

const here = dirname(fileURLToPath(import.meta.url));
// Byte-identical copies of the original papers live in content/mockN/ so CI can validate and build them.
export const SOURCE_ROOT = process.env.CONTENT_ROOT || join(here, '..', 'content');
export const FOCUS: Record<number, string> = {
  1: 'Baseline', 2: 'CAT 2020 reasoning', 3: 'Advanced inference', 4: 'Abstract RC and difficult VA', 5: 'Exam-day simulation',
};

export function sourcePaths(n: number) {
  return { paper: join(SOURCE_ROOT, `mock${n}`, `Mock${n}_QuestionPaper.md`), solutions: join(SOURCE_ROOT, `mock${n}`, `Mock${n}_Solutions.md`) };
}

export function buildMock(n: number) {
  const src = sourcePaths(n);
  const paperMd = readFileSync(src.paper, 'utf8');
  const solMd = readFileSync(src.solutions, 'utf8');
  const paper = parsePaper(paperMd);
  const sol = parseSolutions(solMd);
  const keyBy = new Map(sol.keyRows.map((r) => [r.number, r]));

  const questions = paper.questions.map((q) => {
    const key = keyBy.get(q.number);
    const ex = sol.explanations[q.number];
    const split = ex ? splitTakeaway(ex.markdown) : { body: '', takeaway: null };
    return {
      number: q.number,
      section: q.section,
      kind: q.kind,
      passageNumber: q.passageNumber,
      isTita: q.isTita,
      stemHtml: inline(q.stem),
      bodyHtml: q.body.map(inline),
      sentences: q.sentences.map((s) => ({ n: s.n, html: inline(s.text) })),
      insertSentenceHtml: q.insertSentence ? inline(q.insertSentence) : null,
      placementParagraphHtml: q.placementParagraph ? inline(q.placementParagraph) : null,
      options: q.options.map((o) => ({ key: o.key, html: inline(o.text) })),
      answer: key ? key.answer : '',
      category: key ? key.category : '',
      difficulty: key ? key.difficulty : '',
      explanationHeading: ex ? ex.heading : '',
      explanationHtml: ex ? md2html(split.body) : '',
      takeawayHtml: split.takeaway ? inline(split.takeaway) : null,
    };
  });

  const passages = paper.passages.map((p) => ({
    number: p.number, firstQ: p.firstQ, lastQ: p.lastQ,
    paragraphsHtml: p.paragraphs.map(inline),
    notesTitle: sol.passageNotes[p.number]?.title ?? '',
    notesHtml: sol.passageNotes[p.number] ? md2html(sol.passageNotes[p.number].markdown) : '',
  }));

  const counts = difficultyCounts(questions.map((q) => q.difficulty));
  return {
    id: n,
    title: `Mock ${n}`,
    paperTitle: paper.title,
    focus: FOCUS[n],
    purpose: sol.purpose,
    introHtml: md2html(sol.introMarkdown),
    strategyHtml: sol.strategyMarkdown ? md2html(sol.strategyMarkdown) : '',
    diagnosticHtml: md2html(sol.diagnosticMarkdown),
    durationMinutes: 40,
    mcqCount: questions.filter((q) => !q.isTita).length,
    titaCount: questions.filter((q) => q.isTita).length,
    difficulty: { recomputed: counts, statedInSource: sol.statedDifficulty },
    passages,
    questions,
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const mocks = [1, 2, 3, 4, 5].map(buildMock);
  const outDir = join(here, '..', 'src', 'data');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'mocks.json'), JSON.stringify(mocks));
  const size = Buffer.byteLength(JSON.stringify(mocks));
  console.log(`Imported ${mocks.length} mocks, ${mocks.reduce((a, m) => a + m.questions.length, 0)} questions → src/data/mocks.json (${(size / 1024).toFixed(0)} KB)`);
}
