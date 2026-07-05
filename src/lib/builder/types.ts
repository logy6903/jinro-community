// No-code teacher app builder — shared types.
//
// A teacher composes an "app" as an ordered list of fields (config, not code).
// One engine renders any app's config as a student-facing form at /a/{code};
// there is no per-app deployment. Storage lives in jinro-community's own
// Firebase project (collections `builder_apps`, `builder_submissions`).
//
// Slices: field collection (short/long/number/choice) + AI blocks (below).
// Cross-field references and student rosters are still deliberately deferred.

/** Field kinds supported so far. `file` comes in a later slice. */
export type FieldType = "short" | "long" | "number" | "choice";

export interface FieldConfig {
  /** Stable within the app; used as the answer key in submissions. */
  id: string;
  kind: "field";
  type: FieldType;
  label: string;
  required: boolean;
  /** Choices for `type: "choice"`. Ignored otherwise. */
  options?: string[];
}

/**
 * Presentation content the teacher SHOWS the student (not an input). Turns the
 * app from a submission box into an activity: 자료 제시 → 활동.
 */
export type ContentType = "text" | "image" | "pdf" | "link";

export interface ContentBlock {
  id: string;
  kind: "content";
  contentType: ContentType;
  /** text: the body; image/link: the URL. */
  value: string;
  /** Optional caption/heading. */
  label?: string;
}

/** An app is an ordered list of blocks: presentation content + input fields. */
export type Block = FieldConfig | ContentBlock;

/**
 * An AI block: a computed action, not a student input. On submit the engine
 * feeds the student's answers to Claude with the teacher's instruction and
 * stores the result. This is the "AI as a block you drop in" model — the
 * teacher writes plain language, never code.
 */
export type AiModelTier = "fast" | "smart";

export interface AiBlockConfig {
  id: string;
  /** Short label shown to student/teacher, e.g. "피드백". */
  title: string;
  /** Teacher's plain-language instruction (what the AI should do). */
  instruction: string;
  /** "fast" = Haiku (cheap, routine), "smart" = Opus (higher quality). */
  model: AiModelTier;
  /** Show the output to the student on submit; otherwise teacher-only. */
  showToStudent: boolean;
  /**
   * Reserved for the next slice (per-field references): which fields the AI
   * reads. Empty / undefined = read all fields. Not yet exposed in the UI.
   */
  inputFieldIds?: string[];
}

/** A teacher-authored app definition (one Firestore doc in `builder_apps`). */
export interface BuilderApp {
  id: string;
  /** Short shareable code → student URL /a/{code}. Unique across apps. */
  code: string;
  ownerUid: string;
  ownerName: string;
  title: string;
  /** School the assignment belongs to. Per-app — teachers can transfer schools. */
  school: string;
  /** School year (e.g. 2026). 0 = unspecified. Organizes activities across years. */
  year: number;
  /** Semester: 1 or 2. 0 = unspecified. */
  semester: number;
  /** Submission window (datetime-local strings, e.g. "2026-07-10T17:00"). "" = unbounded. */
  openAt: string;
  closeAt: string;
  /** Target class roster (명렬) id. "" = open mode (free 학번+이름, no login). */
  rosterId: string;
  /** Full ordered block list (presentation content + input fields). */
  blocks: Block[];
  /** Input fields only, derived from blocks — for answers/dashboard/AI/records. */
  fields: FieldConfig[];
  /** Optional AI blocks run on submit. */
  aiBlocks: AiBlockConfig[];
  /** ISO string. */
  createdAt: string;
}

/** Teacher-supplied payload on create/update (no server-managed fields). */
export interface AppInput {
  title: string;
  school: string;
  year: number;
  semester: number;
  openAt: string;
  closeAt: string;
  rosterId: string;
  blocks: Block[];
  aiBlocks: AiBlockConfig[];
}

/** A single student answer. Kept simple for now (no file/multi-select yet). */
export type AnswerValue = string | number;

/**
 * A 생활기록부 output template slot. The teacher composes the record's shape as
 * ordered slots; "ai" slots are drafted from the student's activity, "teacher"
 * slots hold the teacher's own judgment (태도·평가) filled in the result grid.
 * A final pass weaves all slot values into one 생기부 paragraph.
 */
export type RecordSlotSource = "teacher" | "ai";

export interface RecordSlot {
  id: string;
  label: string;
  source: RecordSlotSource;
  /** For "ai" slots: what to extract from the student's activity. */
  instruction?: string;
}

/** A student submission to an app (one doc in `builder_submissions`). */
export interface Submission {
  id: string;
  appId: string;
  /** No student login yet — just a self-entered name. */
  studentName: string;
  /** Self-entered 학번. Empty for open apps. */
  studentNo: string;
  /** Stable account id (아이디) for roster apps — the identity records group by. "" for open apps. */
  studentId: string;
  /** Keyed by FieldConfig.id. */
  answers: Record<string, AnswerValue>;
  /** AI block outputs, keyed by AiBlockConfig.id. Present when AI ran. */
  aiOutputs: Record<string, string>;
  /** ISO string. */
  submittedAt: string;
}

/**
 * A class roster (명렬). Gives students a stable identity (학교+학번) so a
 * student's work can be reliably grouped across assignments and years, and so
 * they can revisit their own results/comments. Owned by the teacher.
 */
export interface RosterStudent {
  /** 학번 — stable identifier within the roster. */
  studentNo: string;
  name: string;
}

export interface Roster {
  id: string;
  ownerUid: string;
  ownerName: string;
  /** 반 이름, e.g. "1학년 3반". */
  name: string;
  /** 학교명 (optional). */
  school: string;
  students: RosterStudent[];
  /** ISO string. */
  createdAt: string;
}

export interface RosterInput {
  name: string;
  school: string;
  students: RosterStudent[];
}
