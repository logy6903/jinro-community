"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { BuilderApp, RecordSlotSource } from "@/lib/builder/types";
import { neisByteLength } from "@/lib/builder/bytes";

// 생활기록부 bulk generation, template-based + two-phase:
//   1. teacher composes output slots (태도=교사, 활동요약=AI, 평가=교사)
//   2. "① 초안 생성" fills AI slots from each student's activity
//   3. teacher fills 판단 slots (태도·평가) in the grid
//   4. "② 생기부 종합" weaves each student's slots into one paragraph
//   5. edit → CSV. Model is Haiku (free tier).

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-brand";
const BYTE_LIMIT = 1500;

function rid() {
  return Math.random().toString(36).slice(2);
}

interface SlotDraft {
  id: string;
  label: string;
  source: RecordSlotSource;
  instruction: string;
}

interface Row {
  studentName: string;
  studentNo: string;
  values: Record<string, string>; // keyed by slot id
  final: string;
}

function defaultSlots(): SlotDraft[] {
  return [
    { id: rid(), label: "태도", source: "teacher", instruction: "" },
    {
      id: rid(),
      label: "활동 요약",
      source: "ai",
      instruction: "학생이 수행한 활동과 배운 점, 성장한 부분을 사실 위주로 요약",
    },
    { id: rid(), label: "평가", source: "teacher", instruction: "" },
  ];
}

