import { cookies } from "next/headers";
import { getAdminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE } from "@/lib/members/session";

// POST /api/session — 로그인 직후 클라이언트가 idToken을 보내면 서버가 검증해
// httpOnly 세션 쿠키를 굽는다. 이 쿠키로 서버렌더 페이지·콘텐츠 API가 회원을 판정.
// DELETE — 로그아웃 시 쿠키 제거.
//
// 이 라우트 자체는 로그인 전에 호출되므로 게이트 없음(idToken 검증이 곧 인증).

const EXPIRES_IN_MS = 14 * 24 * 60 * 60 * 1000; // 14일

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { idToken?: unknown } | null;
  const idToken = typeof body?.idToken === "string" ? body.idToken : null;
  const auth = getAdminAuth();
  if (!idToken || !auth) {
    return Response.json({ error: "auth_required" }, { status: 401 });
  }
  try {
    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: EXPIRES_IN_MS,
    });
    const store = await cookies();
    store.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: EXPIRES_IN_MS / 1000,
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "invalid_token" }, { status: 401 });
  }
}

export async function DELETE() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
