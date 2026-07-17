import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminAuth } from "../firebase/admin";
import { getTeacherProfile } from "./repository";
import type { TeacherProfile } from "./types";

// 서버에서 "지금 요청자가 회원인가"를 판정한다. Firebase는 클라이언트 인증이라
// 서버가 사용자를 알려면 세션 쿠키가 필요 — 로그인 시 /api/session이 발급한다.
// 서버렌더 페이지는 데이터를 HTML에 담아 내려보내므로, 클라이언트 가림막이 아니라
// 여기(서버)에서 막아야 실제로 차단된다.

export const SESSION_COOKIE = "session";

/** 세션 쿠키 검증 → 회원 프로필. 비로그인/미가입/만료면 null. */
export async function getSessionMember(): Promise<TeacherProfile | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const auth = getAdminAuth();
  if (!token || !auth) return null;
  try {
    // checkRevoked=true — 계정 삭제/토큰 폐기 시 즉시 차단.
    const decoded = await auth.verifySessionCookie(token, true);
    return await getTeacherProfile(decoded.uid);
  } catch {
    return null;
  }
}

/** 회원 전용 페이지 가드. 비회원이면 /signup으로 보내고 페이지를 렌더하지 않는다. */
export async function requireMember(): Promise<TeacherProfile> {
  const member = await getSessionMember();
  if (!member) redirect("/signup");
  return member;
}
