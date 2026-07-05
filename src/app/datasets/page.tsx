import Link from "next/link";
import { listDatasets } from "@/lib/datasets/repository";
import {
  DATASET_CATEGORY_LABEL,
  DATASET_LEVEL_LABEL,
} from "@/lib/domain/labels";

// 진학·진로 데이터 — teacher-uploaded structured tables. List is public
// (onion structure); uploading requires login (/datasets/new).

export default async function DatasetsPage() {
  const datasets = await listDatasets();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold">진학·진로 데이터</h1>
          <p className="text-sm text-muted">
            교사들이 정리한 표 자료. 챗봇이 여기서 찾아 답합니다.
          </p>
        </div>
        <Link
          href="/datasets/new"
          className="shrink-0 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          엑셀 올리기
        </Link>
      </div>

      {datasets.length > 0 ? (
        <div className="flex flex-col gap-3">
          {datasets.map((d) => (
            <Link
              key={d.id}
              href={`/datasets/${d.id}`}
              className="block rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="rounded-full bg-brand-soft px-2 py-0.5 font-medium text-brand">
                  {DATASET_CATEGORY_LABEL[d.category]}
                </span>
                <span>{DATASET_LEVEL_LABEL[d.schoolLevel]}</span>
                {d.year && <span>· {d.year}</span>}
                <span>· {d.rowCount}행</span>
              </div>
              <h3 className="text-base font-semibold leading-snug">{d.title}</h3>
              <p className="mt-2 text-xs text-muted">
                {d.authorName}
                {d.source && ` · 출처: ${d.source}`} ·{" "}
                {d.createdAt.slice(0, 10).replace(/-/g, ".")}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted">
          아직 올라온 데이터가 없습니다. 첫 엑셀을 올려보세요.
        </div>
      )}
    </div>
  );
}
