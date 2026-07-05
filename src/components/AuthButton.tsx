"use client";

import { useAuth } from "@/lib/auth/AuthProvider";

// Header login control. Compact: a single "로그인" button, or the signed-in
// teacher's name with a logout link.

export function AuthButton() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();

  if (loading) {
    return <span className="text-xs text-muted">···</span>;
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => void signInWithGoogle()}
        className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:border-brand"
      >
        로그인
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      <span className="max-w-[10rem] truncate">
        {user.displayName ?? user.email}
      </span>
      <button
        type="button"
        onClick={() => void signOut()}
        className="rounded-full border border-border px-2 py-1 hover:border-brand"
      >
        로그아웃
      </button>
    </div>
  );
}
