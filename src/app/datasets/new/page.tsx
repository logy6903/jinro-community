import Link from "next/link";
import { DatasetUploadForm } from "@/components/DatasetUploadForm";
import { listCustomFieldKeys } from "@/lib/datasets/repository";

// Seed suggestions for the custom-field autocomplete, merged with keys already
// used across datasets so teachers converge on shared names.
const SUGGESTED_KEYS = ["지역", "전형유형", "난이도", "모집시기", "대상계열", "비고"];

export default async function NewDatasetPage() {
  const used = await listCustomFieldKeys();
  const suggestions = [...new Set([...used, ...SUGGESTED_KEYS])];

  return (
    <div className="flex flex-col gap-5">
      <Link href="/datasets" className="text-sm text-muted hover:text-foreground">
        ← 데이터로
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">엑셀 자료 올리기</h1>
        <p className="text-sm text-muted">
          쓰던 엑셀을 그대로 첨부하고, 위쪽 봉투 몇 칸만 채우면 됩니다. 올리기 전에
          표가 그대로 보입니다.
        </p>
      </div>

      <Link
        href="/datasets/from-pdf"
        className="flex items-center justify-between gap-2 rounded-2xl border border-brand/40 bg-brand-soft px-4 py-3 hover:bg-brand-soft/70"
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-brand">요강 PDF에서 표 뽑기 (베타)</span>
          <span className="text-xs text-muted">
            엑셀이 없어도 요강 PDF를 올리면 AI가 표를 찾아 정리해줍니다.
          </span>
        </span>
        <span className="shrink-0 text-brand">→</span>
      </Link>

      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <span className="text-sm font-medium">권장 템플릿 (선택)</span>
        <p className="text-xs text-muted">
          처음이라면 이 양식으로 시작하면 챗봇이 비교·검색하기 좋아요. (꼭 쓸 필요는
          없고, 쓰던 엑셀 그대로도 됩니다.)
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { href: "/templates/admission.xlsx", label: "입시·전형" },
            { href: "/templates/essay.xlsx", label: "논술" },
            { href: "/templates/career.xlsx", label: "진로·직업" },
          ].map((t) => (
            <a
              key={t.href}
              href={t.href}
              download
              className="rounded-full border border-border px-3 py-1.5 text-sm text-brand hover:border-brand"
            >
              ↓ {t.label} 템플릿
            </a>
          ))}
        </div>
      </div>

      <DatasetUploadForm fieldKeySuggestions={suggestions} />
    </div>
  );
}
