import { extractPageRange } from "@/lib/extract/split";
import { getSourceById } from "@/lib/sources/repository";
import { getAdminBucket } from "@/lib/firebase/admin";

// GET /api/pdf/[id]/page?start=N&end=M — 원본 PDF에서 [start..end] 페이지만 잘라
// 다운로드시킨다. "출처를 밝히는 것"을 넘어 근거가 된 그 페이지를 그대로 손에 쥐게.
// 언로그인 공개(전체 원본 프록시 /api/pdf/[id]와 동일 정책 — 이미 토큰 URL로 공개된
// 자료의 부분집합일 뿐). Claude 호출 없음 → 게이트 불필요.

export const runtime = "nodejs";

function toPage(v: string | null, fallback: number): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 9999 ? n : fallback;
}

/** RFC 5987: 한글 파일명을 Content-Disposition에 안전하게. */
function contentDisposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  const start = toPage(url.searchParams.get("start"), 1);
  const end = toPage(url.searchParams.get("end"), start);

  const source = await getSourceById(id);
  const bucket = getAdminBucket();
  if (!source || !source.originalPath || !bucket) {
    return new Response("not found", { status: 404 });
  }

  try {
    const [buf] = await bucket.file(source.originalPath).download();
    const sub = await extractPageRange(buf, start, end);
    const range = end > start ? `${start}-${end}` : `${start}`;
    const filename = `${source.university}_${source.docType}_${source.admissionYear}_p${range}.pdf`;
    return new Response(new Uint8Array(sub), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition(filename),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("slice failed", { status: 502 });
  }
}
