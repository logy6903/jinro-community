"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  MEMBER_STATUS_LABEL,
  type MemberStatus,
  type TeacherProfile,
} from "@/lib/members/types";

// 관리자 회원 승인. ADMIN_EMAILS에 등록된 이메일만 접근 가능(서버에서 검증).

const LEVEL_LABEL: Record<string, string> = { middle: "중", high: "고" };
const TABS: { key: MemberStatus | "all"; label: string }[] = [
  { key: "pending", label: "승인 대기" },
  { key: "approved", label: "승인됨" },
  { key: "rejected", label: "거절됨" },
  { key: "all", label: "전체" },
];

export default function AdminMembersPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<MemberStatus | "all">("pending");
  const [teachers, setTeachers] = useState<TeacherProfile[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setTeachers(null);
    const token = await user.getIdToken();
    const q = filter === "all" ? "" : `?status=${filter}`;
    const res = await fetch(`/api/admin/teachers${q}`, {
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
  }, [user, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(uid: string, status: MemberStatus) {
    if (!user || busy) return;
    setBusy(uid);
    try {
      const token = await user.getIdToken();
      await fetch(`/api/admin/teachers/${uid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">회원 승인</h1>
        <p className="text-sm text-muted">교사 가입 신청을 검토해 승인/거절합니다.</p>
      </div>

      {!user ? (
        <p className="text-sm text-muted">로그인이 필요합니다.</p>
      ) : forbidden ? (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          관리자만 접근할 수 있어요. (서버 환경변수 <code>ADMIN_EMAILS</code>에 등록된 이메일)
        </div>
      ) : (
        <>
          <div className="inline-flex self-start rounded-full border border-border bg-card p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setFilter(t.key)}
                className={
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors " +
                  (t.key === filter ? "bg-brand text-white" : "text-muted")
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          {teachers === null ? (
            <p className="text-sm text-muted">불러오는 중…</p>
          ) : teachers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted">
              해당 상태의 회원이 없습니다.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {teachers.map((t) => (
                <div
                  key={t.uid}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-border bg-card px-4 py-3"
                >
                  <span className="font-semibold">{t.name || "(이름 없음)"}</span>
                  <span className="text-sm text-muted">
                    {LEVEL_LABEL[t.schoolLevel] ?? ""} · {t.schoolName}
                    {t.region ? ` · ${t.region}` : ""}
                  </span>
                  <span className="text-xs text-muted">{t.email}</span>
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-xs font-medium " +
                      (t.status === "approved"
                        ? "bg-green-100 text-green-700"
                        : t.status === "rejected"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-800")
                    }
                  >
                    {MEMBER_STATUS_LABEL[t.status]}
                  </span>
                  <div className="ml-auto flex gap-1.5">
                    {t.status !== "approved" && (
                      <button
                        type="button"
                        onClick={() => void act(t.uid, "approved")}
                        disabled={busy === t.uid}
                        className="rounded-full bg-brand px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                      >
                        승인
                      </button>
                    )}
                    {t.status !== "rejected" && (
                      <button
                        type="button"
                        onClick={() => void act(t.uid, "rejected")}
                        disabled={busy === t.uid}
                        className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-red-400 hover:text-red-600 disabled:opacity-50"
                      >
                        거절
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
