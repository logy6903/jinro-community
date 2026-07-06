import { FieldValue } from "firebase-admin/firestore";
import type { DatasetLevel, ScheduleInput, ScheduleItem } from "../domain/types";
import { getAdminDb } from "../firebase/admin";

// Teacher-added school schedule items. Per-teacher ownership (진로교사 1명/학교이므로
// 교사별 = 학교 일정). Server-side via admin SDK.

export const SCHEDULE_COLLECTION = "schedule_items";

const MD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function sanitizeScheduleInput(raw: unknown): ScheduleInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const level: DatasetLevel =
    r.level === "high" || r.level === "both" ? r.level : "middle";
  const title = typeof r.title === "string" ? r.title.trim().slice(0, 120) : "";
  const hint = typeof r.hint === "string" ? r.hint.trim().slice(0, 300) : "";
  const start = typeof r.start === "string" ? r.start.trim() : "";
  const endRaw = typeof r.end === "string" ? r.end.trim() : "";
  const end = endRaw || start;
  if (!title || !MD.test(start) || !MD.test(end)) return null;
  return { level, title, hint, start, end };
}

export async function createScheduleItem(
  input: ScheduleInput,
  uid: string,
): Promise<string | null> {
  const db = getAdminDb();
  if (!db) return null;
  const ref = await db.collection(SCHEDULE_COLLECTION).add({
    ...input,
    origin: "teacher",
    authorUid: uid,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function listTeacherScheduleItems(
  uid: string,
): Promise<ScheduleItem[]> {
  const db = getAdminDb();
  if (!db) return [];
  const snap = await db
    .collection(SCHEDULE_COLLECTION)
    .where("authorUid", "==", uid)
    .get();
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      level: x.level ?? "middle",
      title: x.title ?? "",
      hint: x.hint ?? "",
      start: x.start ?? "",
      end: x.end ?? x.start ?? "",
      origin: "teacher" as const,
      authorUid: x.authorUid,
    };
  });
}

export async function deleteScheduleItem(
  id: string,
  uid: string,
): Promise<boolean> {
  const db = getAdminDb();
  if (!db) return false;
  const ref = db.collection(SCHEDULE_COLLECTION).doc(id);
  const doc = await ref.get();
  if (!doc.exists || doc.data()?.authorUid !== uid) return false;
  await ref.delete();
  return true;
}
