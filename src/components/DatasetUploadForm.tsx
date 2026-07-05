"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { DatasetCategory, DatasetLevel } from "@/lib/domain/types";
import {
  DATASET_CATEGORY_LABEL,
  DATASET_LEVEL_LABEL,
} from "@/lib/domain/labels";

// Upload flow: pick an .xlsx → parse in the browser (SheetJS) → preview the
// table → fill the "봉투" (envelope) → confirm → POST to the server.
//
// Multi-sheet: each sheet is its own table. When a file has multiple sheets the
// teacher picks ONE to import (a sheet = one dataset). Importing every sheet as
// separate datasets at once is a follow-up.

const MAX_PREVIEW = 8;
const STORE_CAP = 500; // keep in sync with repository MAX_ROWS

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

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-brand";

export function DatasetUploadForm({
  fieldKeySuggestions = [],
}: {
  fieldKeySuggestions?: string[];
}) {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();

  // 봉투
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DatasetCategory>("admission");
  const [schoolLevel, setSchoolLevel] = useState<DatasetLevel>("high");
  const [year, setYear] = useState("");
  const [source, setSource] = useState("");
  const [customFields, setCustomFields] = useState<
    { key: string; value: string }[]
  >([]);

  function addField() {
    setCustomFields((f) => [...f, { key: "", value: "" }]);
  }
  function updateField(i: number, k: "key" | "value", v: string) {
    setCustomFields((f) =>
      f.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)),
    );
  }
  function removeField(i: number) {
    setCustomFields((f) => f.filter((_, idx) => idx !== i));
  }

  // 내용물 (parsed)
  const [fileName, setFileName] = useState("");
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function parseWorksheet(wb: XLSX.WorkBook, name: string) {
    const ws = wb.Sheets[name];
    if (!ws) {
      setColumns([]);
      setRows([]);
      setParseError("시트를 읽지 못했습니다.");
      return;
    }
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      blankrows: false,
      defval: "",
    });
    if (aoa.length === 0) {
      setColumns([]);
      setRows([]);
      setParseError("빈 시트입니다.");
      return;
    }
    const cols = (aoa[0] as unknown[]).map((c) => String(c ?? "").trim());
    const body = aoa
      .slice(1)
      .map((r) => cols.map((_, i) => String((r as unknown[])[i] ?? "").trim()));
    setParseError(null);
    setColumns(cols);
    setRows(body);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      setWorkbook(wb);
      setSheetNames(wb.SheetNames);
      const first = wb.SheetNames[0] ?? "";
      setSelectedSheet(first);
      if (first) parseWorksheet(wb, first);
    } catch {
      setParseError("엑셀을 읽지 못했습니다. .xlsx 또는 .csv 파일인지 확인해주세요.");
      setWorkbook(null);
      setSheetNames([]);
      setSelectedSheet("");
      setColumns([]);
      setRows([]);
    }
  }

  function onSheetChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const name = e.target.value;
    setSelectedSheet(name);
    if (workbook) parseWorksheet(workbook, name);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !user) return;
    if (columns.length === 0) {
      setError("엑셀 파일을 먼저 첨부해주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
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
            year,
            source,
            customFields: customFields.filter(
              (f) => f.key.trim() && f.value.trim(),
            ),
          },
          columns,
          rows,
        }),
      });
      if (!res.ok) {
        setError("저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      const data = (await res.json()) as { id: string };
      router.push(`/datasets/${data.id}`);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-muted">···</p>;

  if (!user) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
        <p className="text-sm text-muted">
          데이터를 올리려면 로그인이 필요합니다. (열람은 로그인 없이 가능)
        </p>
        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          className="self-start rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Google로 로그인
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {/* 봉투 */}
      <section className="flex flex-col gap-4 rounded-2xl bg-brand-soft p-5">
        <h2 className="text-sm font-semibold text-brand">
          봉투 — 이게 무슨 자료인지
        </h2>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">제목</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 2027 수도권 주요대 논술 모음"
            maxLength={150}
            required
            className={inputClass}
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="text-muted">구분</span>
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
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="text-muted">대상</span>
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
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="text-muted">학년도/시기</span>
            <input
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="예: 2027"
              maxLength={40}
              className={inputClass}
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">출처</span>
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="예: 각 대학 입학처 / 직접 정리"
            maxLength={300}
            className={inputClass}
          />
        </label>

        {/* 추가칸 (선택) — 핵심칸 위에 얹는 자유 태그 */}
        <div className="flex flex-col gap-2">
          <span className="text-sm text-muted">추가 항목 (선택)</span>
          {customFields.map((f, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={f.key}
                onChange={(e) => updateField(i, "key", e.target.value)}
                list="dataset-field-keys"
                placeholder="항목 (예: 지역)"
                maxLength={40}
                className={`${inputClass} flex-1`}
              />
              <input
                value={f.value}
                onChange={(e) => updateField(i, "value", e.target.value)}
                placeholder="값 (예: 수도권)"
                maxLength={200}
                className={`${inputClass} flex-1`}
              />
              <button
                type="button"
                onClick={() => removeField(i)}
                aria-label="항목 삭제"
                className="shrink-0 rounded-lg border border-border px-3 text-sm text-muted hover:border-brand"
              >
                ✕
              </button>
            </div>
          ))}
          <datalist id="dataset-field-keys">
            {fieldKeySuggestions.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
          <button
            type="button"
            onClick={addField}
            className="self-start text-sm font-medium text-brand hover:underline"
          >
            + 항목 추가
          </button>
          <p className="text-xs text-muted">
            파일 전체에 해당하는 속성만 (예: 지역=수도권). 행마다 달라지는 값은
            엑셀 열로 두세요.
          </p>
        </div>
      </section>

      {/* 내용물 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted">
          내용물 — 엑셀 첨부 (열은 자유)
        </h2>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={onFile}
          className="text-sm"
        />
        {parseError && <p className="text-sm text-red-600">{parseError}</p>}

        {/* 시트 선택 (시트가 여러 개일 때만) */}
        {sheetNames.length > 1 && (
          <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted">시트 선택</span>
              <select
                value={selectedSheet}
                onChange={onSheetChange}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm outline-none focus:border-brand"
              >
                {sheetNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-muted">
              이 엑셀엔 시트가 {sheetNames.length}개 있어요. 올릴 시트를 하나
              고르세요. (각 시트를 따로 올리는 기능은 추후 지원)
            </p>
          </div>
        )}

        {columns.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted">
              {fileName}
              {sheetNames.length > 1 && ` · 시트 “${selectedSheet}”`} · 총{" "}
              {rows.length}행
              {rows.length > STORE_CAP &&
                ` (저장은 상위 ${STORE_CAP}행까지 — 큰 파일 분할 저장은 추후 지원)`}
            </p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full text-xs">
                <thead className="bg-brand-soft">
                  <tr>
                    {columns.map((c, i) => (
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
                  {rows.slice(0, MAX_PREVIEW).map((row, ri) => (
                    <tr key={ri} className="border-t border-border">
                      {columns.map((_, ci) => (
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
            {rows.length > MAX_PREVIEW && (
              <p className="text-xs text-muted">
                …외 {rows.length - MAX_PREVIEW}행 (미리보기는 {MAX_PREVIEW}행까지)
              </p>
            )}
          </div>
        )}
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={busy || !title.trim() || columns.length === 0}
        className="self-start rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "올리는 중…" : "이 시트로 올리기"}
      </button>
    </form>
  );
}
