"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PdfSource } from "@/lib/domain/types";

// 요강 목록 + 헤더 필터. 교사가 작업할 PDF를 4축으로 좁힌다:
//  학년도(admissionYear 기준 — 요강/진학 판단의 표준 축) · 종류(docType)
//  · 국공립/사립(국립+공립을 "국공립"으로 묶음) · 대학.
// 40~200건은 클라이언트에서 즉시 필터.

const ALL = "all";
const OWNERSHIP = ["국공립", "사립"] as const;

const selectClass =
  "rounded-lg border border-border bg-card px-3 py-1.5 text-sm outline-none focus:border-brand";

export function PdfBrowser({ sources }: { sources: PdfSource[] }) {
  const [year, setYear] = useState<string>(ALL);
  const [docType, setDocType] = useState<string>(ALL);
  const [ownership, setOwnership] = useState<string>(ALL);
  const [univ, setUniv] = useState<string>(ALL);

  const years = useMemo(
    () => [...new Set(sources.map((s) => s.admissionYear))].sort((a, b) => b - a),
    [sources],
  );
  const docTypes = useMemo(
    () => [...new Set(sources.map((s) => s.docType))],
    [sources],
  );
  const univs = useMemo(
    () => [...new Set(sources.map((s) => s.university))].sort((a, b) => a.localeCompare(b)),
    [sources],
  );

  const filtered = useMemo(
    () =>
      sources.filter((s) => {
        if (year !== ALL && String(s.admissionYear) !== year) return false;
        if (docType !== ALL && s.docType !== docType) return false;
        if (ownership !== ALL) {
          const isPublic = s.univType === "국립" || s.univType === "공립";
          if (ownership === "국공립" ? !isPublic : s.univType !== ownership) return false;
        }
        if (univ !== ALL && s.university !== univ) return false;
        return true;
      }),
    [sources, year, docType, ownership, univ],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">요강 PDF 작업실</h1>
        <p className="text-sm text-muted">
          작업할 요강을 골라 표를 추출·검증합니다.
        </p>
      </div>

      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <select value={year} onChange={(e) => setYear(e.target.value)} className={selectClass}>
          <option value={ALL}>학년도 전체</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>
              {y}학년도
            </option>
          ))}
        </select>
        <select value={docType} onChange={(e) => setDocType(e.target.value)} className={selectClass}>
          <option value={ALL}>종류 전체</option>
          {docTypes.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          value={ownership}
          onChange={(e) => setOwnership(e.target.value)}
          className={selectClass}
        >
          <option value={ALL}>국공립·사립 전체</option>
          {OWNERSHIP.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <select value={univ} onChange={(e) => setUniv(e.target.value)} className={selectClass}>
          <option value={ALL}>대학 전체</option>
          {univs.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <span className="ml-auto text-xs text-muted">{filtered.length}건</span>
      </div>

      {/* 목록 */}
      {filtered.length > 0 ? (
        <div className="flex flex-col gap-3">
          {filtered.map((s) => (
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
              <h3 className="text-base font-semibold leading-snug">{s.university}</h3>
              <p className="mt-2 text-xs text-muted">
                {s.targetGrade}
                {s.publishedAt && ` · ${s.publishedAt} 발행`}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted">
          조건에 맞는 요강이 없습니다. 필터를 바꿔보세요.
        </div>
      )}
    </div>
  );
}
