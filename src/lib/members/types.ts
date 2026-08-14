// 교사 회원(가입 프로필). 로그인 자체는 Google(부가 레이어)이고, 이 프로필이
// "회원"의 실체 — 가입은 즉시 완료되고, 문제 계정은 관리자가 삭제한다(사전 승인 없음).

export type MemberSchoolLevel = "middle" | "high";

export interface TeacherProfile {
  /** Firebase Auth uid (= 문서 id). */
  uid: string;
  /** Google 계정 이메일 (토큰에서). */
  email: string;
  /**
   * 전화번호(E.164, 예: +821012345678).
   *
   * 가입 시에는 검증된 토큰의 phone_number로만 채운다(본인 SMS 인증 = 오타·위조
   * 불가). 다만 번호가 바뀐 회원을 관리자가 고쳐줄 수 있어야 해서, 관리자 수정도
   * 허용한다. 어느 경로로 들어온 값인지는 phoneSource로 구분한다.
   */
  phone: string;
  /**
   * 번호의 출처. "verified" = 본인 SMS 인증(가입 시), "admin" = 관리자가 입력.
   * 없으면(legacy) 인증된 값으로 취급 — 관리자 수정 기능 이전 데이터라서.
   */
  phoneSource?: "verified" | "admin";
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
