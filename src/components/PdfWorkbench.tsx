"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { PdfSource } from "@/lib/domain/types";
import type { TableMapEntry } from "@/lib/extract/types";

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

  const { user, signInWithGoogle } = useAuth();
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.3);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pass 1 표 지도 (오른쪽 worklist).
  const [tables, setTables] = useState<TableMapEntry[] | null>(null);
  const [mapping, setMapping] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

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

  async function runMap() {
    if (mapping) return;
    if (!user) {
      await signInWithGoogle();
      return;
    }
    setMapping(true);
    setMapError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/pdf/${source.id}/map`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setMapError(
          res.status === 503
            ? "추출 기능이 아직 설정되지 않았어요. (관리자: ANTHROPIC_API_KEY 필요)"
            : "표 목록을 만들지 못했습니다. 잠시 후 다시 시도해주세요.",
        );
        return;
      }
      const data = (await res.json()) as { tables: TableMapEntry[] };
      setTables(data.tables);
    } catch {
      setMapError("네트워크 오류가 발생했습니다.");
    } finally {
      setMapping(false);
    }
  }

  function selectTable(t: TableMapEntry) {
    setSelectedTableId(t.id);
    setPage(Math.max(1, Math.min(numPages || t.page, t.page)));
  }

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

        <aside className="flex w-96 shrink-0 flex-col overflow-hidden border-l border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <h2 className="text-sm font-semibold">표 목록</h2>
            {tables && <span className="text-xs text-muted">{tables.length}개</span>}
          </div>

          <div className="flex-1 overflow-auto p-3">
            {!tables && !mapping && (
              <div className="flex flex-col gap-3">
                <p className="text-xs leading-relaxed text-muted">
                  AI가 이 요강의 표를 찾아 목록으로 만듭니다. 표를 누르면 왼쪽 원본이
                  그 페이지로 이동해요.
                </p>
                <button
                  type="button"
                  onClick={() => void runMap()}
                  className="self-start rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  표 목록 만들기
                </button>
                {!user && (
                  <p className="text-xs text-muted">
                    로그인 후 이용할 수 있어요. (AI 추출은 유료)
                  </p>
                )}
              </div>
            )}

            {mapping && (
              <p className="text-sm text-muted">
                표를 찾는 중… (요강 분량에 따라 1~2분 걸릴 수 있어요)
              </p>
            )}
            {mapError && <p className="text-sm text-red-600">{mapError}</p>}

            {tables && (
              <div className="flex flex-col gap-1.5">
                {tables.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => selectTable(t)}
                    className={
                      "flex flex-col gap-1 rounded-lg border px-3 py-2 text-left transition-colors " +
                      (selectedTableId === t.id
                        ? "border-brand bg-brand-soft"
                        : "border-border hover:border-brand")
                    }
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-full bg-brand-soft px-1.5 py-0.5 text-[10px] font-medium text-brand">
                        {t.kind}
                      </span>
                      {t.hasNotes && (
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                          style={{ background: "#FAEEDA", color: "#854F0B" }}
                          title="※ 주석 있음"
                        >
                          ※
                        </span>
                      )}
                      <span className="ml-auto text-[10px] text-muted">{t.page}p</span>
                    </div>
                    <span className="text-xs leading-snug">{t.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
