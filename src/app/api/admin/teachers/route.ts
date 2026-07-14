import { isAdmin, listTeachers } from "@/lib/members/repository";
import { decodeBearer } from "@/lib/members/serverAuth";

// GET /api/admin/teachers — 전체 회원 목록(관리자 전용).

export async function GET(req: Request) {
  const d = await decodeBearer(req);
  if (!d) return Response.json({ error: "auth_required" }, { status: 401 });
  if (!isAdmin(d.email)) return Response.json({ error: "forbidden" }, { status: 403 });
  const teachers = await listTeachers();
  return Response.json({ teachers });
}
