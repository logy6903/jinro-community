import Link from "next/link";
import { InfoFilters } from "@/components/InfoFilters";
import { facetLabel } from "@/lib/info/facets";
import { listInfoItems } from "@/lib/info/repository";
import { filterInfoItems, type FacetSelection } from "@/lib/info/query";
import { DATASET_CATEGORY_LABEL, DATASET_LEVEL_LABEL } from "@/lib/domain/labels";

// 정보 — the generated info (원문·소식·해설·데이터), browsable by the 6 facet
// axes. Filters live in the URL (?type=&category=…) so the server reads them
// and the list is shareable. Public; no login.

export default async function InfoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const sel: FacetSelection = {
    type: sp.type,
    category: sp.category,
    level: sp.level,
    grade: sp.grade,
    source: sp.source,
    timing: sp.timing,
  };
  const items = filterInfoItems(await listInfoItems(), sel);
  const pendingCount = items.filter((it) => it.reviewed === false).length;

  return (
    // 정보는 필터 브라우저(도구)라 읽기용 페이지보다 넓은 폭이 맞다.
    // 전역 max-w-3xl 밖으로 빼내 뷰포트 중앙에 넓은 컬럼으로 배치(스크롤바
    // 폭 고려해 100vw 대신 여백을 뺀 min()으로 캡).
    <div className="relative left-1/2 w-[min(100vw-2.5rem,72rem)] -translate-x-1/2">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold">정보</h1>
          <p className="text-sm text-muted">
            기관 발표·원문·해설·데이터를 6가지 기준으로 골라 봅니다.
          </p>
        </div>

      <InfoFilters />

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted">{items.length}건</p>
        {pendingCount > 0 && (
          <Link
            href="/info/review"
            className="text-xs font-medium text-brand hover:opacity-80"
          >
            검토 대기 {pendingCount}건 보정하기 →
          </Link>
        )}
      </div>

      {items.length > 0 ? (
        <div className="flex flex-col gap-3">
          {items.map((it) => {
            // 텍스트 콘텐츠(본문 有)는 상세 페이지로, 파일/외부는 원문 링크로.
            const hasBody = Boolean(it.body && it.body.trim());
            const href = hasBody ? `/info/${it.id}` : it.url;
            const external = !hasBody && it.url.startsWith("http");
            const inner = (
              <>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="rounded-full bg-brand-soft px-2 py-0.5 font-medium text-brand">
                    {facetLabel("type", it.type)}
                  </span>
                  <span>{DATASET_CATEGORY_LABEL[it.category]}</span>
                  <span>· {DATASET_LEVEL_LABEL[it.level]}</span>
                  {it.grade !== "all" && <span>· {facetLabel("grade", it.grade)}</span>}
                  {it.reviewed === false && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                      검토 대기
                    </span>
                  )}
                </div>
                <h3 className="text-base font-semibold leading-snug">{it.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground/80">
                  {it.summary}
                </p>
                <p className="mt-2 text-xs text-muted">
                  출처: {it.source} · {it.publishedAt.replace(/-/g, ".")}
                  {external && " · 원문 링크 ↗"}
                </p>
              </>
            );
            const cls =
              "block rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-md";
            return external ? (
              <a
                key={it.id}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={cls}
              >
                {inner}
              </a>
            ) : (
              <Link key={it.id} href={href} className={cls}>
                {inner}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted">
          선택한 조건에 맞는 정보가 없습니다. 필터를 조정해 보세요.
        </div>
      )}
      </div>
    </div>
  );
}
