import { extractNaeshinSpec, isConfigured } from "@/lib/naeshin/extract";
import { extractPageRange } from "@/lib/extract/split";
import { getSourceById } from "@/lib/sources/repository";
import { getAdminAuth, getAdminBucket } from "@/lib/firebase/admin";

// POST /api/pdf/[id]/naeshin — 요강의 내신 정량평가 페이지에서 산출 spec 추출.
// body: { page, endPage } (정량평가가 있는 페이지 범위 — 작업실 worklist의 환산점수
// 표에서 지정). 서버가 그 범위만 잘라 Claude로 파라미터 추출. 로그인 게이트.
// 추출 결과는 반드시 내신 검수 UI(/naeshin)로 역산·골든 검증 후 사용.

export const maxDuration = 120;

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
    page?: unknown;
    endPage?: unknown;
  } | null;
  const page = Number(body?.page);
  if (!Number.isFinite(page)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const start = Math.max(1, Math.floor(page));
  const endRaw = Number(body?.endPage);
  const end = Number.isFinite(endRaw) && endRaw >= start ? Math.floor(endRaw) : start;

  const source = await getSourceById(id);
  const bucket = getAdminBucket();
  if (!source || !source.originalPath || !bucket) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const [buf] = await bucket.file(source.originalPath).download();
    const sub = await extractPageRange(buf, start, end);
    const spec = await extractNaeshinSpec(sub.toString("base64"));
    if (!spec) return Response.json({ error: "extract_failed" }, { status: 502 });
    // 캘러(검수 UI)가 id·university·pattern·sourceId를 채워 NaeshinSpec 완성.
    return Response.json({
      ...spec,
      university: source.university,
      sourceId: source.id,
      pattern: "weighted_average",
    });
  } catch {
    return Response.json({ error: "extract_failed" }, { status: 502 });
  }
}
