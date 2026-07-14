import { getTeacherProfile, isAdmin } from "@/lib/members/repository";
import { decodeBearer } from "@/lib/members/serverAuth";

// GET /api/teachers/me — 내 회원 프로필 + 승인 상태 + 관리자 여부. 로그인 게이트.

export async function GET(req: Request) {
  const d = await decodeBearer(req);
  if (!d) return Response.json({ error: "auth_required" }, { status: 401 });
  const profile = await getTeacherProfile(d.uid);
  return Response.json({ profile, admin: isAdmin(d.email) });
}
