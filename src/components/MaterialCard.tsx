import Link from "next/link";
import type { SharedMaterial } from "@/lib/domain/types";
import { CATEGORY_EMOJI, CATEGORY_LABEL } from "@/lib/domain/labels";

// One teacher-contributed material in list form.

export function MaterialCard({ material }: { material: SharedMaterial }) {
  return (
    <Link
      href={`/board/${material.id}`}
      className="block rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
    >
      <div className="mb-2 flex items-center gap-2 text-xs text-muted">
        <span className="rounded-full bg-brand-soft px-2 py-0.5 font-medium text-brand">
          {CATEGORY_EMOJI[material.category]} {CATEGORY_LABEL[material.category]}
        </span>
        {material.attachments && material.attachments.length > 0 && (
          <span>📎 {material.attachments.length}</span>
        )}
        {material.usedCount > 0 && (
          <span>👩‍🏫 {material.usedCount}명이 수업에 사용</span>
        )}
      </div>
      <h3 className="text-base font-semibold leading-snug">{material.title}</h3>
      {material.summary && (
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {material.summary}
        </p>
      )}
      <p className="mt-2 text-xs text-muted">
        {material.authorName} · {material.createdAt.slice(0, 10).replace(/-/g, ".")}
      </p>
    </Link>
  );
}
