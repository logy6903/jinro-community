import { generateToday } from "@/lib/today/generate";
import { getAdminAuth } from "@/lib/firebase/admin";

// POST /api/today — generate today's lesson draft.
// LOGIN REQUIRED: every call runs a paid Claude generation, so this must not be
// an open public endpoint (cost-abuse). Verify a Firebase ID token first.

async function requireUid(req: Request): Promise<string | null> {
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const auth = getAdminAuth();
  if (!token || !auth) return null;
  try {
    return (await auth.verifyIdToken(token)).uid;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const uid = await requireUid(req);
  if (!uid) {
    return Response.json(
      { error: "auth_required", draft: "오늘의 수업은 로그인 후 이용할 수 있어요." },
      { status: 401 },
    );
  }

  const body = (await req.json().catch(() => null)) as { level?: unknown } | null;
  const level = body?.level === "high" ? "high" : "middle";
  const result = await generateToday(level);
  if (!result.configured) {
    return Response.json({
      ...result,
      draft: "수업 생성 기능이 아직 설정되지 않았어요. (관리자: 서버에 ANTHROPIC_API_KEY 필요)",
    });
  }
  return Response.json(result);
}
