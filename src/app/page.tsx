import { ActivityCard } from "@/components/ActivityCard";
import { SchoolLevelToggle } from "@/components/SchoolLevelToggle";
import { getActivePeriods } from "@/lib/calendar/engine";
import { getCardsForNow } from "@/lib/content/query";
import { parseSchoolLevel, SCHOOL_LEVEL_LABEL } from "@/lib/domain/labels";

// Home = 시기별 추천. The page reads `?level=` to load the right track's
// cards, so it opts into dynamic rendering (searchParams) — correct here
// because what surfaces depends on today's date.

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ level?: string }>;
}) {
  const level = parseSchoolLevel((await searchParams).level);
  const periods = getActivePeriods(level);
  const cards = await getCardsForNow(level);
  const period = periods[0];

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <SchoolLevelToggle active={level} />
        <div className="rounded-2xl bg-brand-soft px-5 py-4">
          <p className="text-xs font-medium text-brand">
            {SCHOOL_LEVEL_LABEL[level]} · 지금 시기
          </p>
          <h1 className="mt-1 text-xl font-bold leading-snug">
            {period ? period.label : "상시 진로활동"}
          </h1>
          {period && (
            <p className="mt-1 text-sm leading-relaxed text-foreground/80">
              {period.hint}
            </p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted">
          이번 시기에 바로 쓸 수 있는 자료 {cards.length}개
        </h2>
        {cards.length > 0 ? (
          <div className="flex flex-col gap-3">
            {cards.map((card) => (
              <ActivityCard key={card.id} card={card} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted">
            이 시기 자료를 준비 중입니다.
          </p>
        )}
      </section>
    </div>
  );
}
