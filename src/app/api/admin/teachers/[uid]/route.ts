import {
  deleteTeacher,
  isAdmin,
  sanitizeProfileInput,
  updateTeacherProfile,
} from "@/lib/members/repository";
import { decodeBearer } from "@/lib/members/serverAuth";

// 회원 1명에 대한 관리자 동작.
//   PATCH  — 프로필 수정 (이름·학교급·학교명·지역).
//   DELETE — 회원 삭제. 프로필 + Auth 계정 제거.
//
// email(구글 계정)·phone(SMS 인증)은 검증된 값이라 수정 대상에서 제외한다.

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ uid: string }> },
) {
  const d = await decodeBearer(req);
  if (!d) return Response.json({ error: "auth_required" }, { status: 401 });
  if (!isAdmin(d.email)) return Response.json({ error: "forbidden" }, { status: 403 });

  const input = sanitizeProfileInput(await req.json().catch(() => null));
  if (!input) return Response.json({ error: "invalid_input" }, { status: 400 });

  const { uid } = await params;
  const profile = await updateTeacherProfile(uid, input);
  if (!profile) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ profile });
}

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
