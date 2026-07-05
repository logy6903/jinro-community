import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import type {
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
    createdAt: createdAt?.toDate().toISOString() ?? "",
    usedCount: typeof data.usedCount === "number" ? data.usedCount : 0,
  };
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
  if (!title || !body) return null;
  return { schoolLevel, category, title, summary, body };
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
