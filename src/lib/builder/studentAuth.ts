import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../firebase/admin";

// Student accounts (계정화). Identity = a self-chosen 아이디, stable for life —
// NOT 학번, which is reused across years (grade change reassigns numbers) and so
// can't be an identity. 학번 is a per-roster *enrollment* the student updates
// each year. Records aggregate by 아이디, so a student's work carries across years.
//
//   builder_students/{아이디}         → account: loginId, name, password, enrollments{rosterId→학번}
//   builder_enrollments/{rosterId__학번} → claim: which 아이디 owns this class-학번 (dedup + reverse lookup)
//
// Passwords are scrypt-hashed (Node crypto, no dependency). Names come from the
// roster, never the student — impersonation-proof.

export const STUDENTS_COLLECTION = "builder_students";
export const ENROLLMENTS_COLLECTION = "builder_enrollments";

export function normalizeId(loginId: string): string {
  return loginId.trim().toLowerCase();
}
function claimId(rosterId: string, studentNo: string): string {
  return `${rosterId}__${studentNo.trim()}`;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 32);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export interface StudentAccount {
  loginId: string;
  name: string;
  password: string; // salt:hash
  /** rosterId → 학번 for the classes this account has enrolled in. */
  enrollments: Record<string, string>;
}

export async function getAccount(
  loginId: string,
): Promise<StudentAccount | null> {
  const db = getAdminDb();
  if (!db) return null;
  const doc = await db
    .collection(STUDENTS_COLLECTION)
    .doc(normalizeId(loginId))
    .get();
  if (!doc.exists) return null;
  const d = doc.data()!;
  return {
    loginId: d.loginId ?? normalizeId(loginId),
    name: d.name ?? "",
    password: d.password ?? "",
    enrollments: (d.enrollments ?? {}) as Record<string, string>,
  };
}

/** Who owns this class-학번, if anyone. */
export async function getClaimOwner(
  rosterId: string,
  studentNo: string,
): Promise<string | null> {
  const db = getAdminDb();
  if (!db) return null;
  const doc = await db
    .collection(ENROLLMENTS_COLLECTION)
    .doc(claimId(rosterId, studentNo))
    .get();
  return doc.exists ? (doc.data()!.loginId ?? null) : null;
}

export type CreateResult = "ok" | "id_taken" | "no_taken" | "storage";

/** Create a new account + its first enrollment, atomically. */
export async function createAccount(
  loginId: string,
  name: string,
  password: string,
  rosterId: string,
  studentNo: string,
): Promise<CreateResult> {
  const db = getAdminDb();
  if (!db) return "storage";
  const id = normalizeId(loginId);
  const no = studentNo.trim();
  const accRef = db.collection(STUDENTS_COLLECTION).doc(id);
  const claimRef = db.collection(ENROLLMENTS_COLLECTION).doc(claimId(rosterId, no));
  try {
    await db.runTransaction(async (tx) => {
      const [acc, claim] = await Promise.all([tx.get(accRef), tx.get(claimRef)]);
      if (acc.exists) throw new Error("id_taken");
      if (claim.exists) throw new Error("no_taken");
      tx.set(accRef, {
        loginId: id,
        name,
        password: hashPassword(password),
        enrollments: { [rosterId]: no },
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(claimRef, { loginId: id, name, createdAt: FieldValue.serverTimestamp() });
    });
    return "ok";
  } catch (e) {
    const m = (e as Error).message;
    return m === "id_taken" || m === "no_taken" ? (m as CreateResult) : "storage";
  }
}

export type EnrollResult = "ok" | "no_taken" | "storage";

/** Add a (rosterId, 학번) enrollment to an existing account, atomically. */
export async function enrollAccount(
  loginId: string,
  rosterId: string,
  studentNo: string,
): Promise<EnrollResult> {
  const db = getAdminDb();
  if (!db) return "storage";
  const id = normalizeId(loginId);
  const no = studentNo.trim();
  const accRef = db.collection(STUDENTS_COLLECTION).doc(id);
  const claimRef = db.collection(ENROLLMENTS_COLLECTION).doc(claimId(rosterId, no));
  try {
    await db.runTransaction(async (tx) => {
      const [acc, claim] = await Promise.all([tx.get(accRef), tx.get(claimRef)]);
      if (!acc.exists) throw new Error("storage");
      if (claim.exists && claim.data()!.loginId !== id) throw new Error("no_taken");
      tx.update(accRef, { [`enrollments.${rosterId}`]: no });
      tx.set(claimRef, { loginId: id, createdAt: FieldValue.serverTimestamp() });
    });
    return "ok";
  } catch (e) {
    return (e as Error).message === "no_taken" ? "no_taken" : "storage";
  }
}

// ── Teacher administration ───────────────────────────────────────────────────
// The roster owner can see which 학번 has been claimed by which account and fix
// the two things students can't do themselves: forgotten passwords and (since
// the name is locked to the roster) name corrections.

export interface AccountLink {
  studentNo: string;
  name: string; // from the roster (source of truth)
  loginId: string | null; // claimed account, or null if not registered yet
}

/** For each roster student, resolve whether an account has claimed their 학번. */
export async function listRosterAccounts(
  rosterId: string,
  students: { studentNo: string; name: string }[],
): Promise<AccountLink[]> {
  const base = students.map((s) => ({
    studentNo: s.studentNo,
    name: s.name,
    loginId: null as string | null,
  }));
  const db = getAdminDb();
  if (!db || base.length === 0) return base;
  const refs = students.map((s) =>
    db.collection(ENROLLMENTS_COLLECTION).doc(claimId(rosterId, s.studentNo)),
  );
  const snaps = await db.getAll(...refs);
  return base.map((row, i) => ({
    ...row,
    loginId: snaps[i].exists ? (snaps[i].data()!.loginId ?? null) : null,
  }));
}

/** Set a new password on an existing account (teacher reset). */
export async function resetAccountPassword(
  loginId: string,
  password: string,
): Promise<boolean> {
  const db = getAdminDb();
  if (!db) return false;
  const ref = db.collection(STUDENTS_COLLECTION).doc(normalizeId(loginId));
  const doc = await ref.get();
  if (!doc.exists) return false;
  await ref.update({ password: hashPassword(password) });
  return true;
}

/** Update a linked account's name (roster name is updated by the caller). */
export async function renameAccount(
  loginId: string,
  name: string,
): Promise<boolean> {
  const db = getAdminDb();
  if (!db) return false;
  const ref = db.collection(STUDENTS_COLLECTION).doc(normalizeId(loginId));
  const doc = await ref.get();
  if (!doc.exists) return false;
  await ref.update({ name });
  return true;
}

/**
 * Detach a student from THIS class: drop the (rosterId, 학번) enrollment and free
 * the claim so they can re-register. The account itself is kept — it may hold
 * enrollments for other classes/years.
 */
export async function unenrollStudent(
  rosterId: string,
  studentNo: string,
): Promise<boolean> {
  const db = getAdminDb();
  if (!db) return false;
  const claimRef = db
    .collection(ENROLLMENTS_COLLECTION)
    .doc(claimId(rosterId, studentNo));
  const claim = await claimRef.get();
  const loginId = claim.exists ? (claim.data()!.loginId as string | undefined) : undefined;
  const batch = db.batch();
  batch.delete(claimRef);
  if (loginId) {
    batch.update(db.collection(STUDENTS_COLLECTION).doc(loginId), {
      [`enrollments.${rosterId}`]: FieldValue.delete(),
    });
  }
  await batch.commit();
  return true;
}
