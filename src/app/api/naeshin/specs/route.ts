import { saveSpec } from "@/lib/naeshin/repository";
import { getAdminAuth } from "@/lib/firebase/admin";
import type { GroupSpec, NaeshinSpec } from "@/lib/naeshin/types";

// POST /api/naeshin/specs — 검수한 내신 spec 저장(upsert). 로그인 게이트(기여).
// 검수자가 요강과 대조해 확정한 파라미터를 저장한다.

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

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function POST(req: Request) {
  const uid = await requireUid(req);
  if (!uid) return Response.json({ error: "auth_required" }, { status: 401 });

  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof b?.id === "string" ? b.id.trim().slice(0, 120) : "";
  const rawGroups = Array.isArray(b?.groups) ? b.groups : [];
  if (!id || rawGroups.length === 0) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  const groups: GroupSpec[] = rawGroups.slice(0, 6).map((g) => {
    const o = (g ?? {}) as Record<string, unknown>;
    const gs = Array.isArray(o.gradeScore) ? o.gradeScore.slice(0, 9).map(num) : [];
    while (gs.length < 9) gs.push(0);
    return {
      key: typeof o.key === "string" ? o.key.slice(0, 8) : "?",
      name: typeof o.name === "string" ? o.name.slice(0, 200) : "",
      gradeScore: gs,
      reflectRatio: num(o.reflectRatio),
    };
  });

  const spec: NaeshinSpec = {
    id,
    university: typeof b?.university === "string" ? b.university.slice(0, 60) : "",
    track: typeof b?.track === "string" ? b.track.slice(0, 80) : "",
    pattern: "weighted_average",
    groups,
    maxScore: num(b?.maxScore),
    sourceId: typeof b?.sourceId === "string" ? b.sourceId : undefined,
  };

  const saved = await saveSpec(spec);
  if (!saved) return Response.json({ error: "storage_unavailable" }, { status: 503 });
  return Response.json({ id: saved });
}
