import crypto from "node:crypto";
import { getAdminAuth } from "@/lib/firebase/admin";
import { uploadOriginal } from "@/lib/storage/originals";

// POST /api/materials/upload — 자료 공유 첨부 1개를 Storage에 올리고 {name,url}을
// 돌려준다. 폼은 이렇게 받은 URL만 /api/materials 본문에 실어 보내고, 서버는
// 그 URL이 우리 Storage 것인지 다시 확인한다(이중 방어). 로그인 필수.

export const runtime = "nodejs";

const MAX_BYTES = 15 * 1024 * 1024; // 15MB
const EXT_OK = /^[a-z0-9]{1,8}$/;

export async function POST(req: Request) {
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const auth = getAdminAuth();
  if (!token || !auth) {
    return Response.json({ error: "auth_required" }, { status: 401 });
  }
  try {
    await auth.verifyIdToken(token);
  } catch {
    return Response.json({ error: "invalid_token" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "no_file" }, { status: 400 });
  }
  if (file.size === 0) {
    return Response.json({ error: "empty_file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "too_large" }, { status: 413 });
  }

  const rawExt = (file.name.split(".").pop() ?? "").toLowerCase();
  const ext = EXT_OK.test(rawExt) ? rawExt : "bin";
  const id = `mat_${crypto.randomUUID()}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const stored = await uploadOriginal(id, buf, {
    ext,
    contentType: file.type || "application/octet-stream",
  });
  if (!stored) {
    return Response.json({ error: "storage_unavailable" }, { status: 503 });
  }

  return Response.json({ name: file.name.slice(0, 120), url: stored.url });
}
