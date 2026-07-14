import { isAdmin, setTeacherStatus } from "@/lib/members/repository";
import { decodeBearer } from "@/lib/members/serverAuth";
import type { MemberStatus } from "@/lib/members/types";

// POST /api/admin/teachers/[uid] — 승인/거절(관리자 전용). body: { status }.

const STATUSES: MemberStatus[] = ["pending", "approved", "rejected"];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ uid: string }> },
) {
  const d = await decodeBearer(req);
  if (!d) return Response.json({ error: "auth_required" }, { status: 401 });
  if (!isAdmin(d.email)) return Response.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { status?: unknown } | null;
  const status = body?.status;
  if (!STATUSES.includes(status as MemberStatus)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const { uid } = await params;
  const ok = await setTeacherStatus(uid, status as MemberStatus, d.email ?? d.uid);
  if (!ok) return Response.json({ error: "storage_unavailable" }, { status: 503 });
  return Response.json({ ok: true });
}
