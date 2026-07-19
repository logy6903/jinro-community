import { isAiConfigured } from "@/lib/builder/anthropic";
import { getCardById } from "@/lib/content/repository";
import { getAdminAuth } from "@/lib/firebase/admin";
import { generateLessonPlan } from "@/lib/lessons/generate";
import type { LessonPlanInput } from "@/lib/lessons/types";

// POST /api/lessons/generate — 공유 자료(슬라이스1: ContentCard) + 교사 입력으로
// 차시별 수업안 초안을 생성한다. AI 호출 비용이 있으므로 로그인(교사)만 허용.
// 결과는 저장하지 않고 즉시 반환한다(저장·검수는 슬라이스2).

export const maxDuration = 60; // Opus 생성이 길어질 수 있어 여유.

const MAX_SESSIONS = 20;

export async function POST(req: Request) {
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const auth = getAdminAuth();
  if (!token || !auth) {
    return Response.json({ error: "auth_required" }, { status: 401 });
  }
  try {
    await auth.verifyIdToken(token);
  } catch {
    return Response.json({ error: "invalid_token" }, { status: 401 });
  }

  if (!isAiConfigured()) {
    return Response.json({ error: "ai_unconfigured" }, { status: 503 });
  }

  let body: { sourceId?: string; input?: LessonPlanInput };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }

  const sourceId = body.sourceId;
  const input = body.input;
  if (
    !sourceId ||
    !input ||
    typeof input.numSessions !== "number" ||
    !Number.isFinite(input.numSessions) ||
    input.numSessions < 1
  ) {
    return Response.json({ error: "bad_input" }, { status: 400 });
  }

  const numSessions = Math.min(
    MAX_SESSIONS,
    Math.max(1, Math.floor(input.numSessions)),
  );

  const card = await getCardById(sourceId);
  if (!card) {
    return Response.json({ error: "source_not_found" }, { status: 404 });
  }

  const plan = await generateLessonPlan(
    {
      id: card.id,
      title: card.title,
      body: card.body,
      schoolLevel: card.schoolLevel,
    },
    { ...input, numSessions },
  );
  if (!plan) {
    return Response.json({ error: "generation_failed" }, { status: 502 });
  }

  return Response.json({ plan });
}
