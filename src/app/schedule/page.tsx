"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { commonScheduleItems } from "@/lib/schedule/common";
import type { DatasetLevel, ScheduleItem } from "@/lib/domain/types";
import { DATASET_LEVEL_LABEL } from "@/lib/domain/labels";

// 일정표 (Track 1). 공용 일정(academicCalendar 파생)이 자동으로 깔리고, 로그인 교사가
// 학교 일정을 얹는다. 각 일정에 수업 힌트. 열람은 공개, 추가는 로그인.

const MONTHS = Array.from({ length: 12 }, (_, i) => `${i + 1}월`);
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const TOGGLE_LEVELS: ("middle" | "high")[] = ["middle", "high"];

function parseMD(s: string): number {
  return Number(s.slice(0, 2)) * 100 + Number(s.slice(3, 5));
}
function covers(item: ScheduleItem, month1: number, day: number): boolean {
  const key = month1 * 100 + day;
  const s = parseMD(item.start);
  const e = parseMD(item.end);
  return s <= e ? key >= s && key <= e : key >= s || key <= e;
}
function monthsOf(item: ScheduleItem): number[] {
  const sm = Number(item.start.slice(0, 2));
  const em = Number(item.end.slice(0, 2));
  const res: number[] = [];
  let m = sm;
  for (let i = 0; i < 12; i++) {
    res.push(m);
    if (m === em) break;
    m = (m % 12) + 1;
  }
  return res;
}
function fmtMD(s: string): string {
  return `${Number(s.slice(0, 2))}/${Number(s.slice(3, 5))}`;
}

const inputClass =
  "rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-brand";