export function RecordMaker() {
  const { user, loading, signInWithGoogle } = useAuth();

  const [apps, setApps] = useState<BuilderApp[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterYear, setFilterYear] = useState<number>(0);
  const [filterSem, setFilterSem] = useState<number>(0);
  const [slots, setSlots] = useState<SlotDraft[]>(defaultSlots());
  const [instruction, setInstruction] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [composing, setComposing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadApps = useCallback(async () => {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch("/api/builder/apps", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = (await res.json()) as { apps: BuilderApp[] };
      setApps(data.apps);
    }
  }, [user]);

  useEffect(() => {
    void loadApps();
  }, [loadApps]);

  function toggleApp(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function updateSlot(id: string, patch: Partial<SlotDraft>) {
    setSlots((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function removeSlot(id: string) {
    setSlots((ss) => (ss.length > 1 ? ss.filter((s) => s.id !== id) : ss));
  }
  function updateValue(rowIdx: number, slotId: string, value: string) {
    setRows((prev) =>
      prev
        ? prev.map((r, i) =>
            i === rowIdx ? { ...r, values: { ...r.values, [slotId]: value } } : r,
          )
        : prev,
    );
  }
  function updateFinal(rowIdx: number, value: string) {
    setRows((prev) =>
      prev ? prev.map((r, i) => (i === rowIdx ? { ...r, final: value } : r)) : prev,
    );
  }

  async function onGenerate() {
    if (generating || !user || selected.size === 0) return;
    setGenerating(true);
    setError(null);
    setRows(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/builder/records", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ appIds: [...selected], slots }),
      });
      if (res.status === 503) {
        setError("AI가 설정되지 않았어요 (.env.local 의 ANTHROPIC_API_KEY 확인).");
        return;
      }
      if (!res.ok) {
        setError("생성에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      const data = (await res.json()) as {
        rows: {
          studentName: string;
          studentNo?: string;
          ai: Record<string, string>;
        }[];
      };
      setRows(
        data.rows.map((r) => ({
          studentName: r.studentName,
          studentNo: r.studentNo ?? "",
          values: { ...r.ai }, // AI slots filled; teacher slots stay undefined→""
          final: "",
        })),
      );
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setGenerating(false);
    }
  }

  async function onCompose() {
    if (composing || !user || !rows || rows.length === 0) return;
    setComposing(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const students = rows.map((r) => ({
        studentName: r.studentName,
        parts: slots.map((s) => ({ label: s.label, value: r.values[s.id] ?? "" })),
      }));
      const res = await fetch("/api/builder/records/compose", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ students, instruction }),
      });
      if (res.status === 503) {
        setError("AI가 설정되지 않았어요 (.env.local 의 ANTHROPIC_API_KEY 확인).");
        return;
      }
      if (!res.ok) {
        setError("종합에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      const data = (await res.json()) as {
        records: { studentName: string; text: string }[];
      };
      // compose preserves input order (row order), so map back by index — robust
      // against students who share a display name.
      setRows((prev) =>
        prev
          ? prev.map((r, i) => ({ ...r, final: data.records[i]?.text ?? r.final }))
          : prev,
      );
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setComposing(false);
    }
  }

  function downloadCsv() {
    if (!rows) return;
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const headers = [
      "학번",
      "학생명",
      ...slots.map((s) => s.label),
      "최종 생기부",
      "바이트",
    ];
    const lines = [headers.map(esc).join(",")];
    for (const r of rows) {
      const cells = [
        r.studentNo,
        r.studentName,
        ...slots.map((s) => r.values[s.id] ?? ""),
        r.final,
        String(neisByteLength(r.final)),
      ];
      lines.push(cells.map(esc).join(","));
    }
    const csv = "﻿" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "생활기록부.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const years = [...new Set(apps.map((a) => a.year).filter((y) => y > 0))].sort(
    (a, b) => b - a,
  );
  const shownApps = apps.filter(
    (a) =>
      (filterYear === 0 || a.year === filterYear) &&
      (filterSem === 0 || a.semester === filterSem),
  );

  if (loading) return <p className="text-sm text-muted">···</p>;

  if (!user) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
        <h1 className="text-lg font-bold">생활기록부 생성</h1>
        <p className="text-sm text-muted">
          학기 과제를 모아 생기부 초안을 만들려면 로그인이 필요합니다.
        </p>
        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          className="self-start rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Google로 로그인
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">생활기록부 생성</h1>
        <Link href="/builder" className="text-sm text-muted hover:text-foreground">
          ← 수업앱
        </Link>
      </div>

      <p className="rounded-xl border border-border bg-brand-soft p-3 text-xs leading-relaxed text-muted">
        칸을 설계하면(교사 칸=태도·평가, AI 칸=활동요약) — <b>① 초안 생성</b>이 AI 칸을 학생
        제출에서 자동으로 채우고, <b>② 생기부 종합</b>이 모든 칸을 한 문단으로 엮어줘요. 무료
        모델(Haiku)로 동작하며, 결과는 반드시 검토·수정 후 사용하세요.
      </p>

      {/* 과제 선택 */}
      <section className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-muted">1. 과제 선택</span>
        {apps.length === 0 ? (
          <p className="text-sm text-muted">
            아직 만든 앱이 없어요.{" "}
            <Link href="/builder" className="text-brand hover:underline">
              먼저 수업앱을 만드세요.
            </Link>
          </p>
        ) : (
          <>
            <div className="flex gap-2">
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(Number(e.target.value))}
                className="rounded-lg border border-border bg-card px-2 py-1 text-xs"
              >
                <option value={0}>연도 전체</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </select>
              <select
                value={filterSem}
                onChange={(e) => setFilterSem(Number(e.target.value))}
                className="rounded-lg border border-border bg-card px-2 py-1 text-xs"
              >
                <option value={0}>학기 전체</option>
                <option value={1}>1학기</option>
                <option value={2}>2학기</option>
              </select>
            </div>
            {shownApps.length === 0 ? (
              <p className="text-sm text-muted">해당 조건의 과제가 없어요.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {shownApps.map((a) => (
                  <li key={a.id}>
                    <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selected.has(a.id)}
                        onChange={() => toggleApp(a.id)}
                      />
                      <span>{a.title}</span>
                      {a.year > 0 && (
                        <span className="text-xs text-muted">
                          {a.year}년 {a.semester || "?"}학기
                        </span>
                      )}
                      <span className="font-mono text-xs text-muted">{a.code}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {/* 칸 설계 */}
      <section className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-muted">2. 생기부 칸 설계</span>
        {slots.map((s) => (
          <div
            key={s.id}
            className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3"
          >
            <div className="flex gap-2">
              <input
                value={s.label}
                onChange={(e) => updateSlot(s.id, { label: e.target.value })}
                placeholder="칸 이름 (예: 태도)"
                maxLength={40}
                className={inputClass}
              />
              <select
                value={s.source}
                onChange={(e) =>
                  updateSlot(s.id, { source: e.target.value as RecordSlotSource })
                }
                className={inputClass + " max-w-[9rem]"}
              >
                <option value="teacher">✍️ 교사 직접</option>
                <option value="ai">🤖 AI 자동</option>
              </select>
              <button
                type="button"
                onClick={() => removeSlot(s.id)}
                className="rounded-lg border border-border px-2 text-sm text-muted hover:border-brand"
                aria-label="칸 삭제"
              >
                ✕
              </button>
            </div>
            {s.source === "ai" && (
              <textarea
                value={s.instruction}
                onChange={(e) => updateSlot(s.id, { instruction: e.target.value })}
                rows={2}
                placeholder="AI에게: 활동에서 무엇을 뽑을지 (예: 배운 점·성장 위주로 요약)"
                maxLength={1000}
                className={inputClass + " resize-y"}
              />
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setSlots((ss) => [
              ...ss,
              { id: rid(), label: "", source: "teacher", instruction: "" },
            ])
          }
          className="self-start rounded-full border border-border px-3 py-1 text-sm text-muted hover:border-brand"
        >
          + 칸 추가
        </button>
      </section>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">종합 지침 (선택)</span>
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={2}
          placeholder="예: 탐구 태도와 성장 과정 위주로. 과목은 '통합사회'."
          maxLength={1000}
          className={inputClass + " resize-y"}
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={() => void onGenerate()}
        disabled={generating || selected.size === 0}
        className="self-start rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {generating ? "① 초안 생성 중… (학생 수만큼 걸려요)" : "① 초안 생성"}
      </button>

      {/* 결과 그리드 */}
      {rows && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted">
              결과 {rows.length}명 — 교사 칸을 채우고 종합하세요
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void onCompose()}
                disabled={composing || rows.length === 0}
                className="rounded-full bg-brand px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {composing ? "② 종합 중…" : "② 생기부 종합"}
              </button>
              <button
                type="button"
                onClick={downloadCsv}
                className="rounded-full border border-border px-3 py-1 text-xs hover:border-brand"
              >
                CSV 다운로드
              </button>
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="text-sm text-muted">선택한 과제에 제출이 없어요.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {rows.map((r, i) => {
                const bytes = neisByteLength(r.final);
                const over = bytes > BYTE_LIMIT;
                return (
                  <li
                    key={i}
                    className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3"
                  >
                    <span className="text-sm font-medium">
                      {r.studentName}
                      {r.studentNo && (
                        <span className="ml-1.5 font-mono text-xs text-muted">
                          {r.studentNo}
                        </span>
                      )}
                    </span>
                    {slots.map((s) => (
                      <label key={s.id} className="flex flex-col gap-1 text-xs">
                        <span className="text-muted">
                          {s.source === "ai" ? "🤖 " : "✍️ "}
                          {s.label}
                        </span>
                        <textarea
                          value={r.values[s.id] ?? ""}
                          onChange={(e) => updateValue(i, s.id, e.target.value)}
                          rows={s.source === "ai" ? 2 : 1}
                          placeholder={s.source === "teacher" ? "직접 입력" : ""}
                          className={inputClass + " resize-y"}
                        />
                      </label>
                    ))}
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="flex items-center justify-between">
                        <span className="font-semibold text-brand">최종 생기부</span>
                        <span className={over ? "text-red-600" : "text-muted"}>
                          {bytes} / {BYTE_LIMIT} bytes
                        </span>
                      </span>
                      <textarea
                        value={r.final}
                        onChange={(e) => updateFinal(i, e.target.value)}
                        rows={4}
                        placeholder="② 종합을 누르면 채워져요"
                        className={inputClass + " resize-y"}
                      />
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
