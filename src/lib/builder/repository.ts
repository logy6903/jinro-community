import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import type {
  AiBlockConfig,
  AnswerValue,
  AppInput,
  Block,
  BuilderApp,
  ContentBlock,
  ContentType,
  FieldConfig,
  FieldType,
  Submission,
} from "./types";
import { getAdminDb } from "../firebase/admin";

// No-code app builder — server-side repository (admin SDK).
//
// Two collections, both namespaced with `builder_` so they coexist cleanly with
// the community's own data in the same Firebase project:
//   - builder_apps        : teacher-authored app definitions
//   - builder_submissions : student responses
//
// Without Firestore configured, reads return empty and writes return null — the
// same graceful-degradation contract the rest of the app uses.

export const APPS_COLLECTION = "builder_apps";
export const SUBMISSIONS_COLLECTION = "builder_submissions";

const TITLE_MAX = 120;
const LABEL_MAX = 200;
const MAX_FIELDS = 40;
const MAX_OPTIONS = 20;
const OPTION_MAX = 100;
const ANSWER_MAX = 5000;
const NAME_MAX = 60;
const AI_TITLE_MAX = 40;
const AI_INSTRUCTION_MAX = 2000;
const MAX_AI_BLOCKS = 10;

const FIELD_TYPES: readonly FieldType[] = ["short", "long", "number", "choice"];

// Shareable code: 4 chars, uppercase, ambiguous glyphs (O/0/I/1/L) removed so a
// teacher can read one aloud without confusion.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 4;

function randomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

function randomId(prefix: string): string {
  return `${prefix}${Math.random().toString(36).slice(2, 8)}`;
}

// --- mappers ---------------------------------------------------------------

function toApp(id: string, data: FirebaseFirestore.DocumentData): BuilderApp {
  const createdAt = data.createdAt as Timestamp | undefined;
  // Prefer the new `blocks`; migrate legacy apps that stored only `fields`.
  const blocks: Block[] = Array.isArray(data.blocks)
    ? (data.blocks as Block[])
    : Array.isArray(data.fields)
      ? (data.fields as FieldConfig[]).map((f) => ({ ...f, kind: "field" as const }))
      : [];
  return {
    id,
    code: data.code ?? "",
    ownerUid: data.ownerUid ?? "",
    ownerName: data.ownerName ?? "익명",
    title: data.title ?? "",
    school: data.school ?? "",
    year: typeof data.year === "number" ? data.year : 0,
    semester: typeof data.semester === "number" ? data.semester : 0,
    openAt: data.openAt ?? "",
    closeAt: data.closeAt ?? "",
    rosterId: data.rosterId ?? "",
    blocks,
    fields: blocks.filter((b): b is FieldConfig => b.kind === "field"),
    aiBlocks: Array.isArray(data.aiBlocks)
      ? (data.aiBlocks as AiBlockConfig[])
      : [],
    createdAt: createdAt?.toDate().toISOString() ?? "",
  };
}

function toSubmission(
  id: string,
  data: FirebaseFirestore.DocumentData,
): Submission {
  const submittedAt = data.submittedAt as Timestamp | undefined;
  return {
    id,
    appId: data.appId ?? "",
    studentName: data.studentName ?? "익명",
    studentNo: data.studentNo ?? "",
    studentId: data.studentId ?? "",
    answers: (data.answers ?? {}) as Record<string, AnswerValue>,
    aiOutputs: (data.aiOutputs ?? {}) as Record<string, string>,
    submittedAt: submittedAt?.toDate().toISOString() ?? "",
  };
}

// --- validation ------------------------------------------------------------

/** Validate + normalize a single field. Returns null when unusable. */
function sanitizeField(raw: unknown): FieldConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const type = FIELD_TYPES.includes(r.type as FieldType)
    ? (r.type as FieldType)
    : null;
  if (!type) return null;

  const label =
    typeof r.label === "string" ? r.label.trim().slice(0, LABEL_MAX) : "";
  if (!label) return null;

  const id =
    typeof r.id === "string" && r.id.trim() ? r.id.trim() : randomId("f");
  const required = r.required === true;

  const field: FieldConfig = { id, kind: "field", type, label, required };

  if (type === "choice") {
    const options = Array.isArray(r.options)
      ? r.options
          .filter((o): o is string => typeof o === "string")
          .map((o) => o.trim().slice(0, OPTION_MAX))
          .filter(Boolean)
          .slice(0, MAX_OPTIONS)
      : [];
    if (options.length === 0) return null; // a choice with no options is invalid
    field.options = options;
  }

  return field;
}

