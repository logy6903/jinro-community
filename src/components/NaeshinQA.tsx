"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { computeNaeshin } from "@/lib/naeshin/engine";
import type { NaeshinSpec, TranscriptSubject } from "@/lib/naeshin/types";
import type { PdfSource } from "@/lib/domain/types";

// 내신 산출 검수 — 요강에서 spec 추출 → 트레이스로 검증·수식 편집 → 저장까지 한 화면.
// 엔진은 순수 TS라 브라우저 실시간 계산. 추출(AI)은 로그인 게이트, 저장도 로그인.

const SAMPLE: TranscriptSubject[] = [
  { name: "국어", group: "A", grade: 1, units: 4 },
  { name: "수학", group: "A", grade: 2, units: 4 },
  { name: "영어", group: "A", grade: 1, units: 4 },
  { name: "한국사", group: "A", grade: 3, units: 2 },
  { name: "기술가정", group: "B", grade: 2, units: 2 },
  { name: "한문", group: "B", grade: 3, units: 3 },
];

const fmt = (n: number) => (Math.round(n * 100) / 100).toString();
const cell =
  "w-full rounded border border-border bg-card px-2 py-1 text-sm outline-none focus:border-brand";

function specId(sourceId: string, track: string): string {
  return `${sourceId}-${track}`.replace(/[^0-9a-z가-힣-]/gi, "").slice(0, 100) || sourceId;
}

