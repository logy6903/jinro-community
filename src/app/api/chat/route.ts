import { ask } from "@/lib/chat/answer";

// POST /api/chat — grounded Q&A over teacher-uploaded datasets.
// Public (reads only public data). Cost note: unauthenticated + LLM-backed, so
// a rate limit / auth gate is a near-term follow-up before wide release.

export async function POST(req: Request) {
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
