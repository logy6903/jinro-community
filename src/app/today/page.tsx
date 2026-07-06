"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getActivePeriods } from "@/lib/calendar/engine";
import type { SchoolLevel } from "@/lib/domain/types";
import { SCHOOL_LEVEL_LABEL } from "@/lib/domain/labels";

// "오늘의 수업" — 오늘 시기·힌트는 달력에서 즉시(무료), 수업 초안은 버튼으로 생성
// (Claude 호출 = 비용, 그래서 온디맨드). 초안은 교사가 다듬어 쓴다.

const LEVELS: SchoolLevel[] = ["middle", "high"];

interface TodayResult {
  period: string | null;
  hint: string | null;
  draft: string;
  usedCards?: string[];
}

export default function TodayPage() {
  const { user, signInWithGoogle } = useAuth();
  const [level, setLevel] = useState<SchoolLevel>("middle");
  const [result, setResult] = useState<TodayResult | null>(null);
  const [busy, setBusy] = useState(false);

  // 오늘 시기·힌트: 달력 엔진에서 즉시 계산 (LLM 불필요).
  const period = useMemo(() => getActivePeriods(level)[0], [level]);

  async function generate() {
    if (busy) return;
    if (!user) {
      await signInWithGoogle(); // 오늘수업은 로그인 필요 (비용 게이트)
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/today", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ level }),
      });
      setResult((await res.json()) as TodayResult);
    } catch {
      setResult({ period: null, hint: null, draft: "네트워크 오류가 발생했어요." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">오늘의 수업</h1>
        <p className="text-sm text-muted">
          오늘 시기에 맞는 수업 초안을 만들어드려요. 나온 초안은 다듬어서 쓰시면
          됩니다.
        </p>
      </div>

      <div className="inline-flex self-start rounded-full border border-border bg-card p-1">
        {LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => {
              setLevel(l);
              setResult(null);
            }}
            className={
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors " +
              (l === level ? "bg-brand text-white" : "text-muted")
            }
          >
            {SCHOOL_LEVEL_LABEL[l]}
          </button>
        ))}
      </div>

      {/* 오늘 시기 (즉시) */}
      <div className="rounded-2xl bg-brand-soft px-5 py-4">
        <p className="text-xs font-medium text-brand">오늘 · 지금 시기</p>
        <h2 className="mt-1 text-lg font-bold leading-snug">
          {period ? period.label : "상시 진로활동"}
        </h2>
        {period && (
          <p className="mt-1 text-sm leading-relaxed text-foreground/80">
            💡 {period.hint}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => void generate()}
        disabled={busy}
        className="self-start rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {busy
          ? "수업 초안 만드는 중…"
          : user
            ? "이 주제로 오늘 수업 초안 만들기"
            : "로그인하고 오늘 수업 초안 만들기"}
      </button>

      {result && (
        <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
          <p className="whitespace-pre-wrap text-[15px] leading-7">{result.draft}</p>
          {result.usedCards && result.usedCards.length > 0 && (
            <p className="border-t border-border pt-3 text-xs text-muted">
              참고한 활동 자료: {result.usedCards.join(", ")}
            </p>
          )}
          <p className="text-xs text-muted">
            ✍️ 이건 초안이에요. 우리 반에 맞게 자유롭게 고쳐 쓰세요.
          </p>
        </article>
      )}
    </div>
  );
}
