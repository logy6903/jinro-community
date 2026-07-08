"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useAuth } from "@/lib/auth/AuthProvider";
import type {
  Dataset,
  DatasetCategory,
  DatasetLevel,
} from "@/lib/domain/types";
import {
  DATASET_CATEGORY_LABEL,
  DATASET_LEVEL_LABEL,
} from "@/lib/domain/labels";

// 데이터 정리·엑셀 내보내기 — 언어모델 없이 결정론적으로. 구분·대상·학년도로
// 저장된 데이터셋을 필터해 "어느 대학이 이 자료를 갖고 있나"를 완전하게 모으고
// (봉투 메타 기반, 빠뜨림 없음), 엑셀로 내려받는다. 저장 데이터 밖으로 나가지 않음.

type Meta = Omit<Dataset, "rows">;

const ALL = "all";
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
const selectClass =
  "rounded-lg border border-border bg-card px-3 py-1.5 text-sm outline-none focus:border-brand";

function sheetName(base: string, used: Set<string>): string {
  // Excel 시트명: 31자 이내 + 금지문자 제거 + 유니크.
  let name = base.replace(/[\\/?*[\]:]/g, " ").slice(0, 28).trim() || "표";
  let n = name;
  let i = 2;
  while (used.has(n)) n = `${name.slice(0, 25)} ${i++}`;
  used.add(n);
  return n;
}

export function DatasetCollector({ datasets }: { datasets: Meta[] }) {
  const { user } = useAuth();
  const [category, setCategory] = useState<string>(ALL);
  const [level, setLevel] = useState<string>(ALL);
  const [year, setYear] = useState<string>(ALL);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const years = useMemo(
    () =>
      [...new Set(datasets.map((d) => d.year).filter(Boolean))].sort((a, b) =>
        b.localeCompare(a),
      ),
    [datasets],
  );

  const matched = useMemo(
    () =>
      datasets.filter(
        (d) =>
          (category === ALL || d.category === category) &&
          (level === ALL || d.schoolLevel === level) &&
          (year === ALL || d.year === year),
      ),
    [datasets, category, level, year],
  );

  async function exportExcel() {
    if (busy || matched.length === 0) return;
    setBusy(true);
    setSaved(false);
    try {
      const res = await fetch("/api/datasets/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: matched.map((d) => d.id) }),
      });
      const { datasets: full } = (await res.json()) as { datasets: Dataset[] };

      const wb = XLSX.utils.book_new();
      const used = new Set<string>();

      // 요약 시트: 어느 대학/자료가 매칭됐나 (완전성).
      const summary = [
        ["제목", "구분", "대상", "학년도", "출처", "행수"],
        ...full.map((d) => [
          d.title,
          DATASET_CATEGORY_LABEL[d.category],
          DATASET_LEVEL_LABEL[d.schoolLevel],
          d.year,
          d.source,
          d.rowCount,
        ]),
      ];
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet(summary),
        sheetName("요약", used),
      );

      // 데이터셋별 시트 (봉투 + 표).
      for (const d of full) {
        const aoa: (string | number)[][] = [
          [d.title],
          [`${DATASET_CATEGORY_LABEL[d.category]} · ${d.year} · ${d.source}`],
          [],
          d.columns,
          ...d.rows,
        ];
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.aoa_to_sheet(aoa),
          sheetName(d.title, used),
        );
      }

      XLSX.writeFile(wb, "데이터정리.xlsx");

      // 로그인 교사면 정리본을 자료실에 자동 저장(누가·언제, 필터 id로 upsert).
      if (user) {
        const token = await user.getIdToken();
        await fetch("/api/datasets/compilation", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            key: `${category}-${level}-${year}`,
            envelope: {
              title: `정리: ${category === ALL ? "전체" : DATASET_CATEGORY_LABEL[category as DatasetCategory]} · ${level === ALL ? "전체" : DATASET_LEVEL_LABEL[level as DatasetLevel]} · ${year === ALL ? "전체" : year}`,
              category: category === ALL ? "etc" : category,
              schoolLevel: level === ALL ? "both" : level,
              year: year === ALL ? "" : year,
              source: "자료 정리 (자동)",
              customFields: [{ key: "유형", value: "정리본" }],
            },
            columns: summary[0],
            rows: summary.slice(1),
          }),
        }).catch(() => {});
        setSaved(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">데이터 정리 · 엑셀 내보내기</h1>
        <p className="text-sm text-muted">
          구분·대상·학년도로 저장된 데이터를 모아 엑셀로 내려받습니다. 저장된
          데이터 안에서만 정리됩니다(AI 생성 아님).
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
          <option value={ALL}>구분 전체</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {DATASET_CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <select value={level} onChange={(e) => setLevel(e.target.value)} className={selectClass}>
          <option value={ALL}>대상 전체</option>
          {(["middle", "high", "both"] as DatasetLevel[]).map((l) => (
            <option key={l} value={l}>
              {DATASET_LEVEL_LABEL[l]}
            </option>
          ))}
        </select>
        <select value={year} onChange={(e) => setYear(e.target.value)} className={selectClass}>
          <option value={ALL}>학년도 전체</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <span className="ml-auto text-xs text-muted">{matched.length}건</span>
        <button
          type="button"
          onClick={() => void exportExcel()}
          disabled={busy || matched.length === 0}
          className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "내보내는 중…" : "엑셀 다운로드"}
        </button>
      </div>
      <p className="text-xs text-muted">
        {saved
          ? "이 정리를 자료실에 저장했어요 ✓ (누가·언제 표시, 같은 정리는 갱신)"
          : user
            ? "엑셀을 내려받으면 이 정리가 자료실에도 자동 저장됩니다."
            : "로그인하면 내려받은 정리가 자료실에도 자동 저장됩니다."}
      </p>

      {matched.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-brand-soft text-xs text-brand">
              <tr>
                <th className="px-3 py-2 text-left font-medium">제목</th>
                <th className="px-3 py-2 text-left font-medium">구분</th>
                <th className="px-3 py-2 text-left font-medium">대상</th>
                <th className="px-3 py-2 text-left font-medium">학년도</th>
                <th className="px-3 py-2 text-left font-medium">출처</th>
                <th className="px-3 py-2 text-right font-medium">행</th>
              </tr>
            </thead>
            <tbody>
              {matched.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-3 py-1.5 font-medium">{d.title}</td>
                  <td className="px-3 py-1.5 text-muted">{DATASET_CATEGORY_LABEL[d.category]}</td>
                  <td className="px-3 py-1.5 text-muted">{DATASET_LEVEL_LABEL[d.schoolLevel]}</td>
                  <td className="px-3 py-1.5 text-muted">{d.year}</td>
                  <td className="px-3 py-1.5 text-muted">{d.source}</td>
                  <td className="px-3 py-1.5 text-right text-muted">{d.rowCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted">
          조건에 맞는 데이터가 없습니다.
        </div>
      )}
    </div>
  );
}
