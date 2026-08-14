import {
  deleteTeacher,
  isAdmin,
  normalizePhone,
  sanitizeProfileInput,
  updateTeacherProfile,
} from "@/lib/members/repository";
import { decodeBearer } from "@/lib/members/serverAuth";

// 회원 1명에 대한 관리자 동작.
//   PATCH  — 프로필 수정 (이름·학교급·학교명·지역 + 전화번호).
//   DELETE — 회원 삭제. 프로필 + Auth 계정 제거.
//
// 전화번호는 관리자도 고칠 수 있다(번호가 바뀐 회원 구제). 대신 본인 인증으로
// 들어온 값과 구분되게 phoneSource="admin"이 기록된다.
// email은 구글 로그인 정체성이라 수정하지 않는다.

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ uid: string }> },
) {
  const d = await decodeBearer(req);
  if (!d) return Response.json({ error: "auth_required" }, { status: 401 });
  if (!isAdmin(d.email)) return Response.json({ error: "forbidden" }, { status: 403 });

  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const input = sanitizeProfileInput(raw);
  if (!input) return Response.json({ error: "invalid_input" }, { status: 400 });

  // phone 키가 아예 없으면 번호는 건드리지 않는다(부분 수정 허용).
  let phone: string | undefined;
  if (raw && "phone" in raw) {
    const normalized = normalizePhone(raw.phone);
    if (normalized === null) {
      return Response.json({ error: "invalid_phone" }, { status: 400 });
    }
    phone = normalized;
  }

  const { uid } = await params;
  const profile = await updateTeacherProfile(uid, input, phone);
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
