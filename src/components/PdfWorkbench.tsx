"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PdfSource } from "@/lib/domain/types";

// 전체화면 요강 작업대. 왼쪽 = 원본 PDF 페이지(pdf.js canvas 렌더, 동일출처
// /api/pdf/[id]에서 로드 → CORS 무관), 오른쪽 = 표 추출 결과(다음 증분에서 채움).
// 표를 물리적으로 자르지 않고 페이지째 보여준다(주석이 표 밖에 있으므로).

const MIN_SCALE = 0.6;
const MAX_SCALE = 3;

export function PdfWorkbench({ source }: { source: PdfSource }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const loadingTaskRef = useRef<{ destroy: () => Promise<void> } | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.3);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 문서 1회 로드.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const task = pdfjs.getDocument({ url: `/api/pdf/${source.id}` });
        loadingTaskRef.current = task;
        const doc = await task.promise;
        if (cancelled) {
          void task.destroy();
          return;
        }
        docRef.current = doc;
        setNumPages(doc.numPages);
        setPage(1);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("PDF를 불러오지 못했습니다.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      void loadingTaskRef.current?.destroy();
      docRef.current = null;
      loadingTaskRef.current = null;
    };
  }, [source.id]);

  // 현재 페이지 렌더.
  const renderPage = useCallback(async () => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    renderTaskRef.current?.cancel();
    try {
      const pg = await doc.getPage(page);
      const viewport = pg.getViewport({ scale });
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const task = pg.render({ canvas, canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      await task.promise;
    } catch {
      /* 취소(RenderingCancelledException)나 페이지 변경 시 무시 */
    }
  }, [page, scale]);

  useEffect(() => {
    if (!loading && !error) void renderPage();
  }, [loading, error, renderPage]);

  const go = (d: number) =>
    setPage((p) => Math.min(numPages || 1, Math.max(1, p + d)));
  const zoom = (d: number) =>
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, +(s + d).toFixed(2))));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* 상단 바 */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-2.5">
        <Link
          href="/pdf"
          className="rounded-full border border-border px-3 py-1 text-sm text-muted hover:border-brand"
        >
          ← 목록
        </Link>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-semibold">
            {source.university}
          </span>
          <span className="truncate text-xs text-muted">
            {source.docType} · {source.admissionYear}학년도
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm">
          {/* 페이지 이동 */}
          <div className="flex items-center gap-1 rounded-full border border-border px-1">
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={page <= 1}
              className="px-2 py-0.5 text-muted hover:text-foreground disabled:opacity-40"
              aria-label="이전 페이지"
            >
              ◀
            </button>
            <span className="min-w-[4.5rem] text-center text-xs tabular-nums">
              {page} / {numPages || "…"}
            </span>
            <button
              type="button"
              onClick={() => go(1)}
              disabled={numPages > 0 && page >= numPages}
              className="px-2 py-0.5 text-muted hover:text-foreground disabled:opacity-40"
              aria-label="다음 페이지"
            >
              ▶
            </button>
          </div>
          {/* 확대 */}
          <div className="flex items-center gap-1 rounded-full border border-border px-1">
            <button
              type="button"
              onClick={() => zoom(-0.2)}
              className="px-2 py-0.5 text-muted hover:text-foreground"
              aria-label="축소"
            >
              −
            </button>
            <span className="w-10 text-center text-xs tabular-nums">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => zoom(0.2)}
              className="px-2 py-0.5 text-muted hover:text-foreground"
              aria-label="확대"
            >
              +
            </button>
          </div>
          {source.originalUrl && (
            <a
              href={source.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-border px-3 py-1 text-xs text-brand hover:border-brand"
            >
              원문 ↗
            </a>
          )}
        </div>
      </header>

      {/* 본문: 왼쪽 원본 | 오른쪽 작업 */}
      <div className="flex min-h-0 flex-1">
        <div className="flex-1 overflow-auto bg-neutral-100 p-4">
          {loading && (
            <p className="mt-10 text-center text-sm text-muted">
              원본을 불러오는 중…
            </p>
          )}
          {error && (
            <p className="mt-10 text-center text-sm text-red-600">{error}</p>
          )}
          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              className="rounded shadow-md"
              style={{ display: loading || error ? "none" : "block" }}
            />
          </div>
        </div>

        <aside className="w-96 shrink-0 overflow-auto border-l border-border bg-card p-4">
          <h2 className="text-sm font-semibold">표 추출 결과</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            다음 단계에서 이 자리에 붙습니다: 표 목록(Pass 1) → 표 선택 → 정밀
            추출(정규화 롱포맷) → 원본과 대조·수정 → 저장.
          </p>
          <p className="mt-3 rounded-lg bg-brand-soft p-3 text-xs leading-relaxed text-brand">
            왼쪽 원본 페이지를 넘겨보며 확인하세요. 추출 결과는 항상 이 원본과
            대조한 뒤 저장합니다.
          </p>
        </aside>
      </div>
    </div>
  );
}
