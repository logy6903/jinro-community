import { getSourceById } from "@/lib/sources/repository";
import { getAdminBucket } from "@/lib/firebase/admin";

// GET /api/pdf/[id] — 원본 PDF를 동일 출처로 스트림한다.
// 왜 프록시: pdf.js가 Firebase Storage URL을 직접 fetch하면 버킷 CORS 설정에
// 의존해 깨질 수 있음. 서버가 대신 받아(admin) 동일 출처로 넘기면 CORS 무관.

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const source = await getSourceById(id);
  const bucket = getAdminBucket();
  if (!source || !source.originalPath || !bucket) {
    return new Response("not found", { status: 404 });
  }

  try {
    const [buf] = await bucket.file(source.originalPath).download();
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("read failed", { status: 502 });
  }
}
