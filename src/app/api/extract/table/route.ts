import { extractTable, isConfigured } from "@/lib/extract/pdf";
import { getAdminAuth } from "@/lib/firebase/admin";

// POST /api/extract/table — Pass 2: 지정한 표 하나를 정밀 추출(정규화 롱포맷 + 조건).
// 로그인 필수 (Claude 유료 호출). 페이지 범위로 좁혀 표별 오염을 줄인다.

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

  const body = (await req.json().catch(() => null)) as {
    pdfBase64?: unknown;
    title?: unknown;
    page?: unknown;
  } | null;
  const pdfBase64 = typeof body?.pdfBase64 === "string" ? body.pdfBase64 : "";
  const title = typeof body?.title === "string" ? body.title.slice(0, 120) : "";
  const page = Number(body?.page);
  if (!pdfBase64 || !Number.isFinite(page)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    const table = await extractTable(pdfBase64, { title, page: Math.max(1, Math.floor(page)) });
    if (!table) {
      return Response.json({ error: "extract_failed" }, { status: 502 });
    }
    return Response.json(table);
  } catch {
    return Response.json({ error: "extract_failed" }, { status: 502 });
  }
}
