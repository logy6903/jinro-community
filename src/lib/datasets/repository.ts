import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import type {
  Dataset,
  DatasetCategory,
  DatasetEnvelope,
  DatasetLevel,
} from "../domain/types";
import { getAdminDb } from "../firebase/admin";

// Teacher-uploaded structured datasets ("봉투" + "내용물"). Server-side via
// admin SDK. Firestore can't store nested arrays, so rows are serialized to a
// `rowsJson` string. Empty when Firestore is unconfigured.

export const DATASETS_COLLECTION = "datasets";

// MVP storage caps (one Firestore doc < 1MB). Larger files → Phase 2 (subcollection).
export const MAX_ROWS = 500;
export const MAX_COLS = 40;
const MAX_CELL = 1000;
const MAX_TITLE = 150;
const MAX_SOURCE = 300;
const MAX_YEAR = 40;
const MAX_CUSTOM_FIELDS = 12;
const MAX_FIELD_KEY = 40;
const MAX_FIELD_VALUE = 200;

const CATEGORIES: DatasetCategory[] = [
  "admission",
  "essay",
  "record",
  "interview",
  "result",
  "career",
  "activity",
  "contest",
  "etc",
];

export interface DatasetInput {
  envelope: DatasetEnvelope;
  columns: string[];
  rows: string[][];
  /** Total rows the teacher's file had (may exceed the stored, capped rows). */
  totalRows: number;
  /** PDF 추출본이면 원본 소스([[PdfSource]]) id. 엑셀 업로드면 생략. */
  sourceId?: string;
  /** 원문 PDF 열람 URL ("원문 보기" 링크). */
  originalUrl?: string;
}

/** Validate + normalize an upload. Returns null when structurally invalid. */
export function sanitizeDatasetInput(raw: unknown): DatasetInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const env = (r.envelope ?? {}) as Record<string, unknown>;

  const title = str(env.title, MAX_TITLE);
  const source = str(env.source, MAX_SOURCE);
  const year = str(env.year, MAX_YEAR);
  const category = CATEGORIES.includes(env.category as DatasetCategory)
    ? (env.category as DatasetCategory)
    : "etc";
  const schoolLevel: DatasetLevel =
    env.schoolLevel === "high" || env.schoolLevel === "both"
      ? (env.schoolLevel as DatasetLevel)
      : "middle";

  const rawCustom = Array.isArray(env.customFields) ? env.customFields : [];
  const customFields = rawCustom
    .slice(0, MAX_CUSTOM_FIELDS)
    .map((f) => {
      const o = (f ?? {}) as Record<string, unknown>;
      return { key: str(o.key, MAX_FIELD_KEY), value: str(o.value, MAX_FIELD_VALUE) };
    })
    .filter((f) => f.key && f.value);

  const rawCols = Array.isArray(r.columns) ? r.columns : [];
  const columns = rawCols.slice(0, MAX_COLS).map((c) => str(c, 120));
  if (!title || columns.length === 0) return null;

  const rawRows = Array.isArray(r.rows) ? r.rows : [];
  const totalRows = rawRows.length;
  const rows = rawRows
    .slice(0, MAX_ROWS)
    .map((row) =>
      (Array.isArray(row) ? row : []).slice(0, columns.length).map((c) => str(c, MAX_CELL)),
    );

  const sourceId = str(r.sourceId, 120) || undefined;
  const originalUrl = str(r.originalUrl, 500) || undefined;

  return {
    envelope: { title, category, schoolLevel, year, source, customFields },
    columns,
    rows,
    totalRows,
    sourceId,
    originalUrl,
  };
}

function str(v: unknown, max: number): string {
  return typeof v === "string"
    ? v.trim().slice(0, max)
    : v == null
      ? ""
      : String(v).trim().slice(0, max);
}

function toDataset(id: string, data: FirebaseFirestore.DocumentData): Dataset {
  const createdAt = data.createdAt as Timestamp | undefined;
  let rows: string[][] = [];
  try {
    const parsed = JSON.parse(data.rowsJson ?? "[]");
    if (Array.isArray(parsed)) rows = parsed;
  } catch {
    /* leave empty */
  }
  return {
    id,
    title: data.title ?? "",
    category: data.category ?? "etc",
    schoolLevel: data.schoolLevel ?? "middle",
    year: data.year ?? "",
    source: data.source ?? "",
    customFields: Array.isArray(data.customFields) ? data.customFields : [],
    authorUid: data.authorUid ?? "",
    authorName: data.authorName ?? "익명",
    columns: Array.isArray(data.columns) ? data.columns : [],
    rows,
    rowCount: typeof data.rowCount === "number" ? data.rowCount : rows.length,
    ...(data.sourceId ? { sourceId: data.sourceId } : {}),
    ...(data.originalUrl ? { originalUrl: data.originalUrl } : {}),
    createdAt: createdAt?.toDate().toISOString() ?? "",
  };
}

export async function createDataset(
  input: DatasetInput,
  author: { uid: string; name: string },
): Promise<string | null> {
  const db = getAdminDb();
  if (!db) return null;
  const ref = await db.collection(DATASETS_COLLECTION).add({
    ...input.envelope,
    authorUid: author.uid,
    authorName: author.name,
    columns: input.columns,
    rowsJson: JSON.stringify(input.rows),
    rowCount: input.totalRows,
    // Firestore는 undefined를 거부 — 있을 때만 넣는다.
    ...(input.sourceId ? { sourceId: input.sourceId } : {}),
    ...(input.originalUrl ? { originalUrl: input.originalUrl } : {}),
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

/** Lightweight list (no rows) for the index page. */
export async function listDatasets(): Promise<Omit<Dataset, "rows">[]> {
  const db = getAdminDb();
  if (!db) return [];
  const snap = await db.collection(DATASETS_COLLECTION).get();
  return snap.docs
    .map((doc) => {
      const d = toDataset(doc.id, doc.data());
      const { rows: _rows, ...rest } = d;
      void _rows;
      return rest;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getDatasetById(id: string): Promise<Dataset | undefined> {
  const db = getAdminDb();
  if (!db) return undefined;
  const doc = await db.collection(DATASETS_COLLECTION).doc(id).get();
  return doc.exists ? toDataset(doc.id, doc.data()!) : undefined;
}

/** Distinct custom-field keys already used — feeds the upload form's autocomplete
 * so teachers converge on shared names (지역, 난이도, …) instead of inventing. */
export async function listCustomFieldKeys(): Promise<string[]> {
  const db = getAdminDb();
  if (!db) return [];
  const snap = await db.collection(DATASETS_COLLECTION).get();
  const keys = new Set<string>();
  for (const doc of snap.docs) {
    const cf = doc.data().customFields;
    if (Array.isArray(cf)) {
      for (const f of cf) if (f?.key) keys.add(String(f.key));
    }
  }
  return [...keys].sort();
}
