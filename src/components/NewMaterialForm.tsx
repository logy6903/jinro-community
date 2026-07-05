"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { CardCategory, SchoolLevel } from "@/lib/domain/types";
import { CATEGORY_LABEL, SCHOOL_LEVEL_LABEL } from "@/lib/domain/labels";

// Teacher material-creation form. Posting requires login (the form prompts for
// Google sign-in first). The author is set server-side from the verified token.

const LEVELS: SchoolLevel[] = ["middle", "high"];
const CATEGORIES: CardCategory[] = ["activity", "lesson", "info", "checklist"];

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-brand";

export function NewMaterialForm() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();

  const [schoolLevel, setSchoolLevel] = useState<SchoolLevel>("middle");
  const [category, setCategory] = useState<CardCategory>("activity");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return <p className="text-sm text-muted">···</p>;
  }

  if (!user) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
        <p className="text-sm text-muted">
          자료를 올리려면 로그인이 필요합니다. (자료 열람은 로그인 없이 가능)
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !user) return;
    setBusy(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/materials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ schoolLevel, category, title, summary, body }),
      });
      if (!res.ok) {
        setError("저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      const data = (await res.json()) as { id: string };
      router.push(`/board/${data.id}`);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="text-muted">학교급</span>
          <select
            value={schoolLevel}
            onChange={(e) => setSchoolLevel(e.target.value as SchoolLevel)}
            className={inputClass}
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {SCHOOL_LEVEL_LABEL[l]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="text-muted">유형</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CardCategory)}
            className={inputClass}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">제목</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          required
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">한 줄 소개</span>
        <input
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          maxLength={200}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">내용</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={10}
          className={inputClass + " resize-y"}
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={busy || !title.trim() || !body.trim()}
        className="self-start rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "올리는 중…" : "자료 올리기"}
      </button>
    </form>
  );
}
