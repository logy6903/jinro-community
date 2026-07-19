"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { SCHOOL_LEVEL_LABEL } from "@/lib/domain/labels";
import type { SchoolLevel } from "@/lib/domain/types";
import {
  LESSON_FORMAT_LABEL,
  type LessonFormat,
  type LessonPlan,
  type LessonPlanInput,
} from "@/lib/lessons/types";

// 원자료 하나를 골라 "몇 차시로, 어떤 조건·바이브로" 입력하면 차시별 수업안
// 초안을 생성해 보여주는 클라이언트 패널. 생성은 로그인(교사)만 — idToken을
// Authorization 헤더로 보낸다(앱 공통 패턴). 저장·편집은 슬라이스2.

interface Source {
  id: string;
  title: string;
  schoolLevel: SchoolLevel;
}

const FORMAT_OPTIONS: LessonFormat[] = ["lecture", "group", "activity", "mixed"];

export function LessonPlanner({ source }: { source: Source }) {
  const { user, loading: authLoading, signInWithGoogle } = useAuth();

  const [numSessions, setNumSessions] = useState(3);
  const [schoolLevel, setSchoolLevel] = useState<SchoolLevel>(
    source.schoolLevel,
  );
  const [minutes, setMinutes] = useState<string>("");
  const [format, setFormat] = useState<LessonFormat | "">("");
  const [emphasis, setEmphasis] = useState("");
  const [notes, setNotes] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<LessonPlan | null>(null);

  async function generate() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const input: LessonPlanInput = {
        numSessions,
        schoolLevel,
        ...(minutes ? { minutesPerSession: Number(minutes) } : {}),
        ...(format ? { format } : {}),
        ...(emphasis.trim() ? { emphasis: emphasis.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      };
      const token = await user.getIdToken();
      const res = await fetch("/api/lessons/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sourceId: source.id, input }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(errorMessage(data.error));
        return;
      }
      const data = (await res.json()) as { plan: LessonPlan };
      setPlan(data.plan);
    } catch {
      setError("생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 입력 폼 */}
      <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6">
        <div>
          <h2 className="text-base font-semibold">차시별 수업안 만들기</h2>
          <p className="mt-1 text-sm text-muted">
            이 자료를 몇 차시로, 어떻게 다룰지 정하면 AI가 차시별 계획 초안을
            짜드립니다. 결과는 초안이니 확인하고 다듬어 쓰세요.
          </p>
        </div>

        {/* 필수: 차시 수 */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">
            몇 차시로 할까요? <span className="text-brand">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNumSessions(n)}
                className={
                  "h-9 w-9 rounded-full border text-sm transition-colors " +
                  (numSessions === n
                    ? "border-brand bg-brand text-white"
                    : "border-border text-muted hover:border-brand")
                }
              >
                {n}
              </button>
            ))}
            <input
              type="number"
              min={1}
              max={20}
              value={numSessions}
              onChange={(e) =>
                setNumSessions(Math.max(1, Number(e.target.value) || 1))
              }
              className="h-9 w-16 rounded-lg border border-border bg-background px-2 text-center text-sm"
            />
            <span className="self-center text-sm text-muted">차시</span>
          </div>
        </div>

        {/* 선택 노브 */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-muted">학교급</label>
            <div className="flex gap-2">
              {(["middle", "high"] as SchoolLevel[]).map((lv) => (
                <button
                  key={lv}
                  type="button"
                  onClick={() => setSchoolLevel(lv)}
                  className={
                    "rounded-full border px-3 py-1.5 text-sm transition-colors " +
                    (schoolLevel === lv
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-border text-muted hover:border-brand")
                  }
                >
                  {SCHOOL_LEVEL_LABEL[lv]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-muted">
              차시당 시간 (분)
            </label>
            <input
              type="number"
              min={10}
              max={120}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="기본값"
              className="h-9 w-28 rounded-lg border border-border bg-background px-3 text-sm"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-muted">수업 형태</label>
            <div className="flex flex-wrap gap-2">
              {FORMAT_OPTIONS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat((cur) => (cur === f ? "" : f))}
                  className={
                    "rounded-full border px-3 py-1.5 text-sm transition-colors " +
                    (format === f
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-border text-muted hover:border-brand")
                  }
                >
                  {LESSON_FORMAT_LABEL[f]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-muted">강조할 목표</label>
            <input
              type="text"
              value={emphasis}
              onChange={(e) => setEmphasis(e.target.value)}
              placeholder="예: 자기이해보다 직업탐색에 무게"
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
            />
          </div>
        </div>

        {/* 자유 입력(바이브) */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">
            이렇게 해주세요{" "}
            <span className="font-normal text-muted">
              — 추가·강조하고 싶은 것을 자유롭게
            </span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="예) 우리 반은 발표를 어려워하니 글쓰기 위주로. 마지막 차시에 학생부 연결 활동 하나 꼭 넣어줘."
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed"
          />
        </div>

        {/* 생성 버튼 / 로그인 안내 */}
        {user ? (
          <button
            type="button"
            onClick={() => void generate()}
            disabled={busy}
            className="self-start rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy
              ? "AI가 수업안을 짜는 중…"
              : plan
                ? "다시 생성"
                : "차시별 수업안 생성"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            disabled={authLoading}
            className="self-start rounded-full border border-border px-5 py-2 text-sm font-medium hover:border-brand disabled:opacity-50"
          >
            로그인하고 생성하기
          </button>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {/* 결과 */}
      {plan && <PlanResult plan={plan} />}
    </div>
  );
}

function PlanResult({ plan }: { plan: LessonPlan }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold">
          {plan.sessions.length}차시 수업안 (초안)
        </h2>
        <span className="text-xs text-muted">AI 생성 · 검수 후 사용</span>
      </div>

      {plan.overview && (
        <p className="rounded-2xl border border-border bg-brand-soft/40 p-4 text-sm leading-relaxed">
          {plan.overview}
        </p>
      )}

      <ol className="flex flex-col gap-3">
        {plan.sessions.map((s) => (
          <li
            key={s.order}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">
                <span className="mr-2 rounded-full bg-brand px-2 py-0.5 text-xs text-white">
                  {s.order}차시
                </span>
                {s.title}
              </h3>
              <span className="shrink-0 text-xs text-muted">{s.minutes}분</span>
            </div>

            {s.objectives.length > 0 && (
              <Section label="학습목표">
                <ul className="list-disc pl-5">
                  {s.objectives.map((o, i) => (
                    <li key={i}>{o}</li>
                  ))}
                </ul>
              </Section>
            )}

            {s.steps.length > 0 && (
              <Section label="활동 단계">
                <ol className="list-decimal pl-5">
                  {s.steps.map((st, i) => (
                    <li key={i} className="mb-0.5">
                      {st}
                    </li>
                  ))}
                </ol>
              </Section>
            )}

            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {s.materials.length > 0 && (
                <Section label="준비물">
                  <span>{s.materials.join(", ")}</span>
                </Section>
              )}
              {s.reflection && (
                <Section label="마무리·성찰">
                  <span>{s.reflection}</span>
                </Section>
              )}
            </div>
          </li>
        ))}
      </ol>

      <p className="border-t border-border pt-4 text-xs leading-relaxed text-muted">
        이 수업안은 AI가 원자료를 바탕으로 만든 초안입니다. 반 상황에 맞게
        확인·수정해 사용하세요. (저장·차시별 학생 활동 연결은 준비 중)
      </p>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="text-sm leading-relaxed">
      <span className="mr-1 text-xs font-semibold text-muted">{label}</span>
      <div className="mt-0.5 text-foreground">{children}</div>
    </div>
  );
}

function errorMessage(code: string | undefined): string {
  switch (code) {
    case "ai_unconfigured":
      return "AI 생성 기능이 아직 설정되지 않았습니다(관리자 확인 필요).";
    case "auth_required":
    case "invalid_token":
      return "로그인이 필요합니다. 다시 로그인해 주세요.";
    case "source_not_found":
      return "원자료를 찾을 수 없습니다.";
    case "generation_failed":
      return "AI가 수업안을 만들지 못했습니다. 조건을 바꿔 다시 시도해 보세요.";
    default:
      return "생성에 실패했습니다. 잠시 후 다시 시도해 주세요.";
  }
}
