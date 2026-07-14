import { isAdmin, listTeachers } from "@/lib/members/repository";
import { decodeBearer } from "@/lib/members/serverAuth";
import type { MemberStatus } from "@/lib/members/types";

// GET /api/admin/teachers?status=pending — 회원 목록(관리자 전용).

const STATUSES: MemberStatus[] = ["pending", "approved", "rejected"];

export async function GET(req: Request) {
  const d = await decodeBearer(req);
  if (!d) return Response.json({ error: "auth_required" }, { status: 401 });
  if (!isAdmin(d.email)) return Response.json({ error: "forbidden" }, { status: 403 });

  const raw = new URL(req.url).searchParams.get("status");
  const status = STATUSES.includes(raw as MemberStatus) ? (raw as MemberStatus) : undefined;
  const teachers = await listTeachers(status);
  return Response.json({ teachers });
}
