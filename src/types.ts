export type Section = 'RC' | 'VA';
export type Kind = 'rc' | 'summary' | 'placement' | 'parajumble' | 'oddoneout';

export interface Question {
  number: number;
  section: Section;
  kind: Kind;
  passageNumber: number | null;
  isTita: boolean;
  stemHtml: string;
  bodyHtml: string[];
  sentences: { n: number; html: string }[];
  insertSentenceHtml: string | null;
  placementParagraphHtml: string | null;
  options: { key: string; html: string }[];
  answer: string;
  category: string;
  difficulty: string;
  explanationHeading: string;
  explanationHtml: string;
  takeawayHtml: string | null;
}

export interface Passage {
  number: number;
  firstQ: number;
  lastQ: number;
  paragraphsHtml: string[];
  notesTitle: string;
  notesHtml: string;
}

export interface DifficultyCounts { easy: number; moderate: number; difficult: number; veryDifficult: number; other?: number }

export interface Mock {
  id: number;
  title: string;
  paperTitle: string;
  focus: string;
  purpose: string;
  introHtml: string;
  strategyHtml: string;
  diagnosticHtml: string;
  durationMinutes: number;
  mcqCount: number;
  titaCount: number;
  difficulty: { recomputed: DifficultyCounts; statedInSource: DifficultyCounts | null };
  passages: Passage[];
  questions: Question[];
}

/** Per-question state during an attempt, following CAT palette semantics. */
export interface QState {
  visited: boolean;
  /** Response saved via "Save & Next" or "Mark for Review & Next". Only saved responses are evaluated. */
  saved: string | null;
  /** Unsaved selection on screen. Discarded if the candidate navigates away without saving. */
  draft: string | null;
  marked: boolean;
  timeMs: number;
}

export type QStatus = 'notVisited' | 'notAnswered' | 'answered' | 'marked' | 'answeredMarked';

export interface ResultSnapshot {
  score: number; correct: number; incorrect: number; unattempted: number; attempted: number;
  rcScore: number; vaScore: number; accuracy: number; attemptRate: number; timeUsedMs: number;
}

export interface Attempt {
  id: string;
  mockId: number;
  attemptNo: number;
  startedAt: number;
  deadline: number;
  submittedAt: number | null;
  autoSubmitted: boolean;
  current: number;
  states: QState[];
  lastTickAt: number;
  result: ResultSnapshot | null;
}
