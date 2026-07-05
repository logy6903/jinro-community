"use client";

import type { Block } from "@/lib/builder/types";
import { youtubeEmbedUrl } from "@/lib/builder/embed";

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
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-background p-5">
      <header className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-brand">
          👀 학생 화면 미리보기
        </span>
        <h2 className="text-xl font-bold leading-snug">
          {title || "(제목 없음)"}
        </h2>
        <p className="text-xs text-muted">실제 제출은 되지 않아요.</p>
      </header>

      <div className="flex gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">학번</span>
          <input disabled className={inputClass + " max-w-[8rem] opacity-70"} />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="text-muted">이름</span>
          <input disabled className={inputClass + " opacity-70"} />
        </label>
      </div>

      {blocks.map((b) =>
        b.kind === "content" ? (
          <div
            key={b.id}
            className="flex flex-col gap-1 rounded-xl border border-border bg-card p-3 text-sm"
          >
            {b.label && (
              <span className="text-xs font-semibold text-muted">{b.label}</span>
            )}
            {b.contentType === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={b.value}
                alt={b.label ?? ""}
                className="max-w-full rounded-lg border border-border"
              />
            ) : b.contentType === "pdf" ? (
              <iframe
                src={b.value}
                title={b.label ?? "PDF"}
                className="h-96 w-full rounded-lg border border-border"
              />
            ) : b.contentType === "link" ? (
              (() => {
                const yt = youtubeEmbedUrl(b.value);
                return yt ? (
                  <div className="aspect-video w-full">
                    <iframe
                      src={yt}
                      title={b.label ?? "video"}
                      allowFullScreen
                      className="h-full w-full rounded-lg border border-border"
                    />
                  </div>
                ) : (
                  <a
                    href={b.value}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-brand underline"
                  >
                    {b.label || b.value}
                  </a>
                );
              })()
            ) : (
              <p className="whitespace-pre-wrap leading-relaxed text-foreground">
                {b.value}
              </p>
            )}
          </div>
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
  );
}
