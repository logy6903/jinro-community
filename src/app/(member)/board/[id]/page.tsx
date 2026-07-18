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

  const paragraphs = material.body.trim() ? material.body.split("\n\n") : [];
  const attachments = material.attachments ?? [];

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

      {paragraphs.length > 0 && (
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 text-[15px] leading-7">
          {paragraphs.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      )}

      {attachments.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-muted">첨부 파일</h2>
          <ul className="flex flex-col gap-2">
            {attachments.map((a, i) => (
              <li key={i}>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-brand hover:bg-brand-soft"
                >
                  <span aria-hidden>📎</span>
                  <span className="truncate">{a.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted">내려받기 ↓</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="border-t border-border pt-4 text-xs leading-relaxed text-muted">
        {material.authorName} 선생님이 공유한 자료입니다.
      </p>
    </article>
  );
}
