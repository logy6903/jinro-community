"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { TeacherProfile } from "@/lib/members/types";

// 회원 문자 발송 패널 (관리자 회원 관리 화면 안). 실제 발송·수신자 해석은 서버가
// 한다 — 여기선 uid만 보낸다(번호는 클라이언트가 만지지 않음).
//
// 요금이 나가는 외부 발송이라 UX 가드를 겹으로 둔다: 수신 인원 명시, 발송 전
// 확인창, 발송 중 잠금, 결과(성공/실패 건수) 표시.
//
// 바이트 계산은 서버 lib/sms.ts와 같은 규칙(한글 2바이트)이지만, 그 모듈은
// node:crypto를 쓰므로 클라이언트로 끌어오지 않고 여기서 따로 센다.

/** 한글 2바이트 기준 길이. 90바이트 이하 SMS, 초과 시 LMS. */
function byteLength(text: string): number {
  let n = 0;
  for (const ch of text) n += ch.charCodeAt(0) > 127 ? 2 : 1;
  return n;
}

interface Props {
  /** 현재 선택된 회원(번호 있는 사람만 실제 발송 대상이 된다). */
  selected: TeacherProfile[];
}

export function MemberSms({ selected }: Props) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [config, setConfig] = useState<{ configured: boolean; missing: string[] } | null>(
    null,
  );

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/admin/sms", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const d = (await res.json()) as { configured: boolean; missing: string[] };
        if (alive) setConfig(d);
      } catch {
        // 상태 조회 실패는 무시 — 발송 시도 시 서버가 다시 알려준다.
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  const targets = selected.filter((t) => t.phone);
  const bytes = byteLength(text);
  const kind = bytes > 90 ? "LMS" : "SMS";

  async function send() {
    if (!user || busy) return;
    if (targets.length === 0 || !text.trim()) return;

    const preview = text.trim().slice(0, 60);
    const ok = window.confirm(
      `${targets.length}명에게 ${kind} 문자를 보냅니다. (요금 발생)\n\n` +
        `내용: ${preview}${text.trim().length > 60 ? "…" : ""}\n\n보낼까요?`,
    );
    if (!ok) return;

    setBusy(true);
    setMsg(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/sms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text, uids: targets.map((t) => t.uid) }),
      });
      const d = (await res.json()) as {
        sent?: number;
        failed?: number;
        error?: string;
        warning?: string;
      };
      if (!res.ok) {
        setMsg(`발송 실패: ${d.error ?? res.status}`);
        return;
      }
      setMsg(
        `발송 완료 — 성공 ${d.sent ?? 0}건` +
          (d.failed ? `, 실패 ${d.failed}건` : "") +
          (d.warning ? ` (${d.warning})` : ""),
      );
      setText("");
    } catch {
      setMsg("네트워크 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">문자 보내기</h2>
        <span className="text-xs text-muted">
          선택 {selected.length}명 중 번호 있는 <b>{targets.length}명</b>에게 발송
        </span>
      </div>

      {config && !config.configured && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
          문자 발송이 아직 설정되지 않았어요. 서버 환경변수{" "}
          <code>{config.missing.join(", ")}</code> 를 채우면 발송할 수 있습니다.
          (솔라피 API 키·시크릿·사전등록 발신번호)
        </p>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        maxLength={2000}
        placeholder="회원들에게 보낼 문자 내용을 입력하세요."
        className="w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-brand"
      />

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-muted">
          {bytes}바이트 · <b>{kind}</b>
          {kind === "LMS" && " (90바이트 초과 — 장문 요금)"}
        </span>
        <button
          type="button"
          onClick={() => void send()}
          disabled={busy || targets.length === 0 || !text.trim()}
          className="ml-auto rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "보내는 중…" : `${targets.length}명에게 보내기`}
        </button>
      </div>

      {msg && <p className="text-xs text-foreground/80">{msg}</p>}
      <p className="text-[11px] leading-relaxed text-muted">
        SMS 인증을 마친 번호로만 발송됩니다. 수신 거부·야간 발송 등 정보통신망법
        규정을 지켜 사용하세요.
      </p>
    </div>
  );
}
