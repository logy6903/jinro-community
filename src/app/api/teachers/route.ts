import { sanitizeProfileInput, upsertTeacherProfile } from "@/lib/members/repository";
import { decodeBearer } from "@/lib/members/serverAuth";

// POST /api/teachers — 회원 가입/프로필 수정. 본인 것만(uid는 토큰에서).
//
// 전화번호는 폼 입력을 믿지 않는다: SMS 인증(Firebase Phone Auth)으로 계정에
// 연결된 뒤 토큰에 실리는 phone_number만 저장한다. 그래서 오타·위조가 불가능하고,
// 인증을 마치지 않으면 애초에 가입이 성립하지 않는다.

export async function POST(req: Request) {
  const d = await decodeBearer(req);
  if (!d) return Response.json({ error: "auth_required" }, { status: 401 });

  const phone = typeof d.phone_number === "string" ? d.phone_number : "";
  if (!phone) {
    return Response.json({ error: "phone_required" }, { status: 400 });
  }

  const input = sanitizeProfileInput(await req.json().catch(() => null));
  if (!input) return Response.json({ error: "invalid_input" }, { status: 400 });

  const profile = await upsertTeacherProfile(d.uid, d.email ?? "", phone, input);
  if (!profile) return Response.json({ error: "storage_unavailable" }, { status: 503 });
  return Response.json({ profile });
}
