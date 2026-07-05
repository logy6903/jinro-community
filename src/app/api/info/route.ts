import { sanitizeInfoInput, upsertInfoItem } from "@/lib/info/repository";

// POST /api/info — kakao-daily가 생성 정보를 밀어넣는 수신 엔드포인트.
// 기계 간 호출이라 Firebase 토큰이 아니라 공유 시크릿(INFO_INGEST_SECRET)으로
// 인증한다. 단건 객체 또는 배열(여러 건) 모두 허용.

export async function POST(req: Request) {
  const expected = process.env.INFO_INGEST_SECRET;
  const provided = req.headers.get("x-ingest-secret");
  if (!expected || provided !== expected) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const items = Array.isArray(body) ? body : [body];
  if (items.length === 0) {
    return Response.json({ error: "empty" }, { status: 400 });
  }

  let upserted = 0;
  let invalid = 0;
  for (const raw of items) {
    const input = sanitizeInfoInput(raw);
    if (!input) {
      invalid++;
      continue;
    }
    if (await upsertInfoItem(input)) upserted++;
  }

  if (upserted === 0 && invalid > 0) {
    return Response.json({ error: "invalid_input", invalid }, { status: 400 });
  }
  return Response.json({ upserted, invalid, total: items.length });
}
