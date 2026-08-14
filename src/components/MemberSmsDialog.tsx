"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { TeacherProfile } from "@/lib/members/types";

// 문자 보내기 창. [문자 보내기] 버튼을 누르면 열리고, 여기서 받는 사람을 고른 뒤
// 내용을 써서 보낸다. 실제 발송·수신자 해석은 서버가 한다 — 여기선 uid만 보낸다
// (번호는 클라이언트가 만지지 않음).
//
// 요금이 나가는 외부 발송이라 가드를 겹으로: 인원 명시 → 확인창 → 발송 중 잠금
// → 결과 건수 표시.

/** 한글 2바이트 기준 길이. 90바이트 이하 SMS, 초과 시 LMS. */
function byteLength(text: string): number {
  let n = 0;
  for (const ch of text) n += ch.charCodeAt(0) > 127 ? 2 : 1;
  return n;
}

function formatPhone(p: string): string {
  if (!p) return "";
  const kr = p.replace(/^\+82/, "0").replace(/[^0-9]/g, "");
  if (kr.length === 11) return `${kr.slice(0, 3)}-${kr.slice(3, 7)}-${kr.slice(7)}`;
  if (kr.length === 10) return `${kr.slice(0, 3)}-${kr.slice(3, 6)}-${kr.slice(6)}`;
  return p;
}

interface Props {
  /** 후보 목록(현재 화면의 필터 결과). 열 때 번호 있는 사람이 기본 선택된다. */
  teachers: TeacherProfile[];
  onClose: () => void;
}

export function MemberSmsDialog({ teachers, onClose }: Props) {
  const { user } = useAuth();

  /** 번호가 있어야 실제 발송 대상이 될 수 있다. */
  const sendable = useMemo(() => teachers.filter((t) => t.phone), [teachers]);

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(sendable.map((t) => t.uid)),
  );
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [config, setConfig] = useState<{ configured: boolean; missing: string[] } | null>(
    null,
  );

  const allRef = useRef<HTMLInputElement>(null);

  // 발송 설정 상태(어떤 환경변수가 비었는지) 조회 — 안내용.
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
        // 조회 실패는 무시 — 발송 시 서버가 다시 알려준다.
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  // ESC로 닫기.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const allChecked = sendable.length > 0 && selected.size === sendable.length;
  const someChecked = selected.size > 0 && !allChecked;

  // 부분 선택은 중간 상태(−)로 표시.
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = someChecked;
  }, [someChecked]);

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(sendable.map((t) => t.uid)) : new Set());
  }

  function toggleOne(uid: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(uid);
      else next.delete(uid);
      return next;
    });
  }

  const bytes = byteLength(text);
  const kind = bytes > 90 ? "LMS" : "SMS";
  const count = selected.size;

  async function send() {
    if (!user || busy || count === 0 || !text.trim()) return;
    const preview = text.trim().slice(0, 60);
    const ok = window.confirm(
      `${count}명에게 ${kind} 문자를 보냅니다. (요금 발생)\n\n` +
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
        body: JSON.stringify({ text, uids: [...selected] }),
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="문자 보내기"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">문자 보내기</h2>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-brand"
          >
            닫기
          </button>
        </div>

        {config && !config.configured && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
            문자 발송이 아직 설정되지 않았어요. 서버 환경변수{" "}
            <code>{config.missing.join(", ")}</code> 를 채우면 발송할 수 있습니다.
          </p>
        )}

        {/* 받는 사람 고르기 */}
        <div className="flex min-h-0 flex-col gap-2">
          <label className="flex items-center gap-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-medium text-brand">
            <input
              ref={allRef}
              type="checkbox"
              checked={allChecked}
              onChange={(e) => toggleAll(e.target.checked)}
              className="h-4 w-4"
            />
            전체 선택 ({sendable.length}명)
            <span className="ml-auto text-xs font-normal">{count}명 선택됨</span>
          </label>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border">
            {teachers.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted">
                받는 사람이 없습니다.
              </p>
            )}
            {teachers.map((t) => {
              const has = Boolean(t.phone);
              return (
                <label
                  key={t.uid}
                  className={
                    "flex items-center gap-2 border-b border-border px-3 py-2 text-sm last:border-b-0 " +
                    (has ? "hover:bg-brand-soft/40" : "opacity-50")
                  }
                >
                  <input
                    type="checkbox"
                    disabled={!has}
                    checked={selected.has(t.uid)}
                    onChange={(e) => toggleOne(t.uid, e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span className="font-medium">{t.name || "(이름 없음)"}</span>
                  <span className="text-xs text-muted">
                    {t.schoolLevel === "high" ? "고" : "중"} · {t.schoolName}
                    {t.region ? ` · ${t.region}` : ""}
                  </span>
                  <span className="ml-auto text-xs text-muted">
                    {has ? formatPhone(t.phone) : "번호 없음"}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* 내용 */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="보낼 문자 내용을 입력하세요."
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
            disabled={busy || count === 0 || !text.trim()}
            className="ml-auto rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "보내는 중…" : `${count}명에게 보내기`}
          </button>
        </div>

        {msg && <p className="text-xs text-foreground/80">{msg}</p>}
        <p className="text-[11px] leading-relaxed text-muted">
          SMS 인증을 마친 번호로만 발송됩니다. 수신 거부·야간 발송 등 정보통신망법
          규정을 지켜 사용하세요.
        </p>
      </div>
    </div>
  );
}
