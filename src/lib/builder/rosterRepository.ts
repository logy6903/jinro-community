import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import type { Roster, RosterInput, RosterStudent } from "./types";
import { getAdminDb } from "../firebase/admin";

// Class rosters (명렬) — server-side repository (admin SDK). Gives students a
// stable identity (학번) so their work groups reliably across assignments/years.
// Same graceful-degradation contract as the rest of the builder.

export const ROSTERS_COLLECTION = "builder_rosters";

const NAME_MAX = 60;
const SCHOOL_MAX = 60;
const MAX_STUDENTS = 300;
const SNO_MAX = 20;
const SNAME_MAX = 40;

function toRoster(id: string, data: FirebaseFirestore.DocumentData): Roster {
  const createdAt = data.createdAt as Timestamp | undefined;
  return {
    id,
    ownerUid: data.ownerUid ?? "",
    ownerName: data.ownerName ?? "익명",
    name: data.name ?? "",
    school: data.school ?? "",
    students: Array.isArray(data.students)
      ? (data.students as RosterStudent[])
      : [],
    createdAt: createdAt?.toDate().toISOString() ?? "",
  };
}

function sanitizeStudent(raw: unknown): RosterStudent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const studentNo =
    typeof r.studentNo === "string" ? r.studentNo.trim().slice(0, SNO_MAX) : "";
  const name =
    typeof r.name === "string" ? r.name.trim().slice(0, SNAME_MAX) : "";
  if (!studentNo && !name) return null;
  return { studentNo, name };
}

export function sanitizeRosterInput(raw: unknown): RosterInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.trim().slice(0, NAME_MAX) : "";
  if (!name) return null;
  const school =
    typeof r.school === "string" ? r.school.trim().slice(0, SCHOOL_MAX) : "";
  const students = Array.isArray(r.students)
    ? r.students
        .map(sanitizeStudent)
        .filter((s): s is RosterStudent => s !== null)
        .slice(0, MAX_STUDENTS)
    : [];
  return { name, school, students };
}

export async function createRoster(
  input: RosterInput,
  owner: { uid: string; name: string },
): Promise<string | null> {
  const db = getAdminDb();
  if (!db) return null;
  const ref = await db.collection(ROSTERS_COLLECTION).add({
    ownerUid: owner.uid,
    ownerName: owner.name,
    name: input.name,
    school: input.school,
    students: input.students,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

/** Rosters owned by one teacher, newest first (sorted in memory — no index). */
export async function listRostersByOwner(uid: string): Promise<Roster[]> {
  const db = getAdminDb();
  if (!db) return [];
  const snap = await db
    .collection(ROSTERS_COLLECTION)
    .where("ownerUid", "==", uid)
    .get();
  return snap.docs
    .map((doc) => toRoster(doc.id, doc.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getRosterById(id: string): Promise<Roster | undefined> {
  const db = getAdminDb();
  if (!db) return undefined;
  const doc = await db.collection(ROSTERS_COLLECTION).doc(id).get();
  return doc.exists ? toRoster(doc.id, doc.data()!) : undefined;
}

/** Overwrite name/school/students on an existing roster. */
export async function updateRoster(
  id: string,
  input: RosterInput,
): Promise<boolean> {
  const db = getAdminDb();
  if (!db) return false;
  await db.collection(ROSTERS_COLLECTION).doc(id).update({
    name: input.name,
    school: input.school,
    students: input.students,
  });
  return true;
}
