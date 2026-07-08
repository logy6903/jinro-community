"use client";

import { useMemo, useState } from "react";
import { computeNaeshin } from "@/lib/naeshin/engine";
import { SKKU_2026_HAKJANG } from "@/lib/naeshin/specs/skku-2026-hakjang";
import type { NaeshinSpec, TranscriptSubject } from "@/lib/naeshin/types";

// 내신 산출 검수 화면. 엔진은 순수 TS라 브라우저에서 실시간 계산.
//  ① 성적표 입력  ② 계산 트레이스(단계별 중간값)  ③ spec 편집(환산표·반영비)
//  ④ 기대점수 대조(오차)  — 검수자가 수식(파라미터)을 고치며 검증하는 자리.
// 지금은 성대 spec 하나 하드코딩(손인코딩). 추후 spec 선택·요강 추출로 확장.

const SAMPLE: TranscriptSubject[] = [
  { name: "국어", group: "A", grade: 1, units: 4 },
  { name: "수학", group: "A", grade: 2, units: 4 },
  { name: "영어", group: "A", grade: 1, units: 4 },
  { name: "한국사", group: "A", grade: 3, units: 2 },
  { name: "기술가정", group: "B", grade: 2, units: 2 },
  { name: "한문", group: "B", grade: 3, units: 3 },
];

