"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { TeacherProfile } from "@/lib/members/types";

// 관리자 회원 관리. ADMIN_EMAILS에 등록된 이메일만 접근(서버에서 검증).
// 사전 승인은 없음 — 가입은 즉시 완료되고, 문제 계정을 여기서 삭제한다.

const LEVEL_LABEL: Record<string, string> = { middle: "중", high: "고" };

export default function AdminMembersPage() {
  const { user } = useAuth();
  const [teachers, setTeachers] = useState<TeacherProfile[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

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
          <p className="text-xs text-muted">총 {teachers.length}명</p>
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
                <button
                  type="button"
                  onClick={() => void remove(t)}
                  disabled={busy === t.uid}
                  className="ml-auto rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-red-400 hover:text-red-600 disabled:opacity-50"
                >
                  {busy === t.uid ? "삭제 중…" : "삭제"}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
