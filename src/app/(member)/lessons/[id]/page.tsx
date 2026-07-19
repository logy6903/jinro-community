import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonPlanner } from "@/components/lessons/LessonPlanner";
import { getCardById } from "@/lib/content/repository";
import {
  CATEGORY_EMOJI,
  CATEGORY_LABEL,
  SCHOOL_LEVEL_LABEL,
} from "@/lib/domain/labels";

// 원자료 1건을 골라 차시별 수업안을 생성하는 페이지. 슬라이스1의 원자료는
// 기존 콘텐츠 카드(ContentCard)를 재사용한다. 페이지는 공개지만 실제 생성(AI)은
// 로그인 교사만 — 게이트는 LessonPlanner 안에서 처리.

export default async function LessonGeneratePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const card = await getCardById(id);
  if (!card) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link href="/lessons" className="text-sm text-muted hover:text-foreground">
        ← 수업 자료 고르기
      </Link>

      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="rounded-full bg-brand-soft px-2 py-0.5 font-medium text-brand">
            {CATEGORY_EMOJI[card.category]} {CATEGORY_LABEL[card.category]}
          </span>
          <span>{SCHOOL_LEVEL_LABEL[card.schoolLevel]}</span>
          <span>· 원자료</span>
        </div>
        <h1 className="text-2xl font-bold leading-snug">{card.title}</h1>
        <p className="text-sm leading-relaxed text-muted">{card.summary}</p>
      </header>

      <LessonPlanner
        source={{
          id: card.id,
          title: card.title,
          schoolLevel: card.schoolLevel,
        }}
      />
    </div>
  );
}
