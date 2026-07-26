"use client";

import { useState } from "react";
import type { Block, BuilderApp } from "@/lib/builder/types";
import { isMediaContent } from "@/lib/builder/embed";
import {
  ACTIVITY_BLEED,
  ACTIVITY_GRID,
  ACTIVITY_INNER,
  ContentBlockView,
  MaterialPane,
} from "@/components/builder/ContentBlockView";
import {
  StudentAuthGate,
  type StudentIdentity,
} from "@/components/builder/StudentAuthGate";

// The engine: renders any app's field config as a form and submits to the
// public /api/builder/submit endpoint. No login — the student just enters a
// name. If the app has student-visible AI blocks, their feedback is shown on
// the confirmation screen.

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-brand";

interface Feedback {
  title: string;
  text: string;
}

export function StudentForm({ app }: { app: BuilderApp }) {
  const [studentName, setStudentName] = useState("");
  const [studentNo, setStudentNo] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [identity, setIdentity] = useState<StudentIdentity | null>(null);

  const authRequired = app.rosterId !== "";
  const hasAi = app.aiBlocks.some((b) => b.showToStudent);

  function setAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  if (feedback !== null) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-6">
          <h1 className="text-lg font-bold">제출 완료 ✅</h1>
          <p className="text-sm text-muted">
            {(identity?.name ?? studentName)
              ? `${identity?.name ?? studentName} 학생, `
              : ""}
            응답이 잘 제출되었어요.
          </p>
        </div>
        {feedback.map((f, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-2xl border border-brand/40 bg-brand-soft p-5"
          >
            <span className="text-xs font-semibold text-brand">
              🤖 {f.title}
            </span>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {f.text}
            </p>
          </div>
        ))}
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/builder/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: app.code,
          studentName: identity ? identity.name : studentName,
          studentNo: identity ? identity.studentNo : studentNo,
          loginId: identity?.loginId,
          password: identity?.password,
          answers,
        }),
      });
      if (!res.ok) {
        setError("제출에 실패했어요. 필수 항목을 확인해 주세요.");
        return;
      }
      const data = (await res.json()) as { feedback?: Feedback[] };
      setFeedback(data.feedback ?? []);
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setBusy(false);
    }
  }

  const now = Date.now();
  const openMs = app.openAt ? new Date(app.openAt).getTime() : NaN;
  const closeMs = app.closeAt ? new Date(app.closeAt).getTime() : NaN;
  const notYet = !Number.isNaN(openMs) && now < openMs;
  const closed = !Number.isNaN(closeMs) && now > closeMs;
  if (notYet || closed) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-6">
        <h1 className="text-lg font-bold">{app.title}</h1>
        <p className="text-sm text-muted">
          {closed
            ? "제출이 마감되었어요."
            : `아직 제출 기간이 아니에요. (시작: ${app.openAt.replace("T", " ")})`}
        </p>
      </div>
    );
  }

  if (authRequired && !identity) {
    return (
      <StudentAuthGate
        appTitle={app.title}
        code={app.code}
        onAuthed={setIdentity}
      />
    );
  }

  // 자료(영상·문서·이미지)는 옆에 고정해 두고, 문항만 흐름에 남긴다. AI가 만든
  // <보기> 같은 텍스트 자료는 자기 문항 옆에 있어야 하므로 흐름에 그대로 둔다.
  const media = app.blocks.filter(isMediaContent);
  // Annotated: without it TS infers a negated type predicate and drops the
  // text content blocks (AI-generated <보기>) that must stay in the flow.
  const flow: Block[] = app.blocks.filter((b) => !isMediaContent(b));

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold leading-snug">{app.title}</h1>
        <p className="text-xs text-muted">
          아래 항목을 작성한 뒤 제출하세요.
          {hasAi && " 제출하면 AI 피드백을 받을 수 있어요."}
        </p>
        {app.closeAt && (
          <p className="text-xs text-muted">
            마감: {app.closeAt.replace("T", " ")}
          </p>
        )}
      </header>

      <div className={media.length > 0 ? ACTIVITY_BLEED : undefined}>
        <div
          className={
            media.length > 0 ? `${ACTIVITY_GRID} ${ACTIVITY_INNER}` : undefined
          }
        >
          <MaterialPane blocks={media} />

          <form onSubmit={onSubmit} className="flex flex-col gap-5">
          {identity ? (
            <p className="text-sm text-muted">
              <span className="font-semibold text-foreground">
                {identity.name}
              </span>{" "}
              ({identity.studentNo}) 님으로 참여 중
            </p>
          ) : (
            <div className="flex gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">학번</span>
                <input
                  value={studentNo}
                  onChange={(e) => setStudentNo(e.target.value)}
                  maxLength={20}
                  className={inputClass + " max-w-[8rem]"}
                />
              </label>
              <label className="flex flex-1 flex-col gap-1 text-sm">
                <span className="text-muted">이름</span>
                <input
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  maxLength={60}
                  className={inputClass}
                />
              </label>
            </div>
          )}

          {flow.map((b) =>
            b.kind === "content" ? (
              <ContentBlockView key={b.id} block={b} />
            ) : (
              <label key={b.id} className="flex flex-col gap-1 text-sm">
                <span className="text-muted">
                  {b.label}
                  {b.required && <span className="text-red-600"> *</span>}
                </span>
                {b.type === "long" ? (
                  <textarea
                    value={answers[b.id] ?? ""}
                    onChange={(e) => setAnswer(b.id, e.target.value)}
                    required={b.required}
                    rows={5}
                    className={inputClass + " resize-y"}
                  />
                ) : b.type === "choice" ? (
                  <select
                    value={answers[b.id] ?? ""}
                    onChange={(e) => setAnswer(b.id, e.target.value)}
                    required={b.required}
                    className={inputClass}
                  >
                    <option value="">선택하세요</option>
                    {(b.options ?? []).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={b.type === "number" ? "number" : "text"}
                    value={answers[b.id] ?? ""}
                    onChange={(e) => setAnswer(b.id, e.target.value)}
                    required={b.required}
                    className={inputClass}
                  />
                )}
              </label>
            ),
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="self-start rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? (hasAi ? "제출·채점 중…" : "제출 중…") : "제출하기"}
          </button>
          </form>
        </div>
      </div>
    </div>
  );
}
