import Link from "next/link";
import { notFound } from "next/navigation";
import { getDatasetById } from "@/lib/datasets/repository";
import {
  DATASET_CATEGORY_LABEL,
  DATASET_LEVEL_LABEL,
} from "@/lib/domain/labels";

// Public dataset detail: the envelope header + the full table (the "내용물").

export default async function DatasetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dataset = await getDatasetById(id);
  if (!dataset) notFound();

  return (
    <article className="flex flex-col gap-5">
      <Link href="/datasets" className="text-sm text-muted hover:text-foreground">
        ← 데이터로
      </Link>

      {/* 봉투 */}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="rounded-full bg-brand-soft px-2 py-0.5 font-medium text-brand">
            {DATASET_CATEGORY_LABEL[dataset.category]}
          </span>
          <span>{DATASET_LEVEL_LABEL[dataset.schoolLevel]}</span>
          {dataset.year && <span>· {dataset.year}</span>}
        </div>
        <h1 className="text-2xl font-bold leading-snug">{dataset.title}</h1>
        <p className="text-xs text-muted">
          {dataset.authorName}
          {dataset.source && ` · 출처: ${dataset.source}`} ·{" "}
          {dataset.createdAt.slice(0, 10).replace(/-/g, ".")} · 총{" "}
          {dataset.rowCount}행
        </p>
        {dataset.customFields.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs">
            {dataset.customFields.map((f, i) => (
              <span
                key={i}
                className="rounded-full border border-border px-2 py-0.5 text-muted"
              >
                {f.key}: {f.value}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* 내용물 */}
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-brand-soft">
            <tr>
              {dataset.columns.map((c, i) => (
                <th
                  key={i}
                  className="whitespace-nowrap px-3 py-2 text-left font-medium text-brand"
                >
                  {c || `(빈 열 ${i + 1})`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataset.rows.map((row, ri) => (
              <tr key={ri} className="border-t border-border">
                {dataset.columns.map((_, ci) => (
                  <td
                    key={ci}
                    className="whitespace-nowrap px-3 py-1.5 text-foreground/80"
                  >
                    {row[ci]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dataset.rowCount > dataset.rows.length && (
        <p className="text-xs text-muted">
          전체 {dataset.rowCount}행 중 {dataset.rows.length}행 저장됨 (MVP 상한).
        </p>
      )}
    </article>
  );
}
