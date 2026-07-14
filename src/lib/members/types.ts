// 교사 회원(가입 프로필). 로그인 자체는 Google(부가 레이어)이고, 이 프로필이
// "회원"의 실체 — 가입은 즉시 완료되고, 문제 계정은 관리자가 삭제한다(사전 승인 없음).

export type MemberSchoolLevel = "middle" | "high";

export interface TeacherProfile {
  /** Firebase Auth uid (= 문서 id). */
  uid: string;
  /** Google 계정 이메일 (토큰에서). */
  email: string;
  name: string;
  schoolLevel: MemberSchoolLevel;
  schoolName: string;
  /** 시·도 (아래 REGIONS 중 하나). */
  region: string;
  createdAt?: string;
}

/** 가입 폼이 보내는 값 (email/uid는 서버가 채움). */
export interface TeacherProfileInput {
  name: string;
  schoolLevel: MemberSchoolLevel;
  schoolName: string;
  region: string;
}

/** 시·도 17개 — 가입 폼 드롭다운. */
export const REGIONS = [
  "서울",
  "부산",
  "대구",
  "인천",
  "광주",
  "대전",
  "울산",
  "세종",
  "경기",
  "강원",
  "충북",
  "충남",
  "전북",
  "전남",
  "경북",
  "경남",
  "제주",
] as const;
