"use client";

import { useState } from "react";

// 퍼나르기 단위 우선 — every card must be one link you can drop into a 단톡방.
// Uses the Web Share API on mobile (so it lands in KakaoTalk's share sheet),
// falling back to clipboard copy on desktop.

export function ShareButton({
  path,
  title,
}: {
  path: string;
  title: string;
}) {
  const [copied, setCopied] = useState(false);

  async function onShare() {
    const url =
      typeof window !== "undefined" ? window.location.origin + path : path;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // user cancelled or share failed — fall through to copy
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onShare}
      className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
    >
      {copied ? "링크 복사됨 ✓" : "🔗 공유하기"}
    </button>
  );
}
