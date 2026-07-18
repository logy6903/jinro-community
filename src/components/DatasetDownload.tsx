"use client";

import { useState } from "react";

// 데이터셋 다운로드 버튼 묶음. 페이지 자체가 회원 게이트라 다운로드=회원 전용이
// 자연히 충족된다. 엑셀은 화면의 표(columns/rows)에서 클라이언트로 즉석 생성하고,
// 출처 PDF 페이지는 서버 라우트(/api/pdf/[id]/page)가 원본에서 잘라 보낸다.

interface Props {
  title: string;
  columns: string[];
  rows: string[][];
  /** PDF에서 추출된 경우에만: 원본 소스 id + 페이지 범위. */
  sourceId?: string;
  sourcePage?: number;
  sourceEndPage?: number;
}

/** 파일명에 안전한 형태로 정리 (공백→_, 특수문자 제거). */
function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "_").slice(0, 80) || "dataset";
}

export function DatasetDownload({
  title,
  columns,
  rows,
  sourceId,
  sourcePage,
  sourceEndPage,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function downloadExcel() {
    if (busy) return;
    setBusy(true);
    try {
      // 번들을 키우지 않도록 클릭 시에만 로드.
      const XLSX = await import("xlsx");
      const aoa = [columns, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "data");
      XLSX.writeFile(wb, `${safeName(title)}.xlsx`);
    } finally {
      setBusy(false);
    }
  }

  const hasPdf = Boolean(sourceId && sourcePage);
  const pdfHref = hasPdf
    ? `/api/pdf/${sourceId}/page?start=${sourcePage}&end=${sourceEndPage ?? sourcePage}`
    : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={downloadExcel}
        disabled={busy || rows.length === 0}
        className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "만드는 중…" : "엑셀 다운로드"}
      </button>
      {pdfHref && (
        <a
          href={pdfHref}
          className="rounded-full border border-brand/40 px-4 py-2 text-sm font-medium text-brand hover:bg-brand-soft"
        >
          출처 PDF 페이지 내려받기
        </a>
      )}
    </div>
  );
}
