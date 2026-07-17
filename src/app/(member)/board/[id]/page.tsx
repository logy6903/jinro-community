import Link from "next/link";
import { notFound } from "next/navigation";
import { getMaterialById } from "@/lib/materials/repository";
import {
  CATEGORY_EMOJI,
  CATEGORY_LABEL,
  SCHOOL_LEVEL_LABEL,
} from "@/lib/domain/labels";

// Public detail view of a shared material.

export default async function MaterialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const material = await getMaterialById(id);
  if (!material) notFound();

  const paragraphs = material.body.split("\n\n");

  return (
    <article className="flex flex-col gap-5">
      <Link href="/board" className="text-sm text-muted hover:text-foreground">
        ← 게시판으로
      </Link>

      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="rounded-full bg-brand-soft px-2 py-0.5 font-medium text-brand">
            {CATEGORY_EMOJI[material.category]} {CATEGORY_LABEL[material.category]}
          </span>
          <span>{SCHOOL_LEVEL_LABEL[material.schoolLevel]}</span>
        </div>
        <h1 className="text-2xl font-bold leading-snug">{material.title}</h1>
        {material.summary && (
          <p className="text-sm leading-relaxed text-muted">{material.summary}</p>
        )}
        <p className="text-xs text-muted">
          {material.authorName} ·{" "}
          {material.createdAt.slice(0, 10).replace(/-/g, ".")}
        </p>
      </header>

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 text-[15px] leading-7">
        {paragraphs.map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>

      <p className="border-t border-border pt-4 text-xs leading-relaxed text-muted">
        {material.authorName} 선생님이 공유한 자료입니다.
      </p>
    </article>
  );
}
