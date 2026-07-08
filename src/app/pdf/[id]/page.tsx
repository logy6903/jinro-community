import Link from "next/link";
import { notFound } from "next/navigation";
import { getSourceById } from "@/lib/sources/repository";

// 요강 상세 + 작업대 진입점. 지금은 원본 메타 + 원문 열기까지(증분 1).
// 다음 증분: 왼쪽 pdf.js 렌더 + 오른쪽 추출·편집(작업대 shell).

export default async function PdfSourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const s = await getSourceById(id);
  if (!s) notFound();

  const rows: [string, string][] = [
    ["대학", `${s.university} (${s.univType})`],
    ["문서", s.docType],
    ["학년도", `${s.admissionYear}학년도 · 수능 ${s.examYear}년`],
    ["지역", s.region + (s.isCapitalArea ? " (수도권)" : "")],
    ["대상", s.targetGrade],
    ["발행", s.publishedAt || "-"],
  ];

  return (
    <div className="flex flex-col gap-5">
      <Link href="/pdf" className="text-sm text-muted hover:text-foreground">
        ← 요강 목록
      </Link>

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">{s.university}</h1>
        <p className="text-sm text-muted">{s.docType}</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <dl className="divide-y divide-border text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex gap-3 px-4 py-2.5">
              <dt className="w-20 shrink-0 text-muted">{k}</dt>
              <dd className="text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex flex-wrap gap-2">
        {s.originalUrl && (
          <a
            href={s.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-border px-4 py-2 text-sm text-brand hover:border-brand"
          >
            원문 PDF 열기 ↗
          </a>
        )}
        {s.sourceUrl && (
          <a
            href={s.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-border px-4 py-2 text-sm text-muted hover:border-brand"
          >
            대학 원본 출처 ↗
          </a>
        )}
      </div>

      <div className="rounded-2xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted">
        표 추출·검증 작업대는 다음 단계에서 붙습니다.
        <br />
        (왼쪽 원본 페이지 · 오른쪽 추출 결과 편집)
      </div>
    </div>
  );
}
