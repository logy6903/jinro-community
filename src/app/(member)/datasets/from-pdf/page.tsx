"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import type {
  DatasetCategory,
  DatasetLevel,
} from "@/lib/domain/types";
import type { ExtractedTable, TableMapEntry } from "@/lib/extract/types";
import {
  DATASET_CATEGORY_LABEL,
  DATASET_LEVEL_LABEL,
} from "@/lib/domain/labels";

// 요강 PDF 리더 (Pass 1 표지도 → 교사 확인 → Pass 2 표별 정밀추출 → 검증 → 저장).
// 표를 물리적으로 자르지 않고 "이 페이지의 이 표만" 지시로 격리한다 (주석이 표
// 바깥에 있어 자르면 조건이 사라지므로). 주석은 저장 시 '비고/조건' 열로 각 행에
// 붙여, 챗봇이 인용할 때 조건이 반드시 딸려 나가게 한다.

const MAX_PDF_BYTES = 3.5 * 1024 * 1024; // Vercel 본문 한도(~4.5MB) + base64 팽창 여유
const PREVIEW_ROWS = 12;

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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(new Error("read_failed"));
    r.readAsDataURL(file);
  });
}

/** 2+글자 토큰. */
function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^0-9a-z가-힣]+/i)
    .filter((w) => w.length >= 2);
}

/**
 * 주석을 표에 병합해 저장용 {columns, rows, customFields} 생성.
 * 조건을 버리지 않는 게 핵심: 전역 주석은 모든 행에, 특정 주석은 매칭 행에 붙이고,
 * 어느 행에도 안 붙은 특정 주석은 customField로 남겨 손실 0.
 */
function mergeNotes(t: ExtractedTable): {
  columns: string[];
  rows: string[][];
  customFields: { key: string; value: string }[];
} {
  if (t.notes.length === 0) {
    return { columns: t.columns, rows: t.rows, customFields: [] };
  }
  const label = (n: (typeof t.notes)[number]) =>
    `${n.marker ? n.marker + " " : ""}${n.text}`.trim();
  const used = new Set<number>();
  const columns = [...t.columns, "비고/조건"];
  const rows = t.rows.map((row) => {
    const rowText = tokens(row.join(" "));
    const applied: string[] = [];
    t.notes.forEach((n, idx) => {
      const global = n.appliesTo.trim() === "";
      const match =
        global ||
        tokens(n.appliesTo).some((tk) => rowText.some((rt) => rt.includes(tk) || tk.includes(rt)));
      if (match) {
        applied.push(label(n));
        used.add(idx);
      }
    });
    return [...row, applied.join(" / ")];
  });
  const orphan = t.notes
    .filter((_, idx) => !used.has(idx))
    .slice(0, 12)
    .map((n) => ({ key: "주석", value: label(n) }));
  return { columns, rows, customFields: orphan };
}

