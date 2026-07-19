import Link from "next/link";
import { notFound } from "next/navigation";
import { ShareButton } from "@/components/ShareButton";
import { UsedButton } from "@/components/UsedButton";
import { CARDS } from "@/lib/content/cards";
import { getCardById } from "@/lib/content/query";
import {
  CATEGORY_EMOJI,
  CATEGORY_LABEL,
  SCHOOL_LEVEL_LABEL,
} from "@/lib/domain/labels";

// Individual share-unit. Public — no login wall, per the onion-structure
// principle (core content is never hidden behind sign-up).

// Pre-render the seed cards at build; Firestore-only cards still resolve at
// request time (dynamicParams defaults to true).
export function generateStaticParams() {
  return CARDS.map((card) => ({ id: card.id }));
}

export default async function CardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const card = await getCardById(id);
  if (!card) notFound();

  const paragraphs = card.body.split("\n\n");

  return (
    <article className="flex flex-col gap-5">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ← 목록으로
      </Link>

      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="rounded-full bg-brand-soft px-2 py-0.5 font-medium text-brand">
            {CATEGORY_EMOJI[card.category]} {CATEGORY_LABEL[card.category]}
          </span>
          <span>{SCHOOL_LEVEL_LABEL[card.schoolLevel]}</span>
        </div>
        <h1 className="text-2xl font-bold leading-snug">{card.title}</h1>
        <p className="text-sm leading-relaxed text-muted">{card.summary}</p>
      </header>

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 text-[15px] leading-7">
        {paragraphs.map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>

      {card.attachments && card.attachments.length > 0 && (
        <ul className="flex flex-col gap-2">
          {card.attachments.map((file) => (
            <li key={file.url}>
              <a
                href={file.url}
                className="text-sm text-brand underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                📎 {file.name}
              </a>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <ShareButton path={`/card/${card.id}`} title={card.title} />
        <UsedButton cardId={card.id} initialCount={card.usedCount} />
      </div>

      <Link
        href={`/lessons/${card.id}`}
        className="flex items-center justify-between gap-3 rounded-2xl border border-brand/40 bg-brand-soft/40 px-5 py-4 transition-colors hover:bg-brand-soft"
      >
        <span className="flex flex-col">
          <span className="text-sm font-semibold text-brand">
            이 자료로 차시별 수업안 만들기
          </span>
          <span className="text-xs text-muted">
            몇 차시로, 어떻게 다룰지 정하면 AI가 계획 초안을 짜드립니다.
          </span>
        </span>
        <span className="shrink-0 text-brand">→</span>
      </Link>

      <p className="border-t border-border pt-4 text-xs leading-relaxed text-muted">
        출처 · {card.source}. 누구나 보고 공유할 수 있으며, 공유 시 출처 표기를
        남겨주세요.
      </p>
    </article>
  );
}
