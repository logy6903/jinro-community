import { isConfigured, mapTables } from "@/lib/extract/pdf";
import { getAdminAuth } from "@/lib/firebase/admin";

// POST /api/extract/map — Pass 1: 요강 PDF → 표 지도.
// 로그인 필수 (Claude 유료 호출 → 익명 공개 시 비용 남용). 채팅 라우트와 동일 게이트.
// 추출은 오래 걸릴 수 있어 maxDuration을 늘린다 (Vercel Pro).

export const maxDuration = 300;

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

export async function POST(req: Request) {
  const uid = await requireUid(req);
  if (!uid) {
    return Response.json({ error: "auth_required" }, { status: 401 });
  }
  if (!isConfigured()) {
    return Response.json({ error: "not_configured", configured: false }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as { pdfBase64?: unknown } | null;
  const pdfBase64 = typeof body?.pdfBase64 === "string" ? body.pdfBase64 : "";
  if (!pdfBase64) {
    return Response.json({ error: "empty_pdf" }, { status: 400 });
  }

  try {
    const map = await mapTables(pdfBase64);
    if (!map) {
      return Response.json({ error: "extract_failed" }, { status: 502 });
    }
    return Response.json(map);
  } catch {
    return Response.json({ error: "extract_failed" }, { status: 502 });
  }
}
