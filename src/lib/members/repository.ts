import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "../firebase/admin";
import {
  REGIONS,
  type MemberStatus,
  type TeacherProfile,
  type TeacherProfileInput,
} from "./types";

// 교사 회원 저장소 (Firestore `teachers`, 문서 id = uid). 서버 전용(admin SDK).
// 관리자는 ADMIN_EMAILS 환경변수(쉼표 구분)로만 판별 — 클라이언트에 노출 안 함.

const COLLECTION = "teachers";
const STATUSES: MemberStatus[] = ["pending", "approved", "rejected"];

/** ADMIN_EMAILS(쉼표 구분)에 포함된 이메일만 관리자. 미설정이면 관리자 없음. */
export function isAdmin(email?: string | null): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** 가입 폼 값 검증·정규화. 필수값 누락이면 null. */
export function sanitizeProfileInput(raw: unknown): TeacherProfileInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = str(r.name, 40);
  const schoolName = str(r.schoolName, 80);
  const region = str(r.region, 20);
  const schoolLevel = r.schoolLevel === "high" ? "high" : r.schoolLevel === "middle" ? "middle" : null;
  if (!name || !schoolName || !schoolLevel) return null;
  if (region && !REGIONS.includes(region as (typeof REGIONS)[number])) return null;
  return { name, schoolLevel, schoolName, region };
}

function toProfile(uid: string, d: FirebaseFirestore.DocumentData): TeacherProfile {
  const createdAt = d.createdAt as Timestamp | undefined;
  const reviewedAt = d.reviewedAt as Timestamp | undefined;
  return {
    uid,
    email: d.email ?? "",
    name: d.name ?? "",
    schoolLevel: d.schoolLevel === "high" ? "high" : "middle",
    schoolName: d.schoolName ?? "",
    region: d.region ?? "",
    status: STATUSES.includes(d.status) ? d.status : "pending",
    ...(createdAt ? { createdAt: createdAt.toDate().toISOString() } : {}),
    ...(reviewedAt ? { reviewedAt: reviewedAt.toDate().toISOString() } : {}),
    ...(d.reviewedBy ? { reviewedBy: d.reviewedBy } : {}),
  };
}

export async function getTeacherProfile(uid: string): Promise<TeacherProfile | null> {
  const db = getAdminDb();
  if (!db) return null;
  const doc = await db.collection(COLLECTION).doc(uid).get();
  return doc.exists ? toProfile(uid, doc.data()!) : null;
}

/** 가입/프로필 수정. 새 문서면 status=pending으로 시작(승인 대기), 기존이면 status 유지. */
export async function upsertTeacherProfile(
  uid: string,
  email: string,
  input: TeacherProfileInput,
): Promise<TeacherProfile | null> {
  const db = getAdminDb();
  if (!db) return null;
  const ref = db.collection(COLLECTION).doc(uid);
  const snap = await ref.get();
  await ref.set(
    {
      email,
      ...input,
      ...(snap.exists ? {} : { status: "pending", createdAt: FieldValue.serverTimestamp() }),
    },
    { merge: true },
  );
  return getTeacherProfile(uid);
}

/** 회원 목록 (상태 필터 선택). 정렬은 JS(복합색인 불필요). */
export async function listTeachers(status?: MemberStatus): Promise<TeacherProfile[]> {
  const db = getAdminDb();
  if (!db) return [];
  const snap = await db.collection(COLLECTION).get();
  return snap.docs
    .map((doc) => toProfile(doc.id, doc.data()))
    .filter((t) => !status || t.status === status)
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
}

/** 관리자 승인/거절. */
export async function setTeacherStatus(
  uid: string,
  status: MemberStatus,
  reviewer: string,
): Promise<boolean> {
  const db = getAdminDb();
  if (!db) return false;
  await db.collection(COLLECTION).doc(uid).set(
    { status, reviewedBy: reviewer, reviewedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  return true;
}
