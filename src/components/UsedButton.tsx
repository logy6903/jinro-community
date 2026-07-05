"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";

// "실제 수업에 사용함" — the field-validation signal the plan ranks above likes.
// Per-teacher: requires login (an additive, contribution-side action — content
// itself stays open). First tap when logged out starts Google sign-in; once
// signed in, posts the ID token so the server records a deduped usage_signal.

export function UsedButton({
  cardId,
  initialCount,
}: {
  cardId: string;
  initialCount: number;
}) {
  const { user, signInWithGoogle } = useAuth();
  const [used, setUsed] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    if (!user) {
      // Sign in first; the teacher can tap again to record.
      await signInWithGoogle();
      return;
    }
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/cards/${cardId}/use`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as {
          usedCount: number | null;
          alreadyUsed: boolean;
        };
        if (typeof data.usedCount === "number") setCount(data.usedCount);
        setUsed(true);
      }
    } catch {
      // leave state unchanged; teacher can retry
    } finally {
      setBusy(false);
    }
  }

  const label = !user
    ? "로그인하고 기록하기"
    : used
      ? `고맙습니다! 👩‍🏫 ${count}명`
      : "우리 반에서 써봤어요";

  return (
    <button
      type="button"
      disabled={used || busy}
      onClick={() => void onClick()}
      className={
        "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors " +
        (used
          ? "border-brand bg-brand-soft text-brand"
          : "border-border bg-card text-foreground hover:border-brand")
      }
    >
      {label}
    </button>
  );
}