function fmt(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

const cell = "w-full rounded border border-border bg-card px-2 py-1 text-sm outline-none focus:border-brand";

export default function NaeshinQAPage() {
  const [spec, setSpec] = useState<NaeshinSpec>(() =>
    structuredClone(SKKU_2026_HAKJANG),
  );
  const [subjects, setSubjects] = useState<TranscriptSubject[]>(SAMPLE);
  const [expected, setExpected] = useState("");

  const result = useMemo(() => computeNaeshin(spec, subjects), [spec, subjects]);

  const expNum = expected.trim() === "" ? null : Number(expected);
  const diff =
    expNum !== null && Number.isFinite(expNum) ? result.total - expNum : null;
  const matched = diff !== null && Math.abs(diff) < 0.1;

  // 성적표 편집
  function setSub(i: number, k: keyof TranscriptSubject, v: string) {
    setSubjects((rs) =>
      rs.map((r, idx) =>
        idx === i
          ? { ...r, [k]: k === "grade" || k === "units" ? Number(v) : v }
          : r,
      ),
    );
  }
  const addSub = () =>
    setSubjects((rs) => [...rs, { name: "", group: "A", grade: 1, units: 1 }]);
  const delSub = (i: number) =>
    setSubjects((rs) => rs.filter((_, idx) => idx !== i));

  // spec 편집
  function setScore(gi: number, si: number, v: string) {
    setSpec((s) => ({
      ...s,
      groups: s.groups.map((g, idx) =>
        idx === gi
          ? { ...g, gradeScore: g.gradeScore.map((x, j) => (j === si ? Number(v) : x)) }
          : g,
      ),
    }));
  }
  function setRatio(gi: number, v: string) {
    setSpec((s) => ({
      ...s,
      groups: s.groups.map((g, idx) =>
        idx === gi ? { ...g, reflectRatio: Number(v) } : g,
      ),
    }));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">내신 산출 검수</h1>
        <p className="text-sm text-muted">
          {spec.university} · {spec.track} · 정량평가 (만점 {spec.maxScore})
        </p>
        <p className="text-xs text-muted">
          성적표를 넣어 계산 과정을 확인하고, 환산표·반영비를 원본과 대조해 고칩니다.
          대학이 준 예시 점수를 기대점수에 넣으면 자동으로 오차를 표시합니다.
        </p>
      </div>

      {/* ① 성적표 입력 */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">① 성적표</h2>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-brand-soft text-xs text-brand">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">과목</th>
                <th className="px-2 py-1.5 text-left font-medium">군</th>
                <th className="px-2 py-1.5 text-left font-medium">석차등급</th>
                <th className="px-2 py-1.5 text-left font-medium">이수단위</th>
                <th className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {subjects.map((s, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-2 py-1">
                    <input value={s.name} onChange={(e) => setSub(i, "name", e.target.value)} className={cell} />
                  </td>
                  <td className="px-2 py-1">
                    <select value={s.group} onChange={(e) => setSub(i, "group", e.target.value)} className={cell}>
                      {spec.groups.map((g) => (
                        <option key={g.key} value={g.key}>
                          {g.key}군
                        </option>
                      ))}
                      <option value="none">미반영</option>
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" min={1} max={9} value={s.grade} onChange={(e) => setSub(i, "grade", e.target.value)} className={`${cell} w-20`} />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" min={0} value={s.units} onChange={(e) => setSub(i, "units", e.target.value)} className={`${cell} w-20`} />
                  </td>
                  <td className="px-2 py-1 text-right">
                    <button type="button" onClick={() => delSub(i)} aria-label="삭제" className="text-muted hover:text-red-600">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={addSub} className="self-start text-sm font-medium text-brand hover:underline">
          + 과목 추가
        </button>
      </section>

      {/* ③ 결과 + 오차 */}
      <section className="flex flex-wrap items-end gap-4 rounded-2xl border border-border bg-card p-4">
        <div>
          <div className="text-xs text-muted">정량 총점</div>
          <div className="text-2xl font-bold">{fmt(result.total)}</div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">기대 점수 (대학 예시)</label>
          <input value={expected} onChange={(e) => setExpected(e.target.value)} placeholder="예: 778.2" className={`${cell} w-32`} />
        </div>
        {diff !== null && (
          <div
            className="rounded-lg px-3 py-2 text-sm font-medium"
            style={
              matched
                ? { background: "#E1F5EE", color: "#0F6E56" }
                : { background: "#FCE4E4", color: "#A32D2D" }
            }
          >
            {matched ? "✓ 일치" : `오차 ${fmt(diff)}`}
          </div>
        )}
      </section>

      {/* ② 계산 트레이스 */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">② 계산 과정 (트레이스)</h2>
        <div className="flex flex-col gap-3">
          {result.groups.map((g) => (
            <div key={g.key} className="rounded-2xl border border-border p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">{g.key}군</span>
                <span className="text-sm">
                  최종 <b>{fmt(g.finalScore)}</b>
                </span>
              </div>
              <p className="mb-2 text-xs text-muted">{g.name}</p>
              {g.subjects.length > 0 ? (
                <div className="text-xs">
                  {g.subjects.map((s, i) => (
                    <span key={i} className="mr-2 inline-block text-foreground/80">
                      {s.name}({s.grade}등급→{s.score}×{s.units})
                    </span>
                  ))}
                  <div className="mt-1 text-muted">
                    Σ(점수×단위)={fmt(g.sumWeighted)} / Σ단위={fmt(g.sumUnits)} = 1차{" "}
                    {fmt(g.firstScore)} × 반영비 {g.reflectRatio} ={" "}
                    <b className="text-foreground">{fmt(g.finalScore)}</b>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted">해당 과목 없음</p>
              )}
            </div>
          ))}
          {result.ignored.length > 0 && (
            <p className="text-xs text-muted">
              미반영: {result.ignored.join(", ")}
            </p>
          )}
        </div>
      </section>

      {/* ④ spec 편집 (수식 수정) */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">
          ④ 수식(파라미터) 편집 — 원본 요강과 대조해 고치세요
        </h2>
        <div className="flex flex-col gap-3">
          {spec.groups.map((g, gi) => (
            <div key={g.key} className="rounded-2xl border border-border p-4">
              <div className="mb-2 flex items-center gap-3">
                <span className="text-sm font-semibold">{g.key}군</span>
                <label className="flex items-center gap-1 text-xs text-muted">
                  반영비
                  <input type="number" value={g.reflectRatio} onChange={(e) => setRatio(gi, e.target.value)} className={`${cell} w-16`} />
                </label>
              </div>
              <div className="overflow-x-auto">
                <table className="text-xs">
                  <thead className="text-muted">
                    <tr>
                      <th className="px-1 py-0.5 text-left">등급</th>
                      {g.gradeScore.map((_, si) => (
                        <th key={si} className="px-1 py-0.5">{si + 1}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-1 py-0.5 text-muted">반영점수</td>
                      {g.gradeScore.map((v, si) => (
                        <td key={si} className="px-0.5 py-0.5">
                          <input type="number" value={v} onChange={(e) => setScore(gi, si, e.target.value)} className={`${cell} w-12 text-center`} />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted">
          여기서 고친 값은 위 계산·트레이스에 즉시 반영됩니다. (조합 구조 자체가 다른
          대학은 패턴 추가가 필요 — 그건 개발 영역)
        </p>
      </section>
    </div>
  );
}
