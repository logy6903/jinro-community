"use client";

import type { Block } from "@/lib/builder/types";
import { isMediaContent } from "@/lib/builder/embed";
import {
  ACTIVITY_GRID,
  ContentBlockView,
  MaterialPane,
} from "@/components/builder/ContentBlockView";

// Read-only preview of what a student will see, rendered from the blocks the
// teacher is composing (before saving). Inputs are shown but inert.

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none";

export function BuilderPreview({
  title,
  blocks,
}: {
  title: string;
  blocks: Block[];
}) {
  const media = blocks.filter(isMediaContent);
  // Annotated: see StudentForm — the negated predicate would otherwise drop
  // text content blocks from the question flow.
  const flow: Block[] = blocks.filter((b) => !isMediaContent(b));

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-5">
      <header className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-brand">
          👀 학생 화면 미리보기
        </span>
        <h2 className="text-xl font-bold leading-snug">
          {title || "(제목 없음)"}
        </h2>
        <p className="text-xs text-muted">실제 제출은 되지 않아요.</p>
      </header>

      <div className={media.length > 0 ? ACTIVITY_GRID : undefined}>
        <MaterialPane blocks={media} />

        <div className="flex flex-col gap-5">
          <div className="flex gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">학번</span>
              <input
                disabled
                className={inputClass + " max-w-[8rem] opacity-70"}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="text-muted">이름</span>
              <input disabled className={inputClass + " opacity-70"} />
            </label>
          </div>

          {flow.map((b) =>
            b.kind === "content" ? (
              <ContentBlockView key={b.id} block={b} />
            ) : (
              <label key={b.id} className="flex flex-col gap-1 text-sm">
                <span className="text-muted">
                  {b.label}
                  {b.required && <span className="text-red-600"> *</span>}
                </span>
                {b.type === "long" ? (
                  <textarea
                    disabled
                    rows={4}
                    className={inputClass + " resize-y opacity-70"}
                  />
                ) : b.type === "choice" ? (
                  <select disabled className={inputClass + " opacity-70"}>
                    <option>선택하세요</option>
                    {(b.options ?? []).map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    disabled
                    type={b.type === "number" ? "number" : "text"}
                    className={inputClass + " opacity-70"}
                  />
                )}
              </label>
            ),
          )}

          <button
            disabled
            className="self-start rounded-full bg-brand px-5 py-2 text-sm font-medium text-white opacity-50"
          >
            제출하기
          </button>
        </div>
      </div>
    </div>
  );
}