export function NaeshinQA({
  seed,
  persisted,
  sources,
}: {
  seed: NaeshinSpec;
  persisted: NaeshinSpec[];
  sources: PdfSource[];
}) {
  const { user, signInWithGoogle } = useAuth();
  const all = useMemo(() => [seed, ...persisted], [seed, persisted]);

  const [spec, setSpec] = useState<NaeshinSpec>(() => structuredClone(seed));
  const [subjects, setSubjects] = useState<TranscriptSubject[]>(SAMPLE);
  const [expected, setExpected] = useState("");

  // 요강 추출 컨트롤
  const [srcId, setSrcId] = useState(sources[0]?.id ?? "");
  const [page, setPage] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const result = useMemo(() => computeNaeshin(spec, subjects), [spec, subjects]);
  const expNum = expected.trim() === "" ? null : Number(expected);
  const diff = expNum !== null && Number.isFinite(expNum) ? result.total - expNum : null;
  const matched = diff !== null && Math.abs(diff) < 0.1;

  function pickSpec(id: string) {
    const s = all.find((x) => x.id === id);
    if (s) {
      setSpec(structuredClone(s));
      setMsg(null);
    }
  }

  async function runExtract() {
    if (extracting || !srcId) return;
    if (!user) {
      await signInWithGoogle();
      return;
    }
    const p = Number(page);
    if (!Number.isFinite(p)) {
      setMsg("정량평가가 있는 페이지 번호를 입력하세요.");
      return;
    }
    setExtracting(true);
    setMsg(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/pdf/${srcId}/naeshin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ page: p }),
      });
      if (!res.ok) {
        setMsg(res.status === 503 ? "추출 미설정(ANTHROPIC_API_KEY)" : "추출 실패");
        return;
      }
      const ex = (await res.json()) as Omit<NaeshinSpec, "id">;
      setSpec({ ...ex, id: specId(ex.sourceId ?? srcId, ex.track) });
      setMsg("추출됨 — 원본과 대조해 확인·수정 후 저장하세요.");
    } catch {
      setMsg("네트워크 오류");
    } finally {
      setExtracting(false);
    }
  }

  async function save() {
    if (saving) return;
    if (!user) {
      await signInWithGoogle();
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/naeshin/specs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(spec),
      });
      setMsg(res.ok ? "저장됨 ✓" : "저장 실패");
    } catch {
      setMsg("네트워크 오류");
    } finally {
      setSaving(false);
    }
  }

  // 편집 핸들러
  const setSub = (i: number, k: keyof TranscriptSubject, v: string) =>
    setSubjects((rs) =>
      rs.map((r, idx) =>
        idx === i ? { ...r, [k]: k === "grade" || k === "units" ? Number(v) : v } : r,
      ),
    );
  const addSub = () =>
    setSubjects((rs) => [...rs, { name: "", group: "A", grade: 1, units: 1 }]);
  const delSub = (i: number) => setSubjects((rs) => rs.filter((_, idx) => idx !== i));
  const setScore = (gi: number, si: number, v: string) =>
    setSpec((s) => ({
      ...s,
      groups: s.groups.map((g, idx) =>
        idx === gi
          ? { ...g, gradeScore: g.gradeScore.map((x, j) => (j === si ? Number(v) : x)) }
          : g,
      ),
    }));
  const setRatio = (gi: number, v: string) =>
    setSpec((s) => ({
      ...s,
      groups: s.groups.map((g, idx) => (idx === gi ? { ...g, reflectRatio: Number(v) } : g)),
    }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">내신 산출 검수</h1>
        <p className="text-sm text-muted">
          {spec.university || "—"} · {spec.track || "—"} · 정량 만점 {spec.maxScore}
        </p>
      </div>

      {/* spec 선택 / 요강 추출 / 저장 */}
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted">저장된 spec</label>
          <select value={spec.id} onChange={(e) => pickSpec(e.target.value)} className={`${cell} w-64`}>
            {all.map((s) => (
              <option key={s.id} value={s.id}>
                {s.university} · {s.track}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="ml-auto rounded-full border border-border px-4 py-1.5 text-sm text-brand hover:border-brand disabled:opacity-50"
          >
            {saving ? "저장 중…" : "이 spec 저장"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <label className="text-xs text-muted">요강에서 추출</label>
          <select value={srcId} onChange={(e) => setSrcId(e.target.value)} className={`${cell} w-52`}>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.university} {s.admissionYear}
              </option>
            ))}
          </select>
          <input
            value={page}
            onChange={(e) => setPage(e.target.value)}
            placeholder="정량평가 페이지"
            className={`${cell} w-32`}
          />
          <button
            type="button"
            onClick={() => void runExtract()}
            disabled={extracting}
            className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {extracting ? "추출 중…" : "추출"}
          </button>
          {msg && <span className="text-xs text-muted">{msg}</span>}
        </div>
      </section>

      {/* ① 성적표 */}
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

      {/* 결과 + 오차 */}
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
            style={matched ? { background: "#E1F5EE", color: "#0F6E56" } : { background: "#FCE4E4", color: "#A32D2D" }}
          >
            {matched ? "✓ 일치" : `오차 ${fmt(diff)}`}
          </div>
        )}
      </section>

      {/* ② 트레이스 */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">② 계산 과정 (트레이스)</h2>
        <div className="flex flex-col gap-3">
          {result.groups.map((g) => (
            <div key={g.key} className="rounded-2xl border border-border p-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-semibold">{g.key}군</span>
                <span className="text-sm">
                  최종 <b>{fmt(g.finalScore)}</b>
                </span>
              </div>
              {g.subjects.length > 0 ? (
                <div className="text-xs">
                  {g.subjects.map((s, i) => (
                    <span key={i} className="mr-2 inline-block text-foreground/80">
                      {s.name}({s.grade}→{s.score}×{s.units})
                    </span>
                  ))}
                  <div className="mt-1 text-muted">
                    Σ={fmt(g.sumWeighted)} / {fmt(g.sumUnits)} = 1차 {fmt(g.firstScore)} × {g.reflectRatio} ={" "}
                    <b className="text-foreground">{fmt(g.finalScore)}</b>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted">해당 과목 없음</p>
              )}
            </div>
          ))}
          {result.ignored.length > 0 && (
            <p className="text-xs text-muted">미반영: {result.ignored.join(", ")}</p>
          )}
        </div>
      </section>

      {/* ④ 수식(파라미터) 편집 */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">④ 수식(파라미터) 편집 — 원본 요강과 대조</h2>
        <div className="flex flex-col gap-3">
          {spec.groups.map((g, gi) => (
            <div key={gi} className="rounded-2xl border border-border p-4">
              <div className="mb-2 flex items-center gap-3">
                <span className="text-sm font-semibold">{g.key}군</span>
                <label className="flex items-center gap-1 text-xs text-muted">
                  반영비
                  <input type="number" value={g.reflectRatio} onChange={(e) => setRatio(gi, e.target.value)} className={`${cell} w-16`} />
                </label>
                <span className="truncate text-xs text-muted">{g.name}</span>
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
          여기서 고친 값은 위 계산에 즉시 반영됩니다. 원본과 맞으면 위 &lsquo;이 spec 저장&rsquo;.
        </p>
      </section>
    </div>
  );
}
