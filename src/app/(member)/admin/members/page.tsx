"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { MemberSmsDialog } from "@/components/MemberSmsDialog";
import { REGIONS, type TeacherProfile } from "@/lib/members/types";

// 관리자 회원 관리. ADMIN_EMAILS에 등록된 이메일만 접근(서버에서 검증).
// 사전 승인은 없음 — 가입은 즉시 완료되고, 문제 계정을 여기서 삭제한다.
// 가입 정보를 한 화면에서 다 보여주는 창구: 이름·학교급·학교·지역·이메일·
// 인증된 휴대폰·가입일 + 검색 + 엑셀 내보내기.

const LEVEL_LABEL: Record<string, string> = { middle: "중", high: "고" };

/** +821012345678 → 010-1234-5678 (국내 번호만 예쁘게, 그 외는 원문). */
function formatPhone(p: string): string {
  if (!p) return "";
  const kr = p.replace(/^\+82/, "0").replace(/[^0-9]/g, "");
  if (kr.length === 11) return `${kr.slice(0, 3)}-${kr.slice(3, 7)}-${kr.slice(7)}`;
  if (kr.length === 10) return `${kr.slice(0, 3)}-${kr.slice(3, 6)}-${kr.slice(6)}`;
  return p;
}

/** ISO → YYYY.MM.DD (없으면 빈칸). */
function formatDate(iso?: string): string {
  return iso ? iso.slice(0, 10).replace(/-/g, ".") : "";
}