const CONTENT_TYPES: readonly ContentType[] = ["text", "image", "pdf", "link"];
const CONTENT_VALUE_MAX = 5000;

/** Validate + normalize a presentation content block. Null when empty. */
function sanitizeContentBlock(r: Record<string, unknown>): ContentBlock | null {
  const contentType = CONTENT_TYPES.includes(r.contentType as ContentType)
    ? (r.contentType as ContentType)
    : "text";
  const value =
    typeof r.value === "string"
      ? r.value.trim().slice(0, CONTENT_VALUE_MAX)
      : "";
  if (!value) return null;
  const id =
    typeof r.id === "string" && r.id.trim() ? r.id.trim() : randomId("c");
  const block: ContentBlock = { id, kind: "content", contentType, value };
  if (typeof r.label === "string" && r.label.trim()) {
    block.label = r.label.trim().slice(0, LABEL_MAX);
  }
  return block;
}

/** Route a raw block to the right sanitizer by kind (default: field). */
function sanitizeBlock(raw: unknown): Block | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.kind === "content") return sanitizeContentBlock(r);
  return sanitizeField(r);
}

/** Validate + normalize a single AI block. Returns null when unusable. */
function sanitizeAiBlock(
  raw: unknown,
  validFieldIds: Set<string>,
): AiBlockConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const instruction =
    typeof r.instruction === "string"
      ? r.instruction.trim().slice(0, AI_INSTRUCTION_MAX)
      : "";
  if (!instruction) return null; // an AI block with no instruction does nothing

  const title =
    typeof r.title === "string" && r.title.trim()
      ? r.title.trim().slice(0, AI_TITLE_MAX)
      : "AI 피드백";
  const model = r.model === "smart" ? "smart" : "fast";
  const showToStudent = r.showToStudent !== false; // default: show to student
  const id =
    typeof r.id === "string" && r.id.trim() ? r.id.trim() : randomId("ai");

  const block: AiBlockConfig = { id, title, instruction, model, showToStudent };

  // Reserved (not yet in the UI): restrict which fields the AI reads. Keep only
  // ids that actually exist in this app.
  if (Array.isArray(r.inputFieldIds)) {
    const ids = r.inputFieldIds.filter(
      (x): x is string => typeof x === "string" && validFieldIds.has(x),
    );
    if (ids.length > 0) block.inputFieldIds = ids;
  }

  return block;
}

/** Validate + normalize a teacher's app payload. Returns null when invalid. */
export function sanitizeAppInput(raw: unknown): AppInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const title =
    typeof r.title === "string" ? r.title.trim().slice(0, TITLE_MAX) : "";
  if (!title) return null;

  const school =
    typeof r.school === "string" ? r.school.trim().slice(0, 60) : "";
  const year =
    typeof r.year === "number" && r.year >= 2000 && r.year <= 2100
      ? Math.floor(r.year)
      : 0;
  const semester = r.semester === 1 || r.semester === 2 ? r.semester : 0;
  const openAt = typeof r.openAt === "string" ? r.openAt.trim().slice(0, 30) : "";
  const closeAt =
    typeof r.closeAt === "string" ? r.closeAt.trim().slice(0, 30) : "";
  const rosterId =
    typeof r.rosterId === "string" ? r.rosterId.trim().slice(0, 40) : "";

  if (!Array.isArray(r.blocks)) return null;
  const blocks = r.blocks
    .map(sanitizeBlock)
    .filter((b): b is Block => b !== null)
    .slice(0, MAX_FIELDS);

  // Ensure block ids are unique (field ids key the answers map).
  const seen = new Set<string>();
  for (const b of blocks) {
    while (seen.has(b.id)) b.id = randomId("b");
    seen.add(b.id);
  }

  // Need at least one input field — something for the student to submit.
  const fieldIds = new Set(
    blocks.filter((b) => b.kind === "field").map((b) => b.id),
  );
  if (fieldIds.size === 0) return null;

  const aiBlocks = Array.isArray(r.aiBlocks)
    ? r.aiBlocks
        .map((b) => sanitizeAiBlock(b, fieldIds))
        .filter((b): b is AiBlockConfig => b !== null)
        .slice(0, MAX_AI_BLOCKS)
    : [];

  return {
    title,
    school,
    year,
    semester,
    openAt,
    closeAt,
    rosterId,
    blocks,
    aiBlocks,
  };
}

