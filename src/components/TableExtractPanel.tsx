"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import type {
  DatasetCategory,
  DatasetLevel,
  PdfSource,
} from "@/lib/domain/types";
import type { ExtractedNote, ExtractedTable, TableKind, TableMapEntry } from "@/lib/extract/types";
import { mergeNotes } from "@/lib/extract/merge";
import { TAG_SPECS } from "@/lib/datasets/tags";
import {
  DATASET_CATEGORY_LABEL,
  DATASET_LEVEL_LABEL,
} from "@/lib/domain/labels";

// 표 하나: Pass 2 추출 → 편집 그리드 + 조건 편집 → 봉투 채워 저장.
// 교사가 왼쪽 원본과 대조하며 셀·조건을 고친 뒤 저장. 저장 시 주석은 '비고/조건'
// 열로 각 행에 병합되고, 원본 소스(sourceId·originalUrl)가 데이터셋에 물린다.

const CATEGORIES: DatasetCategory[] = [
  "admission",
  "essay",
  "record",
  "interview",
  "result",
  "career",
  "activity",
  "contest",
  "etc",
];
const LEVELS: DatasetLevel[] = ["middle", "high", "both"];

function kindToCategory(kind: TableKind): DatasetCategory {
  return kind === "기타" ? "etc" : "admission";
}

const cellClass =
  "border border-border bg-card px-1.5 py-1 text-xs outline-none focus:border-brand";
const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-brand";

