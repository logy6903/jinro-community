import Link from "next/link";
import { listSources } from "@/lib/sources/repository";

// 요강 PDF 목록 (Storage에 올라간 원본). 여기서 하나 골라 작업대(/pdf/[id])로
// 들어가 표를 추출·검증한다. 목록 열람은 공개, 추출(작업대)은 로그인 게이트.

export default async function PdfListPage() {
  const sources = await listSources();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">요강 PDF 작업실</h1>
        <p className="text-sm text-muted">
          Storage에 올라간 요강 원본 목록입니다. 하나를 골라 표를 추출·검증합니다.
        </p>
      </div>

      {sources.length > 0 ? (
        <div className="flex flex-col gap-3">
          {sources.map((s) => (
            <Link
              key={s.id}
              href={`/pdf/${s.id}`}
              className="block rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="rounded-full bg-brand-soft px-2 py-0.5 font-medium text-brand">
                  {s.docType}
                </span>
                <span>{s.admissionYear}학년도</span>
                {s.region && <span>· {s.region}</span>}
                <span>· {s.univType}</span>
              </div>
              <h3 className="text-base font-semibold leading-snug">
                {s.university}
              </h3>
              <p className="mt-2 text-xs text-muted">
                {s.targetGrade}
                {s.publishedAt && ` · ${s.publishedAt} 발행`}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted">
          아직 등록된 요강 PDF가 없습니다.
        </div>
      )}
    </div>
  );
}
