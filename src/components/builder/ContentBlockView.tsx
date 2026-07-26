"use client";

import type { ContentBlock } from "@/lib/builder/types";
import { linkEmbed, officeEmbedUrl } from "@/lib/builder/embed";

/**
 * Two-pane activity layout: 자료 on the left, 문항 on the right. A student has
 * to keep looking at the material *while* answering, so stacking them made the
 * material scroll out of view the moment they started writing.
 */
export const ACTIVITY_GRID =
  "lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start lg:gap-6";

/**
 * The activity needs more room than the site's max-w-3xl reading column, or the
 * two panes squeeze the video down to thumbnail size. Breaks out of the parent
 * container to the viewport (leaving 0.5rem each side for the scrollbar) and
 * re-centres at a wider cap. Only applied when there is a 자료 pane.
 */
export const ACTIVITY_BLEED =
  "lg:mx-[calc(50%-50vw+0.5rem)] lg:w-[calc(100vw-1rem)] lg:px-4";

export const ACTIVITY_INNER = "lg:mx-auto lg:max-w-[78rem]";

/** The pinned 자료 column. Sticky on both mobile (short) and desktop (tall). */
export function MaterialPane({ blocks }: { blocks: ContentBlock[] }) {
  if (blocks.length === 0) return null;
  return (
    <aside className="sticky top-0 z-10 mb-5 flex max-h-[52vh] flex-col gap-3 overflow-y-auto bg-background pb-3 lg:top-4 lg:mb-0 lg:max-h-[calc(100vh-2rem)] lg:pb-0">
      {blocks.map((b) => (
        <ContentBlockView key={b.id} block={b} variant="pane" />
      ))}
    </aside>
  );
}

// One 제시 자료, rendered the same way everywhere (student page, teacher
// preview). Kept in one place so the two never drift apart.
//
// `variant` controls sizing only:
//   - "pane"   : lives in the pinned 자료 pane beside the questions → fills it
//   - "inline" : stacked in the question flow → fixed, modest height

export function ContentBlockView({
  block,
  variant = "inline",
}: {
  block: ContentBlock;
  variant?: "pane" | "inline";
}) {
  const docFrame =
    variant === "pane"
      ? "h-[42vh] lg:h-[calc(100vh-11rem)] lg:min-h-[24rem] w-full"
      : "h-96 w-full";

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-3 text-sm">
      {block.label && (
        <span className="text-xs font-semibold text-muted">{block.label}</span>
      )}
      {block.contentType === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={block.value}
          alt={block.label ?? ""}
          className="max-w-full rounded-lg border border-border"
        />
      ) : block.contentType === "pdf" ? (
        <iframe
          src={block.value}
          title={block.label ?? "PDF"}
          className={docFrame + " rounded-lg border border-border"}
        />
      ) : block.contentType === "office" ? (
        (() => {
          const src = officeEmbedUrl(block.value);
          return src ? (
            <iframe
              src={src}
              title={block.label ?? "문서"}
              allowFullScreen
              className={docFrame + " rounded-lg border border-border"}
            />
          ) : (
            <a
              href={block.value}
              target="_blank"
              rel="noreferrer"
              className="break-all text-brand underline"
            >
              {block.label || block.value}
            </a>
          );
        })()
      ) : block.contentType === "link" ? (
        (() => {
          const embed = linkEmbed(block.value);
          if (!embed) {
            return (
              <a
                href={block.value}
                target="_blank"
                rel="noreferrer"
                className="break-all text-brand underline"
              >
                {block.label || block.value}
              </a>
            );
          }
          return embed.kind === "video" ? (
            <div className="aspect-video w-full">
              <iframe
                src={embed.src}
                title={block.label ?? "video"}
                allowFullScreen
                className="h-full w-full rounded-lg border border-border"
              />
            </div>
          ) : (
            <iframe
              src={embed.src}
              title={block.label ?? "문서"}
              allowFullScreen
              className={docFrame + " rounded-lg border border-border"}
            />
          );
        })()
      ) : (
        <p className="whitespace-pre-wrap leading-relaxed text-foreground">
          {block.value}
        </p>
      )}
    </div>
  );
}