export default function FromPdfPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();

  const [pdfBase64, setPdfBase64] = useState("");
  const [fileName, setFileName] = useState("");
  const [tables, setTables] = useState<TableMapEntry[] | null>(null);
  const [selected, setSelected] = useState<TableMapEntry | null>(null);
  const [extracted, setExtracted] = useState<ExtractedTable | null>(null);

  const [mapping, setMapping] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 저장 봉투
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DatasetCategory>("admission");
  const [schoolLevel, setSchoolLevel] = useState<DatasetLevel>("high");
  const [year, setYear] = useState("");
  const [source, setSource] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setTables(null);
    setSelected(null);
    setExtracted(null);
    if (file.size > MAX_PDF_BYTES) {
      setError(
        `PDF가 너무 큽니다(${(file.size / 1024 / 1024).toFixed(1)}MB). 현재는 3.5MB 이하만 지원해요. 필요한 페이지만 잘라 올려주세요.`,
      );
      return;
    }
    try {
      setFileName(file.name);
      setPdfBase64(await fileToBase64(file));
    } catch {
      setError("PDF를 읽지 못했습니다.");
    }
  }

  async function runMap() {
    if (!user || !pdfBase64 || mapping) return;
    setMapping(true);
    setError(null);
    setTables(null);
    setSelected(null);
    setExtracted(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/extract/map", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pdfBase64 }),
      });
      if (!res.ok) {
        setError(
          res.status === 503
            ? "추출 기능이 아직 설정되지 않았어요. (관리자: 서버에 ANTHROPIC_API_KEY 필요)"
            : "표 지도 생성에 실패했습니다. 잠시 후 다시 시도해주세요.",
        );
        return;
      }
      const data = (await res.json()) as { tables: TableMapEntry[] };
      setTables(data.tables);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setMapping(false);
    }
  }

  async function runExtract(t: TableMapEntry) {
    if (!user || !pdfBase64 || extracting) return;
    setSelected(t);
    setExtracted(null);
    setExtracting(true);
    setError(null);
    setTitle(t.title);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/extract/table", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pdfBase64, title: t.title, page: t.page }),
      });
      if (!res.ok) {
        setError("표 추출에 실패했습니다. 다른 표로 시도하거나 다시 시도해주세요.");
        return;
      }
      setExtracted((await res.json()) as ExtractedTable);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setExtracting(false);
    }
  }

  async function save() {
    if (!user || !extracted || saving || !title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const merged = mergeNotes(extracted);
      const token = await user.getIdToken();
      const res = await fetch("/api/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          envelope: { title, category, schoolLevel, year, source, customFields: merged.customFields },
          columns: merged.columns,
          rows: merged.rows,
        }),
      });
      if (!res.ok) {
        setError("저장에 실패했습니다.");
        return;
      }
      const data = (await res.json()) as { id: string };
      router.push(`/datasets/${data.id}`);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted">···</p>;

  if (!user) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
        <h1 className="text-xl font-bold">요강 PDF에서 표 뽑기</h1>
        <p className="text-sm text-muted">
          PDF 표 추출은 로그인 후 이용할 수 있어요. (AI 추출은 유료라 로그인 필요)
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
    <div className="flex flex-col gap-5">
      <Link href="/datasets/new" className="text-sm text-muted hover:text-foreground">
        ← 엑셀로 올리기
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">요강 PDF에서 표 뽑기</h1>
        <p className="text-sm text-muted">
          요강 PDF를 올리면 ① AI가 표 목록을 먼저 만들고, ② 표를 하나씩 정밀 추출합니다.
          병합셀·주석이 많은 표는 <b>추출 결과를 꼭 원본과 대조</b>해 확인하세요.
        </p>
      </div>

      {/* 업로드 + Pass 1 */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <input type="file" accept=".pdf" onChange={onFile} className="text-sm" />
        {fileName && <p className="text-xs text-muted">{fileName}</p>}
        <button
          type="button"
          onClick={() => void runMap()}
          disabled={!pdfBase64 || mapping}
          className="self-start rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {mapping ? "표 찾는 중… (수십 초 걸릴 수 있어요)" : "① 표 목록 만들기"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Pass 1 결과 — 표 지도 */}
      {tables && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted">
            찾은 표 {tables.length}개 — 추출할 표를 고르세요
          </h2>
          {tables.length === 0 && (
            <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted">
              표를 찾지 못했어요. 표가 이미지(스캔)뿐이거나 페이지가 많으면 필요한 부분만 잘라 올려보세요.
            </p>
          )}
          {tables.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => void runExtract(t)}
              disabled={extracting}
              className={
                "flex items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-60 " +
                (selected?.id === t.id ? "border-brand bg-brand-soft" : "border-border hover:border-brand")
              }
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{t.title}</span>
                <span className="text-xs text-muted">
                  {t.page}p · {t.location}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand">
                  {t.kind}
                </span>
                {t.hasNotes && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={{ background: "#FAEEDA", color: "#854F0B" }}
                    title="※ 주석 있음 — 조건으로 함께 추출됩니다"
                  >
                    ※ 주석
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {extracting && (
        <p className="text-sm text-muted">
          「{selected?.title}」 정밀 추출 중… (병합셀·주석을 푸는 중이라 시간이 걸립니다)
        </p>
      )}

      {/* Pass 2 결과 — 정밀 추출 + 저장 */}
      {extracted && selected && (
        <div className="flex flex-col gap-4 rounded-2xl border border-border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">추출 결과 · {selected.title}</h2>
            <ConfidenceBadge value={extracted.confidence} />
          </div>

          <div className="rounded-lg bg-brand-soft p-3 text-xs leading-relaxed text-brand">
            ⚠️ AI 추출은 병합셀·주석에서 틀릴 수 있어요. <b>원본 PDF와 아래 표를 반드시 대조</b>한 뒤
            저장하세요. (특히 최저기준·반영비율 등 병합 심한 표)
          </div>

          {extracted.rows.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full text-xs">
                <thead className="bg-brand-soft">
                  <tr>
                    {extracted.columns.map((c, i) => (
                      <th key={i} className="whitespace-nowrap px-3 py-2 text-left font-medium text-brand">
                        {c || `(빈 열 ${i + 1})`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {extracted.rows.slice(0, PREVIEW_ROWS).map((row, ri) => (
                    <tr key={ri} className="border-t border-border">
                      {extracted.columns.map((_, ci) => (
                        <td key={ci} className="whitespace-nowrap px-3 py-1.5 text-foreground/80">
                          {row[ci]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted">추출된 행이 없습니다.</p>
          )}
          {extracted.rows.length > PREVIEW_ROWS && (
            <p className="text-xs text-muted">
              …외 {extracted.rows.length - PREVIEW_ROWS}행 (미리보기 {PREVIEW_ROWS}행)
            </p>
          )}

          {/* 주석 = 조건 (버리지 않음) */}
          {extracted.notes.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted">
                표 밖 주석 {extracted.notes.length}개 (저장 시 &lsquo;비고/조건&rsquo; 열로 각 행에 붙습니다)
              </span>
              {extracted.notes.map((n, i) => (
                <div key={i} className="rounded-lg border border-border px-3 py-2 text-xs">
                  <span className="font-medium">{n.marker || "※"}</span> {n.text}
                  {n.appliesTo && <span className="text-muted"> — 적용: {n.appliesTo}</span>}
                </div>
              ))}
            </div>
          )}

          {/* 저장 봉투 */}
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <span className="text-sm font-medium">데이터로 저장 (봉투)</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목 (예: 2027 OO대 논술 최저기준)"
              maxLength={150}
              className={inputClass}
            />
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
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="출처 (예: OO대 입학처 요강)"
              maxLength={300}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || !title.trim()}
              className="self-start rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "저장 중…" : "원본과 대조했어요 · 데이터로 저장"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const [bg, fg] =
    value >= 0.8 ? ["#E1F5EE", "#0F6E56"] : value >= 0.5 ? ["#FAEEDA", "#854F0B"] : ["#FCE4E4", "#A32D2D"];
  return (
    <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: bg, color: fg }}>
      확신도 {pct}%
    </span>
  );
}
