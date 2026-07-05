import { getAdminAuth } from "@/lib/firebase/admin";
import { updateInfoFacets } from "@/lib/info/repository";

// PATCH /api/info/[id] — 교사가 AI 자동태깅을 보정(구분·학교급·대상학년 확정,
// reviewed:true). 사람 검토 단계라 로그인(Firebase ID 토큰) 필요.

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const adminAuth = getAdminAuth();
  if (!token || !adminAuth) {
    return Response.json({ error: "auth_required" }, { status: 401 });
  }
  try {
    await adminAuth.verifyIdToken(token);
  } catch {
    return Response.json({ error: "invalid_token" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const ok = await updateInfoFacets(id, {
    category: body.category,
    level: body.level,
    grade: body.grade,
  });
  if (!ok) {
    return Response.json({ error: "storage_unavailable" }, { status: 503 });
  }
  return Response.json({ ok: true });
}
