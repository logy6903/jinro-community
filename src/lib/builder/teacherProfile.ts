import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import type { TeacherProfile, TeacherProfileInput, TeacherRole } from "./types";
import { getAdminDb } from "../firebase/admin";

// Teacher profiles (교사 온보딩 게이트). Keyed by Firebase uid. A teacher must
// declare their school + role before using the builder — a soft gate, since
// Google sign-in can't prove someone is a 진로교사. Same graceful-degradation
// contract as the rest of the builder (returns null when Firebase is unset).

export const TEACHERS_COLLECTION = "builder_teachers";

const NAME_MAX = 40;
const SCHOOL_MAX = 60;
const REGION_MAX = 20;
const CONTACT_MAX = 80;

const ROLES: TeacherRole[] = [
  "career_lead",
  "subject",
  "homeroom",
  "admin",
  "other",
];

function toProfile(uid: string, data: FirebaseFirestore.DocumentData): TeacherProfile {
  const createdAt = data.createdAt as Timestamp | undefined;
  const updatedAt = data.updatedAt as Timestamp | undefined;
  return {
    uid,
    name: data.name ?? "",
    school: data.school ?? "",
    region: data.region ?? "",
    role: (ROLES.includes(data.role) ? data.role : "other") as TeacherRole,
    contact: data.contact ?? "",
    createdAt: createdAt?.toDate().toISOString() ?? "",
    updatedAt: updatedAt?.toDate().toISOString() ?? "",
  };
}

export function sanitizeProfileInput(raw: unknown): TeacherProfileInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.trim().slice(0, NAME_MAX) : "";
  const school =
    typeof r.school === "string" ? r.school.trim().slice(0, SCHOOL_MAX) : "";
  // School is the point of the gate — reject without it.
  if (!name || !school) return null;
  const region =
    typeof r.region === "string" ? r.region.trim().slice(0, REGION_MAX) : "";
  const role = (
    typeof r.role === "string" && ROLES.includes(r.role as TeacherRole)
      ? r.role
      : "other"
  ) as TeacherRole;
  const contact =
    typeof r.contact === "string" ? r.contact.trim().slice(0, CONTACT_MAX) : "";
  return { name, school, region, role, contact };
}

export async function getTeacherProfile(
  uid: string,
): Promise<TeacherProfile | null> {
  const db = getAdminDb();
  if (!db) return null;
  const doc = await db.collection(TEACHERS_COLLECTION).doc(uid).get();
  return doc.exists ? toProfile(uid, doc.data()!) : null;
}

/** True when this teacher has completed onboarding (used to gate write routes). */
export async function hasTeacherProfile(uid: string): Promise<boolean> {
  return (await getTeacherProfile(uid)) !== null;
}

/** Create or update the profile (merge). Returns the stored profile. */
export async function upsertTeacherProfile(
  uid: string,
  input: TeacherProfileInput,
): Promise<TeacherProfile | null> {
  const db = getAdminDb();
  if (!db) return null;
  const ref = db.collection(TEACHERS_COLLECTION).doc(uid);
  const existing = await ref.get();
  await ref.set(
    {
      uid,
      name: input.name,
      school: input.school,
      region: input.region,
      role: input.role,
      contact: input.contact,
      updatedAt: FieldValue.serverTimestamp(),
      ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    },
    { merge: true },
  );
  const saved = await ref.get();
  return saved.exists ? toProfile(uid, saved.data()!) : null;
}
