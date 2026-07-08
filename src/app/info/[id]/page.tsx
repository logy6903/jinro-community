import Link from "next/link";
import { notFound } from "next/navigation";
import { facetLabel } from "@/lib/info/facets";
import { getInfoItemById } from "@/lib/info/repository";
import { DATASET_CATEGORY_LABEL, DATASET_LEVEL_LABEL } from "@/lib/domain/labels";

// 정보 상세 — 해설·브리핑 등 텍스트 콘텐츠의 본문을 보여준다. 파일/외부
// 링크형 아이템은 본문이 없으니 원문 링크로 안내. 공개(비로그인).

export default async function InfoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await getInfoItemById(id);
  if (!item) notFound();

  const paragraphs = (item.body ?? "").split(/\n{2,}/).filter((p) => p.trim());

  return (
    <article className="flex flex-col gap-5">
      <Link href="/info" className="text-sm text-brand hover:opacity-80">
        ← 정보로
      </Link>

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="rounded-full bg-brand-soft px-2 py-0.5 font-medium text-brand">
            {facetLabel("type", item.type)}
          </span>
          <span>{DATASET_CATEGORY_LABEL[item.category]}</span>
          <span>· {DATASET_LEVEL_LABEL[item.level]}</span>
          {item.grade !== "all" && <span>· {facetLabel("grade", item.grade)}</span>}
        </div>
        <h1 className="text-xl font-bold leading-snug">{item.title}</h1>
        <p className="text-xs text-muted">
          출처: {item.source} · {item.publishedAt.replace(/-/g, ".")}
        </p>
      </header>

      {paragraphs.length > 0 ? (
        <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-foreground/90">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">{item.summary}</p>
      )}

      {item.url && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          원문 자료 보기 ↗
        </a>
      )}

      <footer className="mt-2 border-t border-border pt-4 text-xs text-muted">
        이 자료는 I&amp;AI 미래역량교육연구소가 만들고 정리합니다.
      </footer>
    </article>
  );
}
