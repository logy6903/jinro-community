import { listDatasetsBySource } from "@/lib/datasets/repository";
import { getAdminAuth } from "@/lib/firebase/admin";

// GET /api/pdf/[id]/drafts — 이 소스(요강)에서 배치로 뽑아둔 데이터셋 전체(행 포함).
// 검수 워크벤치가 "저장본 로드"로 불러온다. 미검수 draft가 섞여 있어 로그인 게이트.

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params;
  const datasets = await listDatasetsBySource(id);
  return Response.json({ datasets });
}
