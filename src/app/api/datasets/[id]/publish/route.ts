import { publishDataset, sanitizeDatasetInput } from "@/lib/datasets/repository";
import { getAdminAuth } from "@/lib/firebase/admin";

// POST /api/datasets/[id]/publish — 검수 완료 → 공개. 검수자가 고친 내용(열/행/태그)을
// 함께 반영하고 status를 published로 올린다. 검수자(reviewedBy)는 토큰에서. 로그인 게이트.

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const auth = getAdminAuth();
  if (!token || !auth) {
    return Response.json({ error: "auth_required" }, { status: 401 });
  }
  let name: string;
  try {
    const d = await auth.verifyIdToken(token);
    name = d.name ?? d.email ?? "익명";
  } catch {
    return Response.json({ error: "invalid_token" }, { status: 401 });
  }

  const input = sanitizeDatasetInput(await req.json().catch(() => null));
  if (!input) return Response.json({ error: "invalid_input" }, { status: 400 });

  const { id } = await params;
  const ok = await publishDataset(id, input, { name });
  if (!ok) return Response.json({ error: "storage_unavailable" }, { status: 503 });
  return Response.json({ ok: true });
}
