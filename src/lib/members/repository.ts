import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "../firebase/admin";
import { REGIONS, type TeacherProfile, type TeacherProfileInput } from "./types";

// 교사 회원 저장소 (Firestore `teachers`, 문서 id = uid). 서버 전용(admin SDK).
// 가입은 즉시 완료(사전 승인 없음), 문제 계정은 관리자가 삭제. 관리자는
// ADMIN_EMAILS 환경변수(쉼표 구분)로만 판별 — 클라이언트에 노출 안 함.

const COLLECTION = "teachers";

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

/**
 * 관리자가 입력한 번호를 저장 형식(E.164, +8210…)으로 정규화.
 * 010-1234-5678 / 01012345678 / +821012345678 모두 받는다.
 * 빈 문자열이면 "" (번호 지움), 형식이 이상하면 null(거절).
 */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return "";
  const digits = t.replace(/[^0-9]/g, "");
  // 82로 시작하면 국가번호가 붙은 것, 0으로 시작하면 국내 표기.
  const local = digits.startsWith("82") ? "0" + digits.slice(2) : digits;
  if (!/^0\d{9,10}$/.test(local)) return null;
  return "+82" + local.slice(1);
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
  return {
    uid,
    email: d.email ?? "",
    phone: d.phone ?? "",
    name: d.name ?? "",
    schoolLevel: d.schoolLevel === "high" ? "high" : "middle",
    schoolName: d.schoolName ?? "",
    region: d.region ?? "",
    ...(d.phoneSource === "admin" ? { phoneSource: "admin" as const } : {}),
    ...(createdAt ? { createdAt: createdAt.toDate().toISOString() } : {}),
  };
}

export async function getTeacherProfile(uid: string): Promise<TeacherProfile | null> {
  const db = getAdminDb();
  if (!db) return null;
  const doc = await db.collection(COLLECTION).doc(uid).get();
  return doc.exists ? toProfile(uid, doc.data()!) : null;
}

/** 가입/프로필 수정. email·phone은 검증된 토큰에서 온 값만 받는다(클라 입력 아님).
 *  새 문서면 createdAt 기록, 기존이면 필드만 갱신. */
export async function upsertTeacherProfile(
  uid: string,
  email: string,
  phone: string,
  input: TeacherProfileInput,
): Promise<TeacherProfile | null> {
  const db = getAdminDb();
  if (!db) return null;
  const ref = db.collection(COLLECTION).doc(uid);
  const snap = await ref.get();
  await ref.set(
    {
      email,
      phone,
      ...input,
      ...(snap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    },
    { merge: true },
  );
  return getTeacherProfile(uid);
}

/**
 * 관리자에 의한 프로필 수정. 이름·학교급·학교명·지역, 그리고 (넘어오면) 전화번호.
 *
 * 번호가 바뀐 회원을 고쳐줄 수 있어야 해서 관리자 수정을 허용하되, 본인 SMS
 * 인증으로 들어온 값과 구분하려고 phoneSource를 "admin"으로 남긴다. 화면에서
 * "인증됨"이 아니라 "관리자 입력"으로 표시된다.
 *
 * email(구글 계정)은 로그인 정체성이라 여전히 바꾸지 않는다.
 * 없는 회원이면 null.
 */
export async function updateTeacherProfile(
  uid: string,
  input: TeacherProfileInput,
  phone?: string,
): Promise<TeacherProfile | null> {
  const db = getAdminDb();
  if (!db) return null;
  const ref = db.collection(COLLECTION).doc(uid);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const patch: Record<string, unknown> = { ...input };
  if (phone !== undefined && phone !== (snap.data()?.phone ?? "")) {
    patch.phone = phone;
    patch.phoneSource = "admin";
  }
  await ref.set(patch, { merge: true });
  return getTeacherProfile(uid);
}

/** 전체 회원 목록 (최신 가입 우선). 정렬은 JS(복합색인 불필요). */
export async function listTeachers(): Promise<TeacherProfile[]> {
  const db = getAdminDb();
  if (!db) return [];
  const snap = await db.collection(COLLECTION).get();
  return snap.docs
    .map((doc) => toProfile(doc.id, doc.data()))
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

/** 회원 삭제(관리자). 프로필 문서를 지우고, Firebase Auth 계정도 best-effort 제거. */
export async function deleteTeacher(uid: string): Promise<boolean> {
  const db = getAdminDb();
  if (!db) return false;
  await db.collection(COLLECTION).doc(uid).delete();
  try {
    const auth = getAdminAuth();
    if (auth) await auth.deleteUser(uid);
  } catch {
    // Auth 사용자가 없거나 삭제 실패해도 프로필 삭제는 유지.
  }
  return true;
}
