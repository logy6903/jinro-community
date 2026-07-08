import { isConfigured, mapTables } from "@/lib/extract/pdf";
import { getSourceById } from "@/lib/sources/repository";
import { getAdminAuth, getAdminBucket } from "@/lib/firebase/admin";

// POST /api/pdf/[id]/map — Pass 1: Storage의 요강 PDF → 표 지도.
// 서버가 원본을 받아(admin) mapTables 실행. Claude 유료 호출이라 로그인 게이트.
// on-demand(작업대에서 버튼). 89p 요강은 ~90초 → maxDuration 확장.

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
  const source = await getSourceById(id);
  const bucket = getAdminBucket();
  if (!source || !source.originalPath || !bucket) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const [buf] = await bucket.file(source.originalPath).download();
    const map = await mapTables(buf.toString("base64"));
    if (!map) return Response.json({ error: "map_failed" }, { status: 502 });
    return Response.json(map);
  } catch {
    return Response.json({ error: "map_failed" }, { status: 502 });
  }
}
