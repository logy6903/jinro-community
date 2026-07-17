import { answerLocal } from "@/lib/chat/local";
import { getSessionMember } from "@/lib/members/session";

// POST /api/chat — 저장된 데이터에서만 답하는 규칙기반 응답(LLM 없음).
// 질문을 키워드로 파싱해 매칭 행/자료를 그대로 반환한다. 생성이 없어 할루시네이션
// 불가 = closed-world. 유료 호출은 없지만 회원 전용 서비스라 세션 게이트를 둔다
// (페이지만 막고 API를 열어두면 데이터가 그대로 새어나감).

export async function POST(req: Request) {
  const member = await getSessionMember();
  if (!member) return Response.json({ error: "auth_required" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { question?: unknown } | null;
  const question =
    typeof body?.question === "string" ? body.question.trim().slice(0, 500) : "";
  if (!question) {
    return Response.json({ error: "empty_question" }, { status: 400 });
  }
  const result = await answerLocal(question);
  return Response.json(result);
}
