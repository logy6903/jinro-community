import { extractTable, isConfigured } from "@/lib/extract/pdf";
import { getSourceById } from "@/lib/sources/repository";
import { getAdminAuth, getAdminBucket } from "@/lib/firebase/admin";

// POST /api/pdf/[id]/table — Pass 2: 지정 표 하나를 정밀 추출(정규화 롱포맷 + 조건).
// 서버가 Storage 원본을 받아 extractTable 실행. Claude 유료 호출이라 로그인 게이트.
// body: { title, page }.

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

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const uid = await requireUid(req);
  if (!uid) return Response.json({ error: "auth_required" }, { status: 401 });
  if (!isConfigured()) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    title?: unknown;
    page?: unknown;
  } | null;
  const title = typeof body?.title === "string" ? body.title.slice(0, 120) : "";
  const page = Number(body?.page);
  if (!Number.isFinite(page)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const source = await getSourceById(id);
  const bucket = getAdminBucket();
  if (!source || !source.originalPath || !bucket) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const [buf] = await bucket.file(source.originalPath).download();
    const table = await extractTable(buf.toString("base64"), {
      title,
      page: Math.max(1, Math.floor(page)),
    });
    if (!table) return Response.json({ error: "extract_failed" }, { status: 502 });
    return Response.json(table);
  } catch {
    return Response.json({ error: "extract_failed" }, { status: 502 });
  }
}
