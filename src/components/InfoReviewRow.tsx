"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { FACETS } from "@/lib/info/facets";
import type { InfoItem } from "@/lib/domain/types";

// One AI-tagged item awaiting review. Teacher confirms/edits 구분·학교급·
// 대상학년 and saves; the PATCH marks it reviewed and it drops off the list.

const CATEGORY = FACETS.find((f) => f.key === "category")!;
const LEVEL = FACETS.find((f) => f.key === "level")!;
const GRADE = FACETS.find((f) => f.key === "grade")!;

const selectCls =
  "rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm text-foreground focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

export function InfoReviewRow({ item }: { item: InfoItem }) {
  const { user } = useAuth();
  const [category, setCategory] = useState<string>(item.category);
  const [level, setLevel] = useState<string>(item.level);
  const [grade, setGrade] = useState<string>(item.grade);
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");

  async function save() {
    if (!user) {
      setState("error");
      return;
    }
    setState("saving");
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/info/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ category, level, grade }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted">
        ✓ 확정됨 · {item.title}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold leading-snug">{item.title}</h3>
        <p className="mt-0.5 text-xs text-muted">
          {item.source} · {item.publishedAt.replace(/-/g, ".")}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">구분</span>
          <select className={selectCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORY.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">학교급</span>
          <select className={selectCls} value={level} onChange={(e) => setLevel(e.target.value)}>
            {LEVEL.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">대상 학년</span>
          <select className={selectCls} value={grade} onChange={(e) => setGrade(e.target.value)}>
            {GRADE.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={state === "saving"}
          className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {state === "saving" ? "저장 중…" : "확정"}
        </button>
        {state === "error" && (
          <span className="text-xs text-red-600">
            {user ? "저장 실패. 잠시 후 다시 시도해 주세요." : "로그인이 필요합니다."}
          </span>
        )}
      </div>
    </div>
  );
}
