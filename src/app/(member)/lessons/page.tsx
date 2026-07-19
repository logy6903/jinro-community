import Link from "next/link";
import { getAllCards } from "@/lib/content/repository";
import {
  CATEGORY_EMOJI,
  CATEGORY_LABEL,
  SCHOOL_LEVEL_LABEL,
} from "@/lib/domain/labels";
import type { ContentCard, SchoolLevel } from "@/lib/domain/types";

// 수업 자료(원자료)를 골라 차시별 수업안을 만드는 진입 목록. 슬라이스1에선
// 기존 콘텐츠 카드를 원자료로 노출한다. 슬라이스2에서 교사가 올린 자료가
// 같은 목록에 합류한다.

export default async function LessonsIndexPage() {
  const cards = await getAllCards();
  const groups: { level: SchoolLevel; cards: ContentCard[] }[] = [
    { level: "middle", cards: cards.filter((c) => c.schoolLevel === "middle") },
    { level: "high", cards: cards.filter((c) => c.schoolLevel === "high") },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">수업 자료로 수업안 만들기</h1>
        <p className="text-sm text-muted">
          자료를 하나 고르면, 몇 차시로 어떻게 다룰지 정해 AI가 차시별 수업 계획
          초안을 짜드립니다.
        </p>
      </header>

      {groups.map((g) => (
        <section key={g.level} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted">
            {SCHOOL_LEVEL_LABEL[g.level]}
          </h2>
          <div className="flex flex-col gap-2">
            {g.cards.map((card) => (
              <Link
                key={card.id}
                href={`/lessons/${card.id}`}
                className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-brand"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span className="rounded-full bg-brand-soft px-2 py-0.5 font-medium text-brand">
                      {CATEGORY_EMOJI[card.category]}{" "}
                      {CATEGORY_LABEL[card.category]}
                    </span>
                  </div>
                  <h3 className="font-medium leading-snug">{card.title}</h3>
                  <p className="text-sm leading-relaxed text-muted">
                    {card.summary}
                  </p>
                </div>
                <span className="shrink-0 self-center text-sm text-brand">
                  수업안 만들기 →
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