export default function AdminMembersPage() {
  const { user } = useAuth();
  const [teachers, setTeachers] = useState<TeacherProfile[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  /** 학교급 필터. */
  const [level, setLevel] = useState<"all" | "middle" | "high">("all");
  /** 지역 필터 ("" = 전체). */
  const [region, setRegion] = useState("");
  /** 문자 보내기 창 열림 여부 (받는 사람 선택은 창 안에서 한다). */
  const [smsOpen, setSmsOpen] = useState(false);
  /** 수정 중인 회원 uid (한 번에 한 명만). */
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setTeachers(null);
    const token = await user.getIdToken();
    const res = await fetch("/api/admin/teachers", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 403) {
      setForbidden(true);
      setTeachers([]);
      return;
    }
    setForbidden(false);
    if (res.ok) {
      const { teachers: list } = (await res.json()) as { teachers: TeacherProfile[] };
      setTeachers(list);
    } else {
      setTeachers([]);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  /** 프로필 수정 저장. email·phone은 서버가 건드리지 않는다(검증된 값). */
  async function save(
    uid: string,
    input: {
      name: string;
      schoolLevel: "middle" | "high";
      schoolName: string;
      region: string;
      phone: string;
    },
  ) {
    if (!user || busy) return;
    setBusy(uid);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/teachers/${uid}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => null)) as { error?: string } | null;
        window.alert(
          d?.error === "invalid_phone"
            ? "휴대폰 번호 형식이 올바르지 않습니다. (예: 010-1234-5678)"
            : "저장에 실패했습니다. 이름·학교명은 비울 수 없어요.",
        );
        return;
      }
      setEditing(null);
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function remove(t: TeacherProfile) {
    if (!user || busy) return;
    if (!window.confirm(`'${t.name || t.email}' 회원을 삭제할까요? 되돌릴 수 없어요.`)) return;
    setBusy(t.uid);
    try {
      const token = await user.getIdToken();
      await fetch(`/api/admin/teachers/${t.uid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  /** 실제 가입자가 있는 지역만 (인원수 포함, 많은 순). 빈 버튼을 만들지 않기 위함. */
  const regionCounts = (() => {
    const m = new Map<string, number>();
    for (const t of teachers ?? []) {
      if (t.region) m.set(t.region, (m.get(t.region) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  })();

  /** 학교급·지역 버튼 + 자유 검색(이름·학교·지역·이메일·번호)을 모두 통과한 회원. */
  const shown = (teachers ?? []).filter((t) => {
    if (level !== "all" && t.schoolLevel !== level) return false;
    if (region && t.region !== region) return false;
    const k = q.trim().toLowerCase();
    if (!k) return true;
    return [t.name, t.schoolName, t.region, t.email, t.phone, formatPhone(t.phone)]
      .join(" ")
      .toLowerCase()
      .includes(k);
  });

  const filtered = level !== "all" || Boolean(region) || Boolean(q.trim());

  async function exportExcel() {
    // 클릭 시에만 로드(번들 절약).
    const XLSX = await import("xlsx");
    const aoa = [
      ["이름", "학교급", "학교명", "지역", "이메일", "휴대폰", "번호 출처", "가입일"],
      ...shown.map((t) => [
        t.name,
        t.schoolLevel === "high" ? "고등학교" : "중학교",
        t.schoolName,
        t.region,
        t.email,
        formatPhone(t.phone),
        t.phone ? (t.phoneSource === "admin" ? "관리자 입력" : "본인 인증") : "",
        formatDate(t.createdAt),
      ]),
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "회원");
    XLSX.writeFile(wb, "진로교사커뮤니티_회원목록.xlsx");
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">회원 관리</h1>
        <p className="text-sm text-muted">가입한 교사 목록입니다. 문제 계정은 삭제할 수 있어요.</p>
      </div>

      {!user ? (
        <p className="text-sm text-muted">로그인이 필요합니다.</p>
      ) : forbidden ? (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          관리자만 접근할 수 있어요. (서버 환경변수 <code>ADMIN_EMAILS</code>에 등록된 이메일)
        </div>
      ) : teachers === null ? (
        <p className="text-sm text-muted">불러오는 중…</p>
      ) : teachers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted">
          아직 가입한 회원이 없습니다.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="이름·학교명·지역·이메일·번호로 검색"
              className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <button
              type="button"
              onClick={() => setSmsOpen(true)}
              className="rounded-full bg-brand px-4 py-2 text-xs font-medium text-white hover:opacity-90"
            >
              문자 보내기
            </button>
            <button
              type="button"
              onClick={() => void exportExcel()}
              className="rounded-full border border-brand/40 px-3 py-2 text-xs font-medium text-brand hover:bg-brand-soft"
            >
              엑셀 내보내기
            </button>
          </div>

          {/* 학교급 */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-medium text-muted">학교급</span>
            {(
              [
                ["all", "전체"],
                ["middle", "중학교"],
                ["high", "고등학교"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setLevel(v)}
                className={
                  "rounded-full border px-3 py-1 text-xs transition-colors " +
                  (level === v
                    ? "border-brand bg-brand-soft font-medium text-brand"
                    : "border-border text-muted hover:text-foreground")
                }
              >
                {label}
                {v !== "all" && (
                  <span className="ml-1 text-[10px]">
                    {(teachers ?? []).filter((t) => t.schoolLevel === v).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* 지역 — 가입자가 있는 곳만 */}
          {regionCounts.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-medium text-muted">지역</span>
              <button
                type="button"
                onClick={() => setRegion("")}
                className={
                  "rounded-full border px-3 py-1 text-xs transition-colors " +
                  (region === ""
                    ? "border-brand bg-brand-soft font-medium text-brand"
                    : "border-border text-muted hover:text-foreground")
                }
              >
                전체
              </button>
              {regionCounts.map(([r, n]) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRegion(region === r ? "" : r)}
                  className={
                    "rounded-full border px-3 py-1 text-xs transition-colors " +
                    (region === r
                      ? "border-brand bg-brand-soft font-medium text-brand"
                      : "border-border text-muted hover:text-foreground")
                  }
                >
                  {r}
                  <span className="ml-1 text-[10px]">{n}</span>
                </button>
              ))}
            </div>
          )}

          {filtered && (
            <button
              type="button"
              onClick={() => {
                setLevel("all");
                setRegion("");
                setQ("");
              }}
              className="self-start text-xs text-muted hover:text-foreground hover:underline"
            >
              필터 초기화
            </button>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-xs text-muted">
              총 {teachers.length}명
              {filtered && ` · 조건에 맞는 ${shown.length}명`}
            </p>
            {filtered && (
              <span className="text-xs text-muted">
                · [문자 보내기]를 누르면 이 {shown.length}명이 기본 선택됩니다
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {shown.map((t) =>
              editing === t.uid ? (
                <MemberEditRow
                  key={t.uid}
                  teacher={t}
                  busy={busy === t.uid}
                  onCancel={() => setEditing(null)}
                  onSave={(input) => void save(t.uid, input)}
                />
              ) : (
              <div
                key={t.uid}
                className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-semibold">{t.name || "(이름 없음)"}</span>
                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
                    {LEVEL_LABEL[t.schoolLevel] ?? ""}
                  </span>
                  <span className="text-sm text-muted">
                    {t.schoolName}
                    {t.region ? ` · ${t.region}` : ""}
                  </span>
                  <div className="ml-auto flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditing(t.uid)}
                      className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-brand hover:text-brand"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(t)}
                      disabled={busy === t.uid}
                      className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-red-400 hover:text-red-600 disabled:opacity-50"
                    >
                      {busy === t.uid ? "삭제 중…" : "삭제"}
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                  <span>✉ {t.email}</span>
                  {t.phone ? (
                    <span className="font-medium text-foreground/80">
                      📱 {formatPhone(t.phone)}
                      {t.phoneSource === "admin" ? (
                        <span className="ml-1 text-[10px] text-muted">관리자 입력</span>
                      ) : (
                        <span className="ml-1 text-[10px] text-brand">인증됨</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted/60">📱 번호 없음</span>
                  )}
                  {t.createdAt && <span>가입 {formatDate(t.createdAt)}</span>}
                </div>
              </div>
              ),
            )}
            {shown.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted">
                조건에 맞는 회원이 없습니다. 필터를 조정해 보세요.
              </div>
            )}
          </div>

          {smsOpen && (
            <MemberSmsDialog teachers={shown} onClose={() => setSmsOpen(false)} />
          )}
        </>
      )}
    </div>
  );
}

/** 회원 한 명의 인라인 수정 폼. 이메일·휴대폰은 검증된 값이라 읽기 전용. */
function MemberEditRow({
  teacher,
  busy,
  onSave,
  onCancel,
}: {
  teacher: TeacherProfile;
  busy: boolean;
  onSave: (input: {
    name: string;
    schoolLevel: "middle" | "high";
    schoolName: string;
    region: string;
    phone: string;
  }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(teacher.name);
  const [schoolLevel, setSchoolLevel] = useState<"middle" | "high">(teacher.schoolLevel);
  const [schoolName, setSchoolName] = useState(teacher.schoolName);
  const [region, setRegion] = useState(teacher.region);
  // 보기 편한 국내 표기로 편집하고, 저장 시 서버가 E.164로 정규화한다.
  const [phone, setPhone] = useState(formatPhone(teacher.phone));

  const field =
    "rounded-lg border border-border bg-card px-3 py-1.5 text-sm outline-none focus:border-brand";

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-brand/50 bg-card px-4 py-3">
      <div className="flex flex-wrap gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름"
          maxLength={40}
          className={field + " w-28"}
        />
        <select
          value={schoolLevel}
          onChange={(e) => setSchoolLevel(e.target.value as "middle" | "high")}
          className={field}
        >
          <option value="middle">중학교</option>
          <option value="high">고등학교</option>
        </select>
        <input
          value={schoolName}
          onChange={(e) => setSchoolName(e.target.value)}
          placeholder="학교명"
          maxLength={80}
          className={field + " min-w-[10rem] flex-1"}
        />
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className={field}
        >
          <option value="">지역 없음</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">📱</span>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="010-1234-5678 (비우면 번호 삭제)"
          maxLength={20}
          className={field + " w-52"}
        />
        <span className="text-[11px] text-muted">
          번호를 고치면 <b>관리자 입력</b>으로 표시됩니다(본인 SMS 인증과 구분).
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span>✉ {teacher.email}</span>
        <span className="text-[11px]">
          이메일은 구글 로그인 정체성이라 수정할 수 없어요.
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-brand disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => onSave({ name, schoolLevel, schoolName, region, phone })}
            disabled={busy || !name.trim() || !schoolName.trim()}
            className="rounded-full bg-brand px-4 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
