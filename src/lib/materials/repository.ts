import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import type {
  Attachment,
  NewMaterialInput,
  SchoolLevel,
  SharedMaterial,
} from "../domain/types";
import { getAdminDb } from "../firebase/admin";

// Teacher-contributed materials (자료 공유 게시판). Server-side via admin SDK.
// Without Firestore, lists are empty and creates are rejected (board is a
// logged-in feature, so there's no seed fallback here).

export const MATERIALS_COLLECTION = "shared_materials";

const TITLE_MAX = 120;
const SUMMARY_MAX = 200;
const BODY_MAX = 8000;

function toMaterial(id: string, data: FirebaseFirestore.DocumentData): SharedMaterial {
  const createdAt = data.createdAt as Timestamp | undefined;
  return {
    id,
    authorUid: data.authorUid ?? "",
    authorName: data.authorName ?? "익명",
    schoolLevel: data.schoolLevel,
    category: data.category,
    title: data.title ?? "",
    summary: data.summary ?? "",
    body: data.body ?? "",
    attachments: Array.isArray(data.attachments) ? (data.attachments as Attachment[]) : [],
    createdAt: createdAt?.toDate().toISOString() ?? "",
    usedCount: typeof data.usedCount === "number" ? data.usedCount : 0,
  };
}

const ATTACH_MAX = 5;

/** 첨부 목록 검증: 이름 + 우리 Storage(firebasestorage) URL만 허용(임의 링크 주입 차단). */
function sanitizeAttachments(raw: unknown): Attachment[] {
  if (!Array.isArray(raw)) return [];
  const out: Attachment[] = [];
  for (const a of raw) {
    if (!a || typeof a !== "object") continue;
    const r = a as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim().slice(0, 120) : "";
    const url = typeof r.url === "string" ? r.url : "";
    if (name && /^https:\/\/firebasestorage\.googleapis\.com\//.test(url)) {
      out.push({ name, url });
    }
    if (out.length >= ATTACH_MAX) break;
  }
  return out;
}

/** Validate + normalize submitted fields. Returns null when invalid. */
export function sanitizeInput(raw: unknown): NewMaterialInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const schoolLevel = r.schoolLevel === "high" ? "high" : "middle";
  const category =
    r.category === "lesson" || r.category === "info" || r.category === "checklist"
      ? r.category
      : "activity";
  const title = typeof r.title === "string" ? r.title.trim().slice(0, TITLE_MAX) : "";
  const summary = typeof r.summary === "string" ? r.summary.trim().slice(0, SUMMARY_MAX) : "";
  const body = typeof r.body === "string" ? r.body.trim().slice(0, BODY_MAX) : "";
  const attachments = sanitizeAttachments(r.attachments);
  // 첨부가 있으면 본문 없이도 허용(파일만 공유하는 자료), 아니면 본문 필수.
  if (!title || (!body && attachments.length === 0)) return null;
  return { schoolLevel, category, title, summary, body, attachments };
}

export async function createMaterial(
  input: NewMaterialInput,
  author: { uid: string; name: string },
): Promise<string | null> {
  const db = getAdminDb();
  if (!db) return null;
  const ref = await db.collection(MATERIALS_COLLECTION).add({
    ...input,
    authorUid: author.uid,
    authorName: author.name,
    usedCount: 0,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

/** Newest first; optional school-level filter. Sorted in memory (no index). */
export async function listMaterials(
  level?: SchoolLevel,
): Promise<SharedMaterial[]> {
  const db = getAdminDb();
  if (!db) return [];
  const snap = await db.collection(MATERIALS_COLLECTION).get();
  return snap.docs
    .map((doc) => toMaterial(doc.id, doc.data()))
    .filter((m) => !level || m.schoolLevel === level)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getMaterialById(
  id: string,
): Promise<SharedMaterial | undefined> {
  const db = getAdminDb();
  if (!db) return undefined;
  const doc = await db.collection(MATERIALS_COLLECTION).doc(id).get();
  return doc.exists ? toMaterial(doc.id, doc.data()!) : undefined;
}
