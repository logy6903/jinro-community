// 교사 회원(가입 프로필 + 승인 상태). 로그인 자체는 Google(부가 레이어)이고,
// 이 프로필이 "회원"의 실체 — 관리자 승인 후 기여(업로드·검수 등)를 허용한다.

export type MemberStatus = "pending" | "approved" | "rejected";
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
  status: MemberStatus;
  createdAt?: string;
  /** 승인/거절 처리 시각·처리자. */
  reviewedAt?: string;
  reviewedBy?: string;
}

/** 가입 폼이 보내는 값 (email/uid/status는 서버가 채움). */
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

export const MEMBER_STATUS_LABEL: Record<MemberStatus, string> = {
  pending: "승인 대기",
  approved: "승인됨",
  rejected: "거절됨",
};
