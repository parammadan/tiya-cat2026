// Parses the original Markdown question papers and solutions into structured data.
// Pure functions: shared by the importer, the validator and the Vitest content tests.
import { marked } from 'marked';

export type Section = 'RC' | 'VA';
export type Kind = 'rc' | 'summary' | 'placement' | 'parajumble' | 'oddoneout';

export interface RawPassage { number: number; firstQ: number; lastQ: number; paragraphs: string[] }
export interface RawQuestion {
  number: number;
  section: Section;
  kind: Kind;
  passageNumber: number | null;
  isTita: boolean;
  stem: string;            // raw markdown, without the leading "*(TITA)*"
  body: string[];          // raw paragraphs belonging to the question (e.g. summary passage)
  sentences: { n: number; text: string }[];
  insertSentence: string | null;
  placementParagraph: string | null;
  options: { key: string; text: string }[];
}
export interface PaperParse {
  title: string;
  instructions: string[];
  passages: RawPassage[];
  questions: RawQuestion[];
  order: { kind: 'passage' | 'va'; ref: number }[]; // rendering order of blocks
  statedTita: number[];
  statedMcq: number | null;
  statedTitaCount: number | null;
}

const Q_RE = /^\*\*(\d+)\.\*\*\s*(.*)$/;
const OPT_RE = /^\(([A-D])\)\s+(.*)$/;
const SENT_RE = /^(\d)\.\s+(.*)$/;

