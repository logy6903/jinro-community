import Link from "next/link";
import type { ContentCard } from "@/lib/domain/types";
import { CATEGORY_EMOJI, CATEGORY_LABEL } from "@/lib/domain/labels";

// The share-unit, in list form. The whole face links to the detail page so a
// teacher can open it and grab the link in one move.

export function ActivityCard({ card }: { card: ContentCard }) {
  return (
    <Link
      href={`/card/${card.id}`}
      className="block rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
    >
      <div className="mb-2 flex items-center gap-2 text-xs text-muted">
        <span className="rounded-full bg-brand-soft px-2 py-0.5 font-medium text-brand">
          {CATEGORY_EMOJI[card.category]} {CATEGORY_LABEL[card.category]}
        </span>
        {card.usedCount > 0 && (
          <span aria-label="실제 수업에 사용된 횟수">
            👩‍🏫 {card.usedCount}명이 수업에 사용
          </span>
        )}
      </div>
      <h3 className="text-base font-semibold leading-snug">{card.title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted">{card.summary}</p>
    </Link>
  );
}
