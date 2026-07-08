import { sanitizeDatasetInput, upsertDataset } from "@/lib/datasets/repository";
import { getAdminAuth } from "@/lib/firebase/admin";

// POST /api/datasets/compilation — 정리본(집계/검색 결과) 자동 저장(누가·언제).
// 필터 기반 고정 id로 upsert → 같은 정리를 다시 내보내면 갱신(중복 방지).
// 로그인 게이트: 작성자 귀속 필요.

function safeId(raw: unknown): string {
  const s = typeof raw === "string" ? raw : "";
  return "compilation-" + s.replace(/[^0-9a-z가-힣_-]/gi, "-").slice(0, 100);
}

export async function POST(req: Request) {
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const auth = getAdminAuth();
  if (!token || !auth) {
    return Response.json({ error: "auth_required" }, { status: 401 });
  }
  let uid: string;
  let name: string;
  try {
    const d = await auth.verifyIdToken(token);
    uid = d.uid;
    name = d.name ?? d.email ?? "익명";
  } catch {
    return Response.json({ error: "invalid_token" }, { status: 401 });
  }

  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const input = sanitizeDatasetInput(raw);
  if (!input) return Response.json({ error: "invalid_input" }, { status: 400 });

  const id = safeId(raw?.key);
  const saved = await upsertDataset(id, input, { uid, name });
  if (!saved) return Response.json({ error: "storage_unavailable" }, { status: 503 });
  return Response.json({ id: saved });
}