export function parsePaper(md: string): PaperParse {
  const lines = md.split('\n');
  const out: PaperParse = { title: '', instructions: [], passages: [], questions: [], order: [], statedTita: [], statedMcq: null, statedTitaCount: null };
  let ctx: 'pre' | 'instr' | 'passage' | 'va' = 'pre';
  let passage: RawPassage | null = null;
  let q: RawQuestion | null = null;
  const flushQ = () => { if (q) { finaliseKind(q); out.questions.push(q); q = null; } };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith('# ')) { out.title = line.slice(2).trim(); continue; }
    const pm = line.match(/^##\s+Passage\s+(\d+)\s+\(Questions\s+(\d+)[–-](\d+)\)/);
    if (pm) {
      flushQ();
      passage = { number: +pm[1], firstQ: +pm[2], lastQ: +pm[3], paragraphs: [] };
      out.passages.push(passage);
      out.order.push({ kind: 'passage', ref: passage.number });
      ctx = 'passage';
      continue;
    }
    if (/^#{2,3}\s+Verbal Ability/.test(line)) { flushQ(); passage = null; ctx = 'va'; out.order.push({ kind: 'va', ref: out.order.length }); continue; }
    if (/^##\s+Candidate instructions/.test(line)) { ctx = 'instr'; continue; }
    if (line.trim() === '---' || line.startsWith('**END OF SECTION')) { flushQ(); continue; }
    if (!line.trim()) continue;

    if (ctx === 'instr') {
      const im = line.match(/^\d+\.\s+(.*)$/);
      if (im) out.instructions.push(im[1]);
      const tm = line.match(/The TITA questions are ([^.]*)\./);
      if (tm) out.statedTita = (tm[1].match(/\d+/g) || []).map(Number);
      const range = line.match(/The TITA questions are (\d+)[–-](\d+)/);
      if (range) { out.statedTita = []; for (let i = +range[1]; i <= +range[2]; i++) out.statedTita.push(i); }
      const cm = line.match(/\*\*(\d+) MCQ\*\* and \*\*(\d+) TITA\*\*/);
      if (cm) { out.statedMcq = +cm[1]; out.statedTitaCount = +cm[2]; }
      continue;
    }

    const qm = line.match(Q_RE);
    if (qm) {
      flushQ();
      let stem = qm[2];
      const isTita = stem.startsWith('*(TITA)*');
      if (isTita) stem = stem.replace('*(TITA)*', '').trim();
      q = { number: +qm[1], section: ctx === 'passage' ? 'RC' : 'VA', kind: 'rc', passageNumber: ctx === 'passage' && passage ? passage.number : null,
        isTita, stem, body: [], sentences: [], insertSentence: null, placementParagraph: null, options: [] };
      continue;
    }
    if (q) {
      const om = line.match(OPT_RE);
      if (om) { q.options.push({ key: om[1], text: om[2] }); continue; }
      const sm = line.match(SENT_RE);
      if (sm && q.section === 'VA') { q.sentences.push({ n: +sm[1], text: sm[2] }); continue; }
      if (line.startsWith('*Sentence:*')) { q.insertSentence = line.replace('*Sentence:*', '').trim(); continue; }
      if (line.startsWith('*Paragraph:*')) { q.placementParagraph = line.replace('*Paragraph:*', '').trim(); continue; }
      q.body.push(line);
      continue;
    }
    if (ctx === 'passage' && passage) {
      if (/^\*The passage below/.test(line)) continue;
      passage.paragraphs.push(line);
    }
  }
  flushQ();
  return out;
}

function finaliseKind(q: RawQuestion) {
  if (q.section === 'RC') { q.kind = 'rc'; return; }
  if (q.isTita) { q.kind = q.sentences.length === 5 ? 'oddoneout' : 'parajumble'; return; }
  if (q.insertSentence !== null) { q.kind = 'placement'; return; }
  q.kind = 'summary';
}

// ---------------- Solutions ----------------
export interface KeyRow { number: number; answer: string; category: string; difficulty: string }
export interface SolutionParse {
  title: string;
  purpose: string;
  keyRows: KeyRow[];
  explanations: Record<number, { headingAnswer: string; heading: string; markdown: string }>;
  passageNotes: Record<number, { title: string; markdown: string }>;
  diagnosticMarkdown: string;
  introMarkdown: string;
  strategyMarkdown: string;
  statedDifficulty: { easy: number; moderate: number; difficult: number; veryDifficult: number } | null;
}

export function parseSolutions(md: string): SolutionParse {
  const res: SolutionParse = { title: '', purpose: '', keyRows: [], explanations: {}, passageNotes: {}, diagnosticMarkdown: '', introMarkdown: '', strategyMarkdown: '', statedDifficulty: null };
  const t = md.match(/^# (.*)$/m); res.title = t ? t[1].trim() : '';
  const p = md.match(/^\*\*Purpose:\*\*\s*(.*)$/m); res.purpose = p ? p[1].trim() : '';
  const keyStart = md.indexOf('## Answer key');
  res.introMarkdown = md.slice(md.indexOf('\n', md.indexOf('# ')) + 1, keyStart).replace(/\n-{3,}\s*$/, '').trim();
  const keyEnd = md.indexOf('**Key balance', keyStart);
  const keyBlock = md.slice(keyStart, keyEnd);
  for (const m of keyBlock.matchAll(/^\| (\d+) \| ([^|]+?) \| ([^|]+?) \| ([^|]+?) \|$/gm)) {
    res.keyRows.push({ number: +m[1], answer: m[2].trim(), category: m[3].trim(), difficulty: m[4].trim() });
  }
  const sd = md.match(/\| Easy \| Moderate \| Difficult \| Very difficult \|\n\|[-| ]+\|\n\| (\d+) \| (\d+) \| (\d+) \| (\d+) \|/);
  if (sd) res.statedDifficulty = { easy: +sd[1], moderate: +sd[2], difficult: +sd[3], veryDifficult: +sd[4] };

  // Walk headings
  const lines = md.split('\n');
  type Cur = { type: 'q'; n: number; headingAnswer: string; heading: string; buf: string[] } | { type: 'p'; n: number; title: string; buf: string[] } | { type: 'diag'; buf: string[] } | { type: 'strategy'; buf: string[] } | null;
  let cur: Cur = null;
  const close = () => {
    if (!cur) return;
    const text = cur.buf.join('\n').replace(/\n-{3,}\s*$/,'').trim();
    if (cur.type === 'q') res.explanations[cur.n] = { headingAnswer: cur.headingAnswer, heading: cur.heading, markdown: text };
    else if (cur.type === 'p') res.passageNotes[cur.n] = { title: cur.title, markdown: text };
    else if (cur.type === 'strategy') res.strategyMarkdown = text;
    else res.diagnosticMarkdown = text;
    cur = null;
  };
  for (const line of lines) {
    const qh = line.match(/^### Q(\d+)\. Answer: ([A-D0-9]+)(.*)$/);
    if (qh) { close(); cur = { type: 'q', n: +qh[1], headingAnswer: qh[2], heading: line.replace(/^### /, ''), buf: [] }; continue; }
    const ph = line.match(/^## Passage (\d+): (.*)$/);
    if (ph) { close(); cur = { type: 'p', n: +ph[1], title: ph[2].trim(), buf: [] }; continue; }
    if (/^## Diagnostic guide/.test(line)) { close(); cur = { type: 'diag', buf: [] }; continue; }
    if (/^## Strategy note/.test(line)) { close(); cur = { type: 'strategy', buf: [] }; continue; }
    if (/^##? /.test(line)) { close(); continue; }
    if (/^### /.test(line)) { close(); continue; }
    if (line.trim() === '---') { if (cur && cur.type !== 'diag' && cur.type !== 'strategy') { close(); } continue; }
    if (cur) cur.buf.push(line);
  }
  close();
  return res;
}

// ---------------- Helpers ----------------
export function md2html(s: string): string { return marked.parse(s, { async: false, gfm: true }) as string; }
export function inline(s: string): string { return marked.parseInline(s, { async: false, gfm: true }) as string; }

/** Split a solution explanation into body + takeaway (if a takeaway paragraph is present). */
export function splitTakeaway(mdText: string): { body: string; takeaway: string | null } {
  const re = /^\*\*(?:Learning )?[Tt]akeaway:?\*\*:?\s*([\s\S]*?)(?=\n\s*\n|$)/m;
  const m = mdText.match(re);
  if (!m) return { body: mdText, takeaway: null };
  return { body: (mdText.slice(0, m.index) + mdText.slice((m.index ?? 0) + m[0].length)).trim(), takeaway: m[1].trim() };
}

export function difficultyCounts(labels: string[]) {
  const c = { easy: 0, moderate: 0, difficult: 0, veryDifficult: 0, other: 0 };
  for (const l of labels) {
    const k = l.toLowerCase().trim();
    if (k === 'easy') c.easy++; else if (k === 'moderate') c.moderate++; else if (k === 'difficult') c.difficult++; else if (k === 'very difficult') c.veryDifficult++; else c.other++;
  }
  return c;
}