/**
 * Validate a student's raw answers against the app's field config. Returns the
 * normalized answers map, or null when a required field is missing / a choice
 * value is out of range. Extra keys not in the config are dropped.
 */
export function sanitizeAnswers(
  app: BuilderApp,
  rawAnswers: unknown,
): Record<string, AnswerValue> | null {
  if (!rawAnswers || typeof rawAnswers !== "object") return null;
  const raw = rawAnswers as Record<string, unknown>;
  const answers: Record<string, AnswerValue> = {};

  for (const field of app.fields) {
    const value = raw[field.id];

    if (field.type === "number") {
      const num =
        typeof value === "number"
          ? value
          : typeof value === "string" && value.trim() !== ""
            ? Number(value)
            : NaN;
      if (Number.isNaN(num)) {
        if (field.required) return null;
        continue;
      }
      answers[field.id] = num;
      continue;
    }

    const str = typeof value === "string" ? value.trim().slice(0, ANSWER_MAX) : "";
    if (!str) {
      if (field.required) return null;
      continue;
    }
    if (field.type === "choice" && !(field.options ?? []).includes(str)) {
      return null; // value not among the allowed options
    }
    answers[field.id] = str;
  }

  return answers;
}

// --- apps ------------------------------------------------------------------

export async function createApp(
  input: AppInput,
  owner: { uid: string; name: string },
): Promise<{ id: string; code: string } | null> {
  const db = getAdminDb();
  if (!db) return null;

  // Generate a code not already in use. A handful of tries is plenty at this
  // scale (31^4 ≈ 920k combinations); give up gracefully rather than loop hard.
  let code = "";
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = randomCode();
    const clash = await db
      .collection(APPS_COLLECTION)
      .where("code", "==", candidate)
      .limit(1)
      .get();
    if (clash.empty) {
      code = candidate;
      break;
    }
  }
  if (!code) return null;

  const ref = await db.collection(APPS_COLLECTION).add({
    code,
    ownerUid: owner.uid,
    ownerName: owner.name,
    title: input.title,
    school: input.school,
    year: input.year,
    semester: input.semester,
    openAt: input.openAt,
    closeAt: input.closeAt,
    rosterId: input.rosterId,
    blocks: input.blocks,
    aiBlocks: input.aiBlocks,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { id: ref.id, code };
}

/** Apps owned by one teacher, newest first (sorted in memory — no index). */
export async function listAppsByOwner(uid: string): Promise<BuilderApp[]> {
  const db = getAdminDb();
  if (!db) return [];
  const snap = await db
    .collection(APPS_COLLECTION)
    .where("ownerUid", "==", uid)
    .get();
  return snap.docs
    .map((doc) => toApp(doc.id, doc.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getAppById(id: string): Promise<BuilderApp | undefined> {
  const db = getAdminDb();
  if (!db) return undefined;
  const doc = await db.collection(APPS_COLLECTION).doc(id).get();
  return doc.exists ? toApp(doc.id, doc.data()!) : undefined;
}

/** Look up an app by its public shareable code (for the student form). */
export async function getAppByCode(
  code: string,
): Promise<BuilderApp | undefined> {
  const db = getAdminDb();
  if (!db) return undefined;
  const snap = await db
    .collection(APPS_COLLECTION)
    .where("code", "==", code.toUpperCase())
    .limit(1)
    .get();
  const doc = snap.docs[0];
  return doc ? toApp(doc.id, doc.data()) : undefined;
}

// --- submissions -----------------------------------------------------------

export async function createSubmission(
  appId: string,
  studentName: string,
  studentNo: string,
  studentId: string,
  answers: Record<string, AnswerValue>,
  aiOutputs: Record<string, string> = {},
): Promise<string | null> {
  const db = getAdminDb();
  if (!db) return null;
  const name = studentName.trim().slice(0, NAME_MAX) || "익명";
  const ref = await db.collection(SUBMISSIONS_COLLECTION).add({
    appId,
    studentName: name,
    studentNo: studentNo.trim().slice(0, 20),
    studentId: studentId.trim().slice(0, 40),
    answers,
    aiOutputs,
    submittedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

/** Submissions to one app, newest first (sorted in memory — no index). */
export async function listSubmissions(appId: string): Promise<Submission[]> {
  const db = getAdminDb();
  if (!db) return [];
  const snap = await db
    .collection(SUBMISSIONS_COLLECTION)
    .where("appId", "==", appId)
    .get();
  return snap.docs
    .map((doc) => toSubmission(doc.id, doc.data()))
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}
