import { deleteTeacher, isAdmin } from "@/lib/members/repository";
import { decodeBearer } from "@/lib/members/serverAuth";

// DELETE /api/admin/teachers/[uid] — 회원 삭제(관리자 전용). 프로필 + Auth 계정 제거.

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ uid: string }> },
) {
  const d = await decodeBearer(req);
  if (!d) return Response.json({ error: "auth_required" }, { status: 401 });
  if (!isAdmin(d.email)) return Response.json({ error: "forbidden" }, { status: 403 });

  const { uid } = await params;
  const ok = await deleteTeacher(uid);
  if (!ok) return Response.json({ error: "storage_unavailable" }, { status: 503 });
  return Response.json({ ok: true });
}
