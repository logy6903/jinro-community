"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { commonScheduleItems } from "@/lib/schedule/common";
import type { DatasetLevel, ScheduleItem } from "@/lib/domain/types";
import { DATASET_LEVEL_LABEL } from "@/lib/domain/labels";

// 일정표 (Track 1). 공용 일정(academicCalendar 파생) 자동 + 로그인 교사가 학교 일정을
// 얹는다. 추가 UX: 캘린더의 날짜를 클릭(또는 우클릭)하면 그 날짜 팝업이 떠서 그 날의
// 일정을 보고 바로 추가한다.

const MONTHS = Array.from({ length: 12 }, (_, i) => `${i + 1}월`);
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const TOGGLE_LEVELS: ("middle" | "high")[] = ["middle", "high"];

function parseMD(s: string): number {
  return Number(s.slice(0, 2)) * 100 + Number(s.slice(3, 5));
}
function mdOf(month1: number, day: number): string {
  return `${String(month1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-brand";

export default function SchedulePage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(() => new Date().getMonth()); // 0-11
  const [level, setLevel] = useState<"middle" | "high">("middle");
  const [teacherItems, setTeacherItems] = useState<ScheduleItem[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

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

  function openDay(day: number) {
    setSelectedDay(day);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">진로 일정표</h1>
        <p className="text-sm text-muted">
          공용 진로 일정이 기본으로 깔려요. <b>날짜를 클릭</b>하면 그 날 일정을 보고,
          로그인하면 우리 학교 일정을 추가할 수 있습니다.
        </p>
      </div>

      {/* 컨트롤 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-border bg-card p-1">
          {TOGGLE_LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                setLevel(l);
                setSelectedDay(null);
              }}
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
            onClick={() => {
              setMonth((m) => (m + 11) % 12);
              setSelectedDay(null);
            }}
            className="rounded-full border border-border px-2.5 py-1 text-sm hover:border-brand"
            aria-label="이전 달"
          >
            ◀
          </button>
          <span className="text-base font-semibold">{MONTHS[month]}</span>
          <button
            type="button"
            onClick={() => {
              setMonth((m) => (m + 1) % 12);
              setSelectedDay(null);
            }}
            className="rounded-full border border-border px-2.5 py-1 text-sm hover:border-brand"
            aria-label="다음 달"
          >
            ▶
          </button>
        </div>
        <div className="flex gap-3 text-xs text-muted">
          <span>
            <span
              className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle"
              style={{ background: "#9FE1CB" }}
            />
            공용
          </span>
          <span>
            <span
              className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle"
              style={{ background: "#FAC775" }}
            />
            우리 학교
          </span>
        </div>
      </div>

      {/* 캘린더 그리드 (날짜 클릭/우클릭 → 팝업) */}
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
              return (
                <div key={idx} className="min-h-[52px] border-t border-border" />
              );
            const dayItems = items.filter((i) => covers(i, month1, day));
            const hasTeacher = dayItems.some((i) => i.origin === "teacher");
            const hasCommon = dayItems.some((i) => i.origin === "common");
            const bg = hasTeacher ? "#FAEEDA" : hasCommon ? "#E1F5EE" : "transparent";
            const fg = hasTeacher ? "#854F0B" : hasCommon ? "#0F6E56" : "inherit";
            const startItem = items.find(
              (i) => parseMD(i.start) === month1 * 100 + day,
            );
            return (
              <button
                key={idx}
                type="button"
                onClick={() => openDay(day)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  openDay(day);
                }}
                title="클릭해서 일정 보기·추가"
                className="min-h-[52px] cursor-pointer border-t border-border px-1.5 py-1 text-left transition-shadow hover:ring-1 hover:ring-brand/40"
                style={{ background: bg }}
              >
                <div className="text-xs" style={{ color: fg }}>
                  {day}
                </div>
                {startItem && (
                  <div
                    className="mt-0.5 truncate text-[10px] font-medium leading-tight"
                    style={{ color: fg }}
                  >
                    {startItem.title}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted">
        날짜를 클릭(또는 우클릭)하면 그 날 일정을 보고 추가할 수 있어요.
      </p>

      {/* 이 달의 일정 + 힌트 */}
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">
          {MONTHS[month]}의 일정 {monthItems.length}개
        </h2>
        {monthItems.length > 0 ? (
          monthItems.map((it) => (
            <div key={it.id} className="rounded-2xl border border-border bg-card p-4">
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
              </div>
              <p className="text-sm font-semibold">{it.title}</p>
              {it.hint && (
                <p className="mt-1 text-sm leading-relaxed text-muted">💡 {it.hint}</p>
              )}
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-border px-5 py-6 text-center text-sm text-muted">
            이 달 일정이 없어요. 날짜를 클릭해 추가해보세요.
          </p>
        )}
      </div>

      {selectedDay !== null && (
        <DayPopup
          month1={month1}
          day={selectedDay}
          dayItems={items.filter((i) => covers(i, month1, selectedDay))}
          level={level}
          onClose={() => setSelectedDay(null)}
          onChanged={refreshTeacher}
        />
      )}
    </div>
  );
}

function DayPopup({
  month1,
  day,
  dayItems,
  level,
  onClose,
  onChanged,
}: {
  month1: number;
  day: number;
  dayItems: ScheduleItem[];
  level: "middle" | "high";
  onClose: () => void;
  onChanged: () => void;
}) {
  const { user, signInWithGoogle } = useAuth();
  const [title, setTitle] = useState("");
  const [hint, setHint] = useState("");
  const [multi, setMulti] = useState(false);
  const [end, setEnd] = useState(""); // YYYY-MM-DD
  const [busy, setBusy] = useState(false);
  const start = mdOf(month1, day);

  async function add() {
    if (!user || busy || !title.trim()) return;
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
          level,
          title,
          hint,
          start,
          end: multi && end ? end.slice(5) : start,
        }),
      });
      if (res.ok) {
        setTitle("");
        setHint("");
        onChanged();
        onClose();
      }
    } finally {
      setBusy(false);
    }
  }

  async function del(id: string) {
    if (!user) return;
    const token = await user.getIdToken();
    await fetch(`/api/schedule?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    onChanged();
    onClose();
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-2xl bg-card p-5 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">
            {month1}월 {day}일
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="text-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {dayItems.length > 0 && (
          <div className="flex flex-col gap-2">
            {dayItems.map((it) => (
              <div key={it.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-2 text-xs">
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
                  {it.origin === "teacher" && user && (
                    <button
                      type="button"
                      onClick={() => void del(it.id)}
                      className="ml-auto text-muted hover:text-red-600"
                    >
                      삭제
                    </button>
                  )}
                </div>
                <p className="mt-1 text-sm font-semibold">{it.title}</p>
                {it.hint && (
                  <p className="mt-0.5 text-xs text-muted">💡 {it.hint}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {user ? (
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <p className="text-sm font-medium">
              이 날 일정 추가 · {DATASET_LEVEL_LABEL[level]}
            </p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목 (예: 1학기 중간고사)"
              maxLength={120}
              className={inputClass}
            />
            <input
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="수업 힌트 (선택)"
              maxLength={300}
              className={inputClass}
            />
            <label className="flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={multi}
                onChange={(e) => setMulti(e.target.checked)}
              />
              여러 날 (종료일 지정)
            </label>
            {multi && (
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className={inputClass}
              />
            )}
            <button
              type="button"
              onClick={() => void add()}
              disabled={busy || !title.trim()}
              className="self-start rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "추가 중…" : "추가"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            className="self-start rounded-full border border-border px-4 py-2 text-sm text-muted hover:border-brand"
          >
            로그인하고 이 날 일정 추가
          </button>
        )}
      </div>
    </div>
  );
}