export default function SchedulePage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(() => new Date().getMonth()); // 0-11
  const [level, setLevel] = useState<"middle" | "high">("middle");
  const [teacherItems, setTeacherItems] = useState<ScheduleItem[]>([]);

  const common = useMemo(() => commonScheduleItems(), []);

  const refreshTeacher = useCallback(async () => {
    if (!user) {
      setTeacherItems([]);
      return;
    }
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/schedule", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { items?: ScheduleItem[] };
      setTeacherItems(data.items ?? []);
    } catch {
      setTeacherItems([]);
    }
  }, [user]);

  useEffect(() => {
    void refreshTeacher();
  }, [refreshTeacher]);

  const items = useMemo(
    () =>
      [...common, ...teacherItems].filter(
        (i) => i.level === level || i.level === "both",
      ),
    [common, teacherItems, level],
  );

  const month1 = month + 1;
  const monthItems = useMemo(
    () =>
      items
        .filter((i) => monthsOf(i).includes(month1))
        .sort((a, b) => parseMD(a.start) - parseMD(b.start)),
    [items, month1],
  );

  const year = new Date().getFullYear();
  const firstDow = new Date(year, month, 1).getDay();
  const dim = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: dim }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">진로 일정표</h1>
        <p className="text-sm text-muted">
          공용 진로 일정이 기본으로 깔려요. 로그인하면 우리 학교 일정을 얹을 수
          있습니다.
        </p>
      </div>

      {/* 컨트롤 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-border bg-card p-1">
          {TOGGLE_LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLevel(l)}
              className={
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors " +
                (l === level ? "bg-brand text-white" : "text-muted")
              }
            >
              {DATASET_LEVEL_LABEL[l as DatasetLevel]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMonth((m) => (m + 11) % 12)}
            className="rounded-full border border-border px-2.5 py-1 text-sm hover:border-brand"
            aria-label="이전 달"
          >
            ◀
          </button>
          <span className="text-base font-semibold">{MONTHS[month]}</span>
          <button
            type="button"
            onClick={() => setMonth((m) => (m + 1) % 12)}
            className="rounded-full border border-border px-2.5 py-1 text-sm hover:border-brand"
            aria-label="다음 달"
          >
            ▶
          </button>
        </div>
        <div className="flex gap-3 text-xs text-muted">
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: "#9FE1CB" }} />
            공용
          </span>
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: "#FAC775" }} />
            우리 학교
          </span>
        </div>
      </div>

      {/* 캘린더 그리드 */}
      <div className="overflow-hidden rounded-2xl border border-border">
        <div className="grid grid-cols-7 bg-brand-soft">
          {DOW.map((d, i) => (
            <div
              key={d}
              className="py-2 text-center text-xs font-medium"
              style={{ color: i === 0 ? "#A32D2D" : "var(--muted)" }}
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (day === null)
              return <div key={idx} className="min-h-[52px] border-t border-border" />;
            const dayItems = items.filter((i) => covers(i, month1, day));
            const hasTeacher = dayItems.some((i) => i.origin === "teacher");
            const hasCommon = dayItems.some((i) => i.origin === "common");
            const bg = hasTeacher ? "#FAEEDA" : hasCommon ? "#E1F5EE" : "transparent";
            const fg = hasTeacher ? "#854F0B" : hasCommon ? "#0F6E56" : "inherit";
            const startItem = items.find(
              (i) => parseMD(i.start) === month1 * 100 + day,
            );
            return (
              <div
                key={idx}
                className="min-h-[52px] border-t border-border px-1.5 py-1"
                style={{ background: bg }}
              >
                <div className="text-xs" style={{ color: fg }}>
                  {day}
                </div>
                {startItem && (
                  <div
                    className="mt-0.5 truncate text-[10px] font-medium leading-tight"
                    style={{ color: fg }}
                    title={startItem.title}
                  >
                    {startItem.title}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 이 달의 일정 + 힌트 */}
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">
          {MONTHS[month]}의 일정 {monthItems.length}개
        </h2>
        {monthItems.length > 0 ? (
          monthItems.map((it) => (
            <div
              key={it.id}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <div className="mb-1 flex items-center gap-2 text-xs">
                <span
                  className="rounded-full px-2 py-0.5 font-medium"
                  style={
                    it.origin === "teacher"
                      ? { background: "#FAEEDA", color: "#854F0B" }
                      : { background: "#E1F5EE", color: "#0F6E56" }
                  }
                >
                  {it.origin === "teacher" ? "우리 학교" : "공용"}
                </span>
                <span className="text-muted">
                  {fmtMD(it.start)}
                  {it.end !== it.start && `~${fmtMD(it.end)}`}
                </span>
                {it.origin === "teacher" && user && (
                  <button
                    type="button"
                    onClick={async () => {
                      const token = await user.getIdToken();
                      await fetch(`/api/schedule?id=${it.id}`, {
                        method: "DELETE",
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      void refreshTeacher();
                    }}
                    className="ml-auto text-muted hover:text-red-600"
                  >
                    삭제
                  </button>
                )}
              </div>
              <p className="text-sm font-semibold">{it.title}</p>
              {it.hint && (
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  💡 {it.hint}
                </p>
              )}
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-border px-5 py-6 text-center text-sm text-muted">
            이 달 일정이 없어요.
          </p>
        )}
      </div>

      <AddScheduleForm defaultLevel={level} onAdded={refreshTeacher} />
    </div>
  );
}

function AddScheduleForm({
  defaultLevel,
  onAdded,
}: {
  defaultLevel: "middle" | "high";
  onAdded: () => void;
}) {
  const { user, signInWithGoogle } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [hint, setHint] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => void signInWithGoogle()}
        className="self-start rounded-full border border-border px-4 py-2 text-sm text-muted hover:border-brand"
      >
        로그인하고 우리 학교 일정 추가
      </button>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start rounded-full border border-border px-4 py-2 text-sm text-brand hover:border-brand"
      >
        + 우리 학교 일정 추가
      </button>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !user || !title.trim() || !start) return;
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          level: defaultLevel,
          title,
          hint,
          start: start.slice(5), // YYYY-MM-DD → MM-DD
          end: (end || start).slice(5),
        }),
      });
      if (res.ok) {
        setTitle("");
        setHint("");
        setStart("");
        setEnd("");
        setOpen(false);
        onAdded();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
    >
      <p className="text-sm font-medium">
        우리 학교 일정 추가 · {DATASET_LEVEL_LABEL[defaultLevel]}
      </p>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="일정 제목 (예: 1학기 중간고사)"
        maxLength={120}
        required
        className={inputClass}
      />
      <input
        value={hint}
        onChange={(e) => setHint(e.target.value)}
        placeholder="수업 힌트 (예: 시험 전 진로수업은 가볍게)"
        maxLength={300}
        className={inputClass}
      />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-1">
          <span className="text-muted">시작</span>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required
            className={inputClass}
          />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-muted">종료(선택)</span>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || !title.trim() || !start}
          className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "추가 중…" : "추가"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-border px-4 py-2 text-sm text-muted"
        >
          취소
        </button>
      </div>
    </form>
  );
}
