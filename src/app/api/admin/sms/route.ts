import { isAdmin, listTeachers } from "@/lib/members/repository";
import { decodeBearer } from "@/lib/members/serverAuth";
import { sendSmsToMany, smsByteLength, smsConfigStatus } from "@/lib/sms";

// 회원 문자 발송 (관리자 전용).
//
//   GET  /api/admin/sms  → 발송 설정 상태 + 번호 보유 회원 수 (UI 안내용)
//   POST /api/admin/sms  → 실제 발송. body: { text, uids?: string[], all?: boolean }
//
// 보안 원칙: 수신번호를 클라이언트에서 받지 않는다. uid 목록만 받고 서버가
// Firestore의 "SMS 인증된 회원 번호"로 해석한다 — 임의 번호로 문자를 쏘는
// 게이트웨이가 되지 않도록. 요금이 발생하는 외부 발송이라 관리자 게이트 필수.

const TEXT_MAX = 2000;

export async function GET(req: Request) {
  const d = await decodeBearer(req);
  if (!d) return Response.json({ error: "auth_required" }, { status: 401 });
  if (!isAdmin(d.email)) return Response.json({ error: "forbidden" }, { status: 403 });

  const status = smsConfigStatus();
  const teachers = await listTeachers();
  return Response.json({
    ...status,
    withPhone: teachers.filter((t) => t.phone).length,
    total: teachers.length,
  });
}

export async function POST(req: Request) {
  const d = await decodeBearer(req);
  if (!d) return Response.json({ error: "auth_required" }, { status: 401 });
  if (!isAdmin(d.email)) return Response.json({ error: "forbidden" }, { status: 403 });

  const raw = (await req.json().catch(() => null)) as {
    text?: unknown;
    uids?: unknown;
    all?: unknown;
  } | null;
  if (!raw) return Response.json({ error: "invalid_input" }, { status: 400 });

  const text = typeof raw.text === "string" ? raw.text.trim().slice(0, TEXT_MAX) : "";
  if (!text) return Response.json({ error: "empty_text" }, { status: 400 });

  const teachers = await listTeachers();

  // 수신자 결정: all이면 번호 있는 전 회원, 아니면 넘어온 uid에 해당하는 회원만.
  let targets = teachers.filter((t) => Boolean(t.phone));
  if (raw.all !== true) {
    const uids = Array.isArray(raw.uids)
      ? new Set(raw.uids.filter((u): u is string => typeof u === "string"))
      : new Set<string>();
    if (uids.size === 0) {
      return Response.json({ error: "no_recipients" }, { status: 400 });
    }
    targets = targets.filter((t) => uids.has(t.uid));
  }

  if (targets.length === 0) {
    return Response.json({ error: "no_recipients" }, { status: 400 });
  }

  const result = await sendSmsToMany(
    targets.map((t) => t.phone),
    text,
  );

  if (!result.ok && result.sent === 0) {
    return Response.json(
      { error: result.error ?? "send_failed", sent: 0, failed: result.failed },
      { status: 502 },
    );
  }
  return Response.json({
    sent: result.sent,
    failed: result.failed,
    bytes: smsByteLength(text),
    ...(result.error ? { warning: result.error } : {}),
  });
}
