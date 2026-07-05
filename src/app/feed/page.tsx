import { listFeedItems } from "@/lib/feed/repository";

// 정보 집계 피드 — auto-collected external info (정책/입시 등). Public, read-only.
// Items link out to their source. Depends on collected data, so request-time.

export default async function FeedPage() {
  const items = await listFeedItems();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">정보 모아보기</h1>
        <p className="text-sm text-muted">
          교육부 등 공식 출처의 최신 정책·발표를 자동으로 모읍니다.
        </p>
      </div>

      {items.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <div className="mb-1 flex items-center gap-2 text-xs text-muted">
                <span className="rounded-full bg-brand-soft px-2 py-0.5 font-medium text-brand">
                  {item.source}
                </span>
                <span>{item.publishedAt.slice(0, 10).replace(/-/g, ".")}</span>
              </div>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[15px] font-medium leading-snug hover:text-brand"
              >
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted">
          아직 수집된 정보가 없습니다. (수집 실행: <code>npm run collect</code>)
        </div>
      )}
    </div>
  );
}
