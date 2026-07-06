"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { TeacherProfile } from "@/lib/builder/types";
import { TeacherOnboarding } from "@/components/builder/TeacherOnboarding";

// Access gate for the whole teacher builder. Order: Google sign-in → teacher
// profile (소속학교 등). Children (the actual builder tools) render only once
// both are satisfied, so every builder page is gated in one place.

export function TeacherGate({ children }: { children: React.ReactNode }) {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  // undefined = not fetched yet, null = no profile (needs onboarding)
  const [profile, setProfile] = useState<TeacherProfile | null | undefined>(
    undefined,
  );

  const loadProfile = useCallback(async () => {
    if (!user) return;
    setProfile(undefined);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/builder/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { profile: TeacherProfile | null };
        setProfile(data.profile);
      } else {
        setProfile(null);
      }
    } catch {
      setProfile(null);
    }
  }, [user]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  if (loading) return <p className="text-sm text-muted">···</p>;

  if (!user) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
        <h1 className="text-lg font-bold">수업앱 빌더</h1>
        <p className="text-sm text-muted">
          진로교육 담당 교사를 위한 도구입니다. 시작하려면 로그인하세요.
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

  if (profile === undefined) {
    return <p className="text-sm text-muted">불러오는 중…</p>;
  }

  if (profile === null) {
    return (
      <div className="flex flex-col gap-3">
        <TeacherOnboarding user={user} onDone={setProfile} />
        <button
          type="button"
          onClick={() => void signOut()}
          className="self-center text-xs text-muted hover:text-foreground"
        >
          다른 계정으로 로그인
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
