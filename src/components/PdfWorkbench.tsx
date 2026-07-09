"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { Dataset, PdfSource } from "@/lib/domain/types";
import type { TableMapEntry } from "@/lib/extract/types";
import { TableExtractPanel, type PreloadedDraft } from "./TableExtractPanel";

// 전체화면 요강 작업대. 왼쪽 = 원본 PDF 페이지(pdf.js canvas 렌더, 동일출처
// /api/pdf/[id]에서 로드 → CORS 무관), 오른쪽 = 표 추출 결과(다음 증분에서 채움).
// 표를 물리적으로 자르지 않고 페이지째 보여준다(주석이 표 밖에 있으므로).

const MIN_SCALE = 0.6;
const MAX_SCALE = 3;

export function PdfWorkbench({ source }: { source: PdfSource }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
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
  const [activeTable, setActiveTable] = useState<TableMapEntry | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  // 오른쪽(작업) 단 너비 — 드래그로 조절(작은 모니터 대응).
  const [rightWidth, setRightWidth] = useState(400);

  // 배치로 미리 뽑아둔 저장본(draft/published). 있으면 "검수 모드"가 된다.
  const [drafts, setDrafts] = useState<Dataset[] | null>(null);
  const [activeDraft, setActiveDraft] = useState<Dataset | null>(null);
  // 시행 일자 확인 게이트 — 체크해야 공개 가능.
  const [dateConfirmed, setDateConfirmed] = useState(false);
  const reviewMode = !!(drafts && drafts.length > 0);

  const loadDrafts = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/pdf/${source.id}/drafts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const { datasets } = (await res.json()) as { datasets: Dataset[] };
        setDrafts(datasets);
      }
    } catch {
      /* ignore */
    }
  }, [user, source.id]);

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts]);

  // 요강에서 확인되는 대표 일자(PDF 실제 날짜) — 검수자가 시기를 눈으로 확인하도록.
  // 이미 뽑아둔 일정표 draft 행에서 날짜 패턴을 찾는다(접수일 우선). 추가 비용 0.
  const detectedDate = useMemo(() => {
    if (!drafts) return null;
    const re = /20\d{2}\s*[.\-]\s*\d{1,2}\s*[.\-]\s*\d{1,2}/;
    let fallback: { date: string; where: string } | null = null;
    for (const d of drafts) {
      for (const row of d.rows) {
        const text = row.join(" ");
        const m = text.match(re);
        if (!m) continue;
        const hit = { date: m[0].replace(/\s+/g, ""), where: d.title };
        if (/접수/.test(text)) return hit;
        if (!fallback) fallback = hit;
      }
    }
    return fallback;
  }, [drafts]);

  function shortTitle(t: string): string {
    return t.startsWith(source.university + " ") ? t.slice(source.university.length + 1) : t;
  }

  function openDraft(d: Dataset) {
    setActiveDraft(d);
    setActiveTable({
      id: d.id,
      title: shortTitle(d.title),
      page: d.sourcePage ?? 1,
      endPage: d.sourceEndPage,
      kind: "기타",
      hasNotes: false,
      location: "",
    });
    setPage(Math.max(1, Math.min(numPages || (d.sourcePage ?? 1), d.sourcePage ?? 1)));
  }

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

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      // 컨테이너 우측 끝 - 커서 X = 오른쪽 단 너비 (innerWidth 비의존, 어디서나 정확).
      const rect = bodyRef.current?.getBoundingClientRect();
      if (!rect) return;
      const w = rect.right - ev.clientX;
      setRightWidth(Math.max(300, Math.min(rect.width - 320, w)));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

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
    setActiveDraft(null); // 라이브 추출 경로 — 저장본 아님
    setActiveTable(t);
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
      <div ref={bodyRef} className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-auto bg-neutral-100 p-4">
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

        {/* 드래그 구분선 — 좌우 단 너비 조절 */}
        <div
          onMouseDown={startResize}
          title="드래그해서 너비 조절"
          className="w-1.5 shrink-0 cursor-col-resize bg-border transition-colors hover:bg-brand"
        />

        <aside
          style={{ width: rightWidth }}
          className="flex shrink-0 flex-col overflow-hidden bg-card"
        >
          {activeTable ? (
            <TableExtractPanel
              key={activeTable.id}
              source={source}
              table={activeTable}
              preloaded={
                activeDraft
                  ? ({
                      datasetId: activeDraft.id,
                      title: activeDraft.title,
                      category: activeDraft.category,
                      schoolLevel: activeDraft.schoolLevel,
                      columns: activeDraft.columns,
                      rows: activeDraft.rows,
                      customFields: activeDraft.customFields,
                    } satisfies PreloadedDraft)
                  : undefined
              }
              canPublish={dateConfirmed}
              onBack={() => {
                setActiveTable(null);
                setActiveDraft(null);
              }}
              onSaved={(tableId) => {
                setSavedIds((s) => new Set(s).add(tableId));
                setActiveTable(null);
                setActiveDraft(null);
                void loadDrafts();
              }}
            />
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <h2 className="text-sm font-semibold">
                  {reviewMode ? "검수 대기 표" : "표 목록"}
                </h2>
                <span className="text-xs text-muted">
                  {reviewMode ? `${drafts!.length}개` : tables ? `${tables.length}개` : ""}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-3 overflow-auto p-3">
                {reviewMode && (
                  <>
                    {/* 시행 일자 확인 게이트 — PDF 실제 날짜로 시기 확인 후 공개 */}
                    <div className="rounded-lg border border-brand/40 bg-brand-soft/40 p-2.5">
                      <p className="text-xs font-semibold text-brand">📅 시행 일자 확인</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-foreground/80">
                        {detectedDate ? (
                          <>
                            요강에서 확인된 일자: <b>{detectedDate.date}</b>{" "}
                            <span className="text-muted">({shortTitle(detectedDate.where).slice(0, 16)}…)</span>
                            <br />
                            등록 학년도 <b>{source.admissionYear}</b>와 맞는지 왼쪽 원본으로 확인하세요.
                          </>
                        ) : (
                          <>
                            일정표에서 날짜를 자동 인식하지 못했어요. 왼쪽 원본의 일정으로{" "}
                            <b>{source.admissionYear}학년도</b>가 맞는지 직접 확인하세요.
                          </>
                        )}
                      </p>
                      <label className="mt-2 flex items-start gap-2 text-[11px] font-medium text-foreground">
                        <input
                          type="checkbox"
                          checked={dateConfirmed}
                          onChange={(e) => setDateConfirmed(e.target.checked)}
                          className="mt-0.5"
                        />
                        <span>시행 일자 확인함 — {source.admissionYear}학년도가 맞습니다 (체크해야 공개 가능)</span>
                      </label>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {drafts!.map((d) => {
                        const published = d.status === "published";
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => openDraft(d)}
                            className={
                              "flex flex-col gap-1 rounded-lg border px-3 py-2 text-left transition-colors " +
                              (published
                                ? "border-green-500/40 bg-green-50/50"
                                : "border-border hover:border-brand")
                            }
                          >
                            <div className="flex items-center gap-1.5">
                              {published ? (
                                <span className="text-[10px] font-medium text-green-600">✓ 공개됨</span>
                              ) : (
                                <span className="rounded-full bg-brand-soft px-1.5 py-0.5 text-[10px] font-medium text-brand">
                                  검수 대기
                                </span>
                              )}
                              <span className="ml-auto text-[10px] text-muted">
                                {d.sourcePage}
                                {d.sourceEndPage && d.sourceEndPage > (d.sourcePage ?? 0)
                                  ? `~${d.sourceEndPage}`
                                  : ""}
                                p · {d.rowCount}행
                              </span>
                            </div>
                            <span className="text-xs leading-snug">{shortTitle(d.title)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {!reviewMode && !tables && !mapping && (
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
                      <p className="text-xs text-muted">로그인 후 이용할 수 있어요. (AI 추출은 유료)</p>
                    )}
                  </div>
                )}

                {reviewMode && !tables && !mapping && (
                  <button
                    type="button"
                    onClick={() => void runMap()}
                    className="self-start text-[11px] text-muted hover:text-brand"
                  >
                    ＋ 이 요강에서 표 더 찾기 (추가 추출 · 유료)
                  </button>
                )}

                {mapping && (
                  <p className="text-sm text-muted">
                    표를 찾는 중… (요강 분량에 따라 1~2분 걸릴 수 있어요)
                  </p>
                )}
                {mapError && <p className="text-sm text-red-600">{mapError}</p>}

                {tables && (
                  <div className="flex flex-col gap-1.5">
                    {reviewMode && (
                      <p className="text-[11px] font-semibold text-muted">
                        새로 찾은 표 (추출 필요 · 유료)
                      </p>
                    )}
                    {tables.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => selectTable(t)}
                        className={
                          "flex flex-col gap-1 rounded-lg border px-3 py-2 text-left transition-colors " +
                          (savedIds.has(t.id)
                            ? "border-brand/40 bg-brand-soft/50"
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
                          {savedIds.has(t.id) && (
                            <span className="text-[10px] font-medium text-green-600" title="저장됨">
                              ✓ 저장됨
                            </span>
                          )}
                          <span className="ml-auto text-[10px] text-muted">
                            {t.page}
                            {t.endPage && t.endPage > t.page ? `~${t.endPage}` : ""}p
                          </span>
                        </div>
                        <span className="text-xs leading-snug">{t.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
