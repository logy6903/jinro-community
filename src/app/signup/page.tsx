"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  REGIONS,
  type MemberSchoolLevel,
  type TeacherProfile,
} from "@/lib/members/types";

// 회원 가입 — Google 로그인 → 교사 프로필(이름·학교급·학교명·지역) 입력 → 즉시 가입.
// 로그인은 부가 레이어라 열람은 가입 없이도 가능. 문제 계정은 관리자가 삭제.

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-brand";

export default function SignupPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  // undefined = 아직 조회 전, null = 프로필 없음, 객체 = 있음
  const [profile, setProfile] = useState<TeacherProfile | null | undefined>(undefined);

  const [name, setName] = useState("");
  const [schoolLevel, setSchoolLevel] = useState<MemberSchoolLevel>("high");
  const [schoolName, setSchoolName] = useState("");
  const [region, setRegion] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      setProfile(undefined);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/teachers/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        const data = res.ok
          ? ((await res.json()) as { profile: TeacherProfile | null; admin?: boolean })
          : { profile: null, admin: false };
        setProfile(data.profile);
        setIsAdmin(!!data.admin);
        if (data.profile) {
          setName(data.profile.name);
          setSchoolLevel(data.profile.schoolLevel);
          setSchoolName(data.profile.schoolName);
          setRegion(data.profile.region);
        } else if (user.displayName) {
          setName(user.displayName);
        }
      } catch {
        if (!cancelled) setProfile(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function submit() {
    if (!user || saving) return;
    if (!name.trim() || !schoolName.trim()) {
      setError("이름과 학교명을 입력해주세요.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, schoolLevel, schoolName, region }),
      });
      if (!res.ok) {
        setError("저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      const { profile: saved } = (await res.json()) as { profile: TeacherProfile };
      setProfile(saved);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">회원 가입</h1>
        <p className="text-sm text-muted">
          Google로 로그인한 뒤 교사 정보를 입력하면 바로 가입돼요. (열람은 가입 없이도 가능)
        </p>
      </div>

      {isAdmin && (
        <Link
          href="/admin/members"
          className="self-start text-sm font-medium text-brand hover:underline"
        >
          관리자: 회원 관리 →
        </Link>
      )}

      {!user ? (
        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          disabled={loading}
          className="self-start rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "확인 중…" : "Google로 계속하기"}
        </button>
      ) : profile === undefined ? (
        <p className="text-sm text-muted">불러오는 중…</p>
      ) : (
        <div className="flex flex-col gap-4">
          {profile && (
            <div className="rounded-xl bg-green-50 px-4 py-3 text-sm leading-relaxed text-green-800">
              ✓ 가입되어 있어요. 아래에서 정보를 수정할 수 있습니다.
            </div>
          )}

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">이름</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className={inputClass} placeholder="예: 김진로" />
          </label>

          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="font-medium">학교급</span>
              <select value={schoolLevel} onChange={(e) => setSchoolLevel(e.target.value as MemberSchoolLevel)} className={inputClass}>
                <option value="middle">중학교</option>
                <option value="high">고등학교</option>
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="font-medium">지역(시도)</span>
              <select value={region} onChange={(e) => setRegion(e.target.value)} className={inputClass}>
                <option value="">선택</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">학교명</span>
            <input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} maxLength={80} className={inputClass} placeholder="예: ○○고등학교" />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            className="self-start rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "저장 중…" : profile ? "정보 수정" : "가입하기"}
          </button>
          <p className="text-xs text-muted">가입 계정: {user.email}</p>
        </div>
      )}
    </div>
  );
}
