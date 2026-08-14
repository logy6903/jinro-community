import crypto from "node:crypto";

/**
 * SMS 발송 유틸 (솔라피 / SOLAPI · 구 CoolSMS).
 * career_navigation의 검증된 구현을 "회원 다수 발송"용으로 일반화한 것.
 *
 * 필요한 환경변수 (서버 전용 — 클라이언트 노출 금지):
 *   SOLAPI_API_KEY     솔라피 API 키
 *   SOLAPI_API_SECRET  솔라피 API 시크릿
 *   SMS_SENDER         발신번호 (솔라피에 사전등록된 번호)
 *
 * 주의: 수신번호는 호출부가 "저장된 회원의 인증된 번호"에서만 만들어 넘긴다.
 * 클라이언트가 준 번호를 그대로 넘기면 임의 번호 발송 게이트웨이가 되므로 금지.
 */

const SOLAPI_ENDPOINT = "https://api.solapi.com/messages/v4/send-many/detail";

/** 한 번의 요청에 담을 최대 메시지 수 (부분 실패 파악·타임아웃 회피). */
const CHUNK = 300;

export const SMS_ENV_VARS = ["SOLAPI_API_KEY", "SOLAPI_API_SECRET", "SMS_SENDER"] as const;

/** 환경변수 존재 여부만 점검 (값은 절대 노출하지 않음). */
export function smsConfigStatus(): { configured: boolean; missing: string[] } {
  const missing = SMS_ENV_VARS.filter((n) => {
    const v = process.env[n];
    return !v || v.trim() === "";
  });
  return { configured: missing.length === 0, missing };
}

export function isSmsConfigured(): boolean {
  return smsConfigStatus().configured;
}

function onlyDigits(v: string): string {
  return v.replace(/[^0-9]/g, "");
}

/** E.164(+8210…)든 국내표기(010-…)든 솔라피가 받는 01012345678 형태로. */
export function toKrLocal(phone: string): string {
  const d = onlyDigits(phone);
  if (d.startsWith("82")) return "0" + d.slice(2);
  return d;
}

/**
 * 문자 길이(바이트) 추정 — 한글 2바이트(EUC-KR 기준).
 * 90바이트 이하 SMS, 초과 시 LMS로 자동 전환(솔라피가 판단).
 */
export function smsByteLength(text: string): number {
  let n = 0;
  for (const ch of text) n += ch.charCodeAt(0) > 127 ? 2 : 1;
  return n;
}

function authHeader(apiKey: string, apiSecret: string): string {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(32).toString("hex");
  const signature = crypto
    .createHmac("sha256", apiSecret)
    .update(date + salt)
    .digest("hex");
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

export interface SendResult {
  ok: boolean;
  /** 접수 성공 건수. */
  sent: number;
  /** 접수 실패 건수. */
  failed: number;
  error?: string;
}

/**
 * 여러 수신자에게 같은 내용을 발송. 번호는 정규화·중복 제거된다.
 * 청크 단위로 나눠 보내고, 중간 청크가 실패해도 앞의 성공 건수는 유지한다.
 */
export async function sendSmsToMany(
  phones: string[],
  text: string,
): Promise<SendResult> {
  if (!isSmsConfigured()) {
    return { ok: false, sent: 0, failed: 0, error: "SMS 미설정" };
  }
  const body = text.trim();
  if (!body) return { ok: false, sent: 0, failed: 0, error: "내용이 비어 있음" };

  const apiKey = process.env.SOLAPI_API_KEY!;
  const apiSecret = process.env.SOLAPI_API_SECRET!;
  const from = onlyDigits(process.env.SMS_SENDER!);

  const to = [...new Set(phones.map(toKrLocal).filter((p) => p.length >= 10))];
  if (to.length === 0) {
    return { ok: false, sent: 0, failed: 0, error: "보낼 수 있는 번호가 없음" };
  }

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < to.length; i += CHUNK) {
    const slice = to.slice(i, i + CHUNK);
    const messages = slice.map((t) => ({ to: t, from, text: body }));
    try {
      const res = await fetch(SOLAPI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader(apiKey, apiSecret),
        },
        body: JSON.stringify({ messages }),
      });
      const raw = await res.text();
      if (!res.ok) {
        failed += slice.length;
        // 첫 실패 사유만 돌려준다(응답 전문을 그대로 흘리지 않도록 잘라서).
        return {
          ok: sent > 0,
          sent,
          failed,
          error: `SMS ${res.status}: ${raw.slice(0, 200)}`,
        };
      }
      // 부분 실패는 failedMessageList로 온다.
      let chunkFailed = 0;
      try {
        const json = JSON.parse(raw) as { failedMessageList?: unknown[] };
        chunkFailed = Array.isArray(json.failedMessageList)
          ? json.failedMessageList.length
          : 0;
      } catch {
        // 파싱 실패는 성공으로 간주(HTTP 200).
      }
      sent += slice.length - chunkFailed;
      failed += chunkFailed;
    } catch (e) {
      failed += slice.length;
      return {
        ok: sent > 0,
        sent,
        failed,
        error: e instanceof Error ? e.message : "SMS 발송 오류",
      };
    }
  }

  return { ok: sent > 0, sent, failed };
}
