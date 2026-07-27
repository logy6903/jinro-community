import { verifyRequestUser } from "@/lib/builder/auth";
import { hasTeacherProfile } from "@/lib/builder/teacherProfile";
import {
  generateItems,
  type SourceMaterial,
} from "@/lib/builder/questionGen";
import {
  FREE_AI_CREDITS,
  FREE_AI_USES,
  MAX_AI_MINUTES,
  getAiQuota,
  recordAiTranscript,
} from "@/lib/builder/aiQuota";
import type { AiModelTier, ContentType } from "@/lib/builder/types";

// POST /api/builder/generate-questions — draft-stage AI.
// Body: { materials, count?, model?, choiceCount?, instruction? }.
// The teacher selects which 제시 자료 to base the activity on and can add an
// extra instruction (e.g. "make a <보기> set"). Returns an ordered list of
// items — content blocks the AI generated + question fields — that the teacher
// edits. Teacher + profile gated; ≈free (1 call/app).

// 자막이 유료 폴백의 비동기 잡으로 넘어가면 최대 90초까지 기다린다(20분 넘는
// 영상). 그 뒤 Claude 호출까지 있으므로 기본 제한으로는 모자란다.
export const maxDuration = 180;

const MAX_MATERIALS = 8;
const TEXT_MAX = 12000;
const INSTRUCTION_MAX = 1000;
const CONTENT_TYPES: ContentType[] = [
  "text",
  "image",
  "pdf",
  "link",
  "office",
];

function sanitizeMaterials(raw: unknown): SourceMaterial[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
    .map((m) => {
      const contentType = CONTENT_TYPES.includes(m.contentType as ContentType)
        ? (m.contentType as ContentType)
        : "text";
      const value = typeof m.value === "string" ? m.value.slice(0, TEXT_MAX) : "";
      const label =
        typeof m.label === "string" ? m.label.trim().slice(0, 80) : undefined;
      return { contentType, value, label };
    })
    .filter((m) => m.value.trim() !== "")
    .slice(0, MAX_MATERIALS);
}

export async function POST(req: Request) {
  const user = await verifyRequestUser(req);
  if (!user) return Response.json({ error: "auth_required" }, { status: 401 });
  if (!(await hasTeacherProfile(user.uid))) {
    return Response.json({ error: "profile_required" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    materials?: unknown;
    count?: unknown;
    model?: unknown;
    choiceCount?: unknown;
    instruction?: unknown;
    allowAiTranscript?: unknown;
  } | null;

  const materials = sanitizeMaterials(body?.materials);
  if (materials.length === 0) {
    return Response.json({ error: "no_materials" }, { status: 400 });
  }
  const count = Math.min(
    10,
    Math.max(1, typeof body?.count === "number" ? Math.floor(body.count) : 4),
  );
  const choiceCount = Math.min(
    6,
    Math.max(
      2,
      typeof body?.choiceCount === "number" ? Math.floor(body.choiceCount) : 5,
    ),
  );
  const tier: AiModelTier = body?.model === "smart" ? "smart" : "fast";
  const instruction =
    typeof body?.instruction === "string"
      ? body.instruction.slice(0, INSTRUCTION_MAX)
      : undefined;

  // 자막 없는 영상의 AI 받아쓰기는 교사가 명시적으로 요청했을 때만.
  // 비용이 영상 길이에 비례하므로(1분당 2 크레딧) 무료 할당량을 확인한다.
  const wantsAi = body?.allowAiTranscript === true;
  const quota = await getAiQuota(user.uid);
  const allowAi = wantsAi && quota.allowed;

  const result = await generateItems(materials, {
    count,
    tier,
    choiceCount,
    instruction,
    transcript: allowAi
      ? {
          allowAi: true,
          aiCreditsLeft: Math.max(0, FREE_AI_CREDITS - quota.credits),
          maxAiMinutes: MAX_AI_MINUTES,
        }
      : { allowAi: false },
  });
  if (result === null) {
    return Response.json({ error: "ai_unavailable" }, { status: 503 });
  }

  // 실제로 받아쓴 영상 수만큼 차감한다. 크레딧은 자막 조회분까지 포함해
  // 누적하되, 받아쓰기를 한 번도 안 했으면 횟수는 건드리지 않는다.
  if (result.aiTranscripts > 0) {
    for (let i = 0; i < result.aiTranscripts; i++) {
      await recordAiTranscript(
        user.uid,
        Math.ceil(result.credits / result.aiTranscripts),
      );
    }
  }

  const after = await getAiQuota(user.uid);
  return Response.json({
    ...result,
    aiQuota: {
      usesLeft: after.usesLeft,
      freeUses: FREE_AI_USES,
      // 요청했는데 막힌 경우를 클라이언트가 구분할 수 있게.
      blocked: wantsAi && !quota.allowed,
    },
  });
}