export function TableExtractPanel({
  source,
  table,
  onBack,
  onSaved,
}: {
  source: PdfSource;
  table: TableMapEntry;
  onBack: () => void;
  onSaved: (tableId: string) => void;
}) {
  const { user, signInWithGoogle } = useAuth();

  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);

  // 편집 대상 (추출 후 채워짐).
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [notes, setNotes] = useState<ExtractedNote[]>([]);
  const [extracted, setExtracted] = useState(false);

  // 봉투.
  const [title, setTitle] = useState(`${source.university} ${table.title}`);
  const [category, setCategory] = useState<DatasetCategory>(kindToCategory(table.kind));
  const [schoolLevel, setSchoolLevel] = useState<DatasetLevel>("high");
  // 분류 태그(customFields). 입결의 지표·기준처럼 "이 숫자가 무엇인지"를 봉투에 명시.
  const [tags, setTags] = useState<{ key: string; value: string }[]>([]);
  const tagSpecs = TAG_SPECS[category] ?? [];

  async function runExtract() {
    if (extracting) return;
    if (!user) {
      await signInWithGoogle();
      return;
    }
    setExtracting(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/pdf/${source.id}/table`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: table.title,
          page: table.page,
          endPage: table.endPage ?? table.page,
        }),
      });
      if (!res.ok) {
        setError("표 추출에 실패했습니다. 다시 시도해주세요.");
        return;
      }
      const t = (await res.json()) as ExtractedTable;
      setColumns(t.columns);
      setRows(t.rows);
      setNotes(t.notes);
      setConfidence(t.confidence);
      setExtracted(true);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setExtracting(false);
    }
  }

  function setCell(ri: number, ci: number, v: string) {
    setRows((rs) => rs.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? v : c)) : r)));
  }
  function setHeader(ci: number, v: string) {
    setColumns((cs) => cs.map((c, i) => (i === ci ? v : c)));
  }
  function setNote(i: number, k: "text" | "appliesTo", v: string) {
    setNotes((ns) => ns.map((n, idx) => (idx === i ? { ...n, [k]: v } : n)));
  }
  function removeNote(i: number) {
    setNotes((ns) => ns.filter((_, idx) => idx !== i));
  }
  function addTag(key = "") {
    setTags((t) => [...t, { key, value: "" }]);
  }
  function setTag(i: number, field: "key" | "value", v: string) {
    setTags((t) => t.map((row, idx) => (idx === i ? { ...row, [field]: v } : row)));
  }
  function removeTag(i: number) {
    setTags((t) => t.filter((_, idx) => idx !== i));
  }

  async function save() {
    if (!user || saving || !title.trim() || columns.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const merged = mergeNotes({ columns, rows, notes, confidence: confidence ?? 0.5 });
      // 분류 태그를 봉투 customFields 앞쪽에 병합(주석 파생분보다 우선 노출).
      const tagFields = tags
        .map((t) => ({ key: t.key.trim(), value: t.value.trim() }))
        .filter((t) => t.key && t.value);
      const token = await user.getIdToken();
      const res = await fetch("/api/datasets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          envelope: {
            title,
            category,
            schoolLevel,
            year: String(source.admissionYear),
            source: `${source.university} ${source.docType}`,
            customFields: [...tagFields, ...merged.customFields],
          },
          columns: merged.columns,
          rows: merged.rows,
          sourceId: source.id,
          originalUrl: source.originalUrl,
          sourcePage: table.page,
          sourceEndPage: table.endPage ?? table.page,
        }),
      });
      if (!res.ok) {
        setError("저장에 실패했습니다.");
        return;
      }
      onSaved(table.id);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* 헤더 */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-border px-2.5 py-1 text-xs text-muted hover:border-brand"
        >
          ← 목록
        </button>
        <span className="truncate text-sm font-medium">{table.title}</span>
        <span className="ml-auto shrink-0 text-[10px] text-muted">
          {table.page}
          {table.endPage && table.endPage > table.page ? `~${table.endPage}` : ""}p
        </span>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {!extracted ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs leading-relaxed text-muted">
              왼쪽 원본에서 이 표를 확인한 뒤 추출하세요. 병합셀·주석을 풀어
              정규화 표로 뽑습니다.
            </p>
            <button
              type="button"
              onClick={() => void runExtract()}
              disabled={extracting}
              className="self-start rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {extracting ? "추출 중… (수십 초)" : "이 표 추출하기"}
            </button>
            {!user && (
              <p className="text-xs text-muted">로그인 후 이용할 수 있어요.</p>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {confidence !== null && (
              <div className="rounded-lg bg-brand-soft p-2 text-[11px] leading-relaxed text-brand">
                확신도 {Math.round(confidence * 100)}% · <b>왼쪽 원본과 대조</b>해
                셀·조건을 고친 뒤 저장하세요.
              </div>
            )}

            {/* 편집 그리드 */}
            <div className="overflow-x-auto">
              <table className="border-collapse">
                <thead>
                  <tr>
                    {columns.map((c, ci) => (
                      <th key={ci} className="p-0">
                        <input
                          value={c}
                          onChange={(e) => setHeader(ci, e.target.value)}
                          className={`${cellClass} font-medium text-brand`}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => (
                    <tr key={ri}>
                      {columns.map((_, ci) => (
                        <td key={ci} className="p-0">
                          <input
                            value={row[ci] ?? ""}
                            onChange={(e) => setCell(ri, ci, e.target.value)}
                            className={cellClass}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 조건(주석) 편집 */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted">
                조건(주석) {notes.length}개 — 저장 시 &lsquo;비고/조건&rsquo; 열로 각 행에 붙음
              </span>
              {notes.map((n, i) => (
                <div key={i} className="flex flex-col gap-1 rounded-lg border border-border p-2">
                  <div className="flex items-start gap-1">
                    <span className="pt-1 text-xs font-medium">{n.marker || "※"}</span>
                    <textarea
                      value={n.text}
                      onChange={(e) => setNote(i, "text", e.target.value)}
                      rows={2}
                      className="flex-1 rounded border border-border bg-card px-2 py-1 text-xs outline-none focus:border-brand"
                    />
                    <button
                      type="button"
                      onClick={() => removeNote(i)}
                      aria-label="조건 삭제"
                      className="shrink-0 px-1 text-muted hover:text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                  <input
                    value={n.appliesTo}
                    onChange={(e) => setNote(i, "appliesTo", e.target.value)}
                    placeholder="적용 대상 (비우면 표 전체)"
                    className="rounded border border-border bg-card px-2 py-1 text-[11px] text-muted outline-none focus:border-brand"
                  />
                </div>
              ))}
            </div>

            {/* 봉투 */}
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="제목"
                maxLength={150}
                className={inputClass}
              />
              <div className="flex gap-2">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as DatasetCategory)}
                  className={inputClass}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {DATASET_CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
                <select
                  value={schoolLevel}
                  onChange={(e) => setSchoolLevel(e.target.value as DatasetLevel)}
                  className={inputClass}
                >
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {DATASET_LEVEL_LABEL[l]}
                    </option>
                  ))}
                </select>
              </div>

              {/* 분류 태그 — "이 숫자가 무엇인지"를 봉투에 명시(검색·비교 정확도). */}
              <div className="flex flex-col gap-1.5 rounded-lg border border-border p-2">
                <span className="text-xs font-semibold text-muted">
                  분류 태그 <span className="font-normal">— 검색·비교용 (예: 지표=70%컷)</span>
                </span>
                {tagSpecs.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {tagSpecs.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => addTag(s.key)}
                        title={s.hint}
                        className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted hover:border-brand hover:text-brand"
                      >
                        + {s.key}
                      </button>
                    ))}
                  </div>
                )}
                {tags.map((t, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <input
                      value={t.key}
                      onChange={(e) => setTag(i, "key", e.target.value)}
                      placeholder="항목"
                      list="tagkeys"
                      className="w-28 shrink-0 rounded border border-border bg-card px-2 py-1 text-xs outline-none focus:border-brand"
                    />
                    <input
                      value={t.value}
                      onChange={(e) => setTag(i, "value", e.target.value)}
                      placeholder="값"
                      list={`tagval-${t.key}`}
                      className="flex-1 rounded border border-border bg-card px-2 py-1 text-xs outline-none focus:border-brand"
                    />
                    <button
                      type="button"
                      onClick={() => removeTag(i)}
                      aria-label="태그 삭제"
                      className="shrink-0 px-1 text-muted hover:text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addTag()}
                  className="self-start text-[11px] text-brand hover:underline"
                >
                  + 태그 추가
                </button>
                <datalist id="tagkeys">
                  {tagSpecs.map((s) => (
                    <option key={s.key} value={s.key} />
                  ))}
                </datalist>
                {tagSpecs.map((s) => (
                  <datalist id={`tagval-${s.key}`} key={s.key}>
                    {s.values.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                ))}
              </div>

              <p className="text-[11px] text-muted">
                출처: {source.university} {source.docType} · {source.admissionYear}학년도
              </p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || !title.trim()}
              className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "저장 중…" : "원본과 대조했어요 · 데이터로 저장"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
