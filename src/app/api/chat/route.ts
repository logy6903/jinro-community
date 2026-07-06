import { ask } from "@/lib/chat/answer";
import { getAdminAuth } from "@/lib/firebase/admin";

// POST /api/chat — grounded Q&A over teacher-uploaded datasets.
// LOGIN REQUIRED: this endpoint calls Claude (paid), so an anonymous public
// endpoint is a cost-abuse vector. Verify a Firebase ID token before answering.
// Reading the underlying data stays public; only the LLM call is gated.

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
      { error: "auth_required", answer: "챗봇은 로그인 후 이용할 수 있어요.", sources: [] },
      { status: 401 },
    );
  }

  const body = (await req.json().catch(() => null)) as { question?: unknown } | null;
  const question =
    typeof body?.question === "string" ? body.question.trim().slice(0, 500) : "";
  if (!question) {
    return Response.json({ error: "empty_question" }, { status: 400 });
  }

  const result = await ask(question);
  if (!result.configured) {
    return Response.json({
      answer: "챗봇이 아직 설정되지 않았어요. (관리자: 서버에 ANTHROPIC_API_KEY 필요)",
      sources: [],
      configured: false,
    });
  }
  return Response.json(result);
}
