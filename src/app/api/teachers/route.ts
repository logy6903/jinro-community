import { sanitizeProfileInput, upsertTeacherProfile } from "@/lib/members/repository";
import { decodeBearer } from "@/lib/members/serverAuth";

// POST /api/teachers — 회원 가입/프로필 수정. 본인 것만(uid는 토큰에서). 새 문서는
// 승인 대기(pending)로 생성. 로그인 게이트.

export async function POST(req: Request) {
  const d = await decodeBearer(req);
  if (!d) return Response.json({ error: "auth_required" }, { status: 401 });
  const input = sanitizeProfileInput(await req.json().catch(() => null));
  if (!input) return Response.json({ error: "invalid_input" }, { status: 400 });
  const profile = await upsertTeacherProfile(d.uid, d.email ?? "", input);
  if (!profile) return Response.json({ error: "storage_unavailable" }, { status: 503 });
  return Response.json({ profile });
}
