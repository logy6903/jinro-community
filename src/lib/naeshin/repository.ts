import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import type { GroupSpec, NaeshinSpec } from "./types";
import { getAdminDb } from "../firebase/admin";

// 내신 산출 spec 영속화 (Firestore `naeshin_specs`). 요강에서 추출(AI)하거나
// 손인코딩한 spec을 저장 → 검수 UI가 불러와 역산/골든 검증. id는 (요강 소스 +
// 전형) 기반. groups는 배열-속의-객체(각 객체에 gradeScore 배열) — Firestore OK
// (직접 중첩배열 아님).

export const NAESHIN_SPECS_COLLECTION = "naeshin_specs";

function toSpec(id: string, d: FirebaseFirestore.DocumentData): NaeshinSpec {
  const createdAt = d.createdAt as Timestamp | undefined;
  const groups: GroupSpec[] = Array.isArray(d.groups)
    ? d.groups.map((g: Record<string, unknown>) => ({
        key: String(g.key ?? "?"),
        name: String(g.name ?? ""),
        gradeScore: Array.isArray(g.gradeScore) ? g.gradeScore.map(Number) : [],
        reflectRatio: Number(g.reflectRatio ?? 0),
      }))
    : [];
  return {
    id,
    university: d.university ?? "",
    track: d.track ?? "",
    pattern: "weighted_average",
    groups,
    maxScore: Number(d.maxScore ?? 0),
    sourceId: d.sourceId || undefined,
    createdAt: createdAt?.toDate().toISOString(),
  } as NaeshinSpec & { createdAt?: string };
}

export async function listSpecs(): Promise<NaeshinSpec[]> {
  const db = getAdminDb();
  if (!db) return [];
  const snap = await db.collection(NAESHIN_SPECS_COLLECTION).get();
  return snap.docs
    .map((doc) => toSpec(doc.id, doc.data()))
    .sort((a, b) => a.university.localeCompare(b.university));
}

export async function getSpecById(id: string): Promise<NaeshinSpec | undefined> {
  const db = getAdminDb();
  if (!db) return undefined;
  const doc = await db.collection(NAESHIN_SPECS_COLLECTION).doc(id).get();
  return doc.exists ? toSpec(doc.id, doc.data()!) : undefined;
}

/** spec upsert (id를 doc id로). Firestore 미설정이면 null. */
export async function saveSpec(spec: NaeshinSpec): Promise<string | null> {
  const db = getAdminDb();
  if (!db) return null;
  const { id, ...rest } = spec;
  await db
    .collection(NAESHIN_SPECS_COLLECTION)
    .doc(id)
    .set(
      {
        university: rest.university,
        track: rest.track,
        pattern: "weighted_average",
        maxScore: rest.maxScore,
        groups: rest.groups,
        ...(rest.sourceId ? { sourceId: rest.sourceId } : {}),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  return id;
}
