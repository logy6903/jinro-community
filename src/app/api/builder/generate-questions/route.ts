import { verifyRequestUser } from "@/lib/builder/auth";
import { hasTeacherProfile } from "@/lib/builder/teacherProfile";
import {
  generateQuestions,
  type SourceMaterial,
} from "@/lib/builder/questionGen";
import type { AiModelTier, ContentType } from "@/lib/builder/types";

// POST /api/builder/generate-questions — draft-stage AI.
// Body: { materials: [{contentType, value, label?}], count?, model? }.
// The teacher selects which 제시 자료 to base questions on; this reads them
// (text/image/PDF) and returns suggested question drafts the teacher edits.
// Teacher + profile gated (same as other write/AI routes); ≈free (1 call/app).

const MAX_MATERIALS = 8;
const TEXT_MAX = 12000;
const CONTENT_TYPES: ContentType[] = ["text", "image", "pdf", "link"];

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
  } | null;

  const materials = sanitizeMaterials(body?.materials);
  if (materials.length === 0) {
    return Response.json({ error: "no_materials" }, { status: 400 });
  }
  const count = Math.min(
    10,
    Math.max(1, typeof body?.count === "number" ? Math.floor(body.count) : 4),
  );
  const tier: AiModelTier = body?.model === "smart" ? "smart" : "fast";

  const questions = await generateQuestions(materials, count, tier);
  if (questions === null) {
    return Response.json({ error: "ai_unavailable" }, { status: 503 });
  }
  return Response.json({ questions });
}
