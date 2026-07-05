"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { Roster, RosterStudent } from "@/lib/builder/types";

// Class roster (명렬) management. Teacher builds a 반 with 학번·이름 (paste import).
// This gives students a stable identity used later to tie submissions across
// assignments and to let students revisit their own results.

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-brand";

function parseStudents(text: string): RosterStudent[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line
        .split(/[,\t]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length >= 2) {
        return { studentNo: parts[0], name: parts.slice(1).join(" ") };
      }
      const ws = line.split(/\s+/);
      if (ws.length >= 2) {
        return { studentNo: ws[0], name: ws.slice(1).join(" ") };
      }
      return { studentNo: "", name: line };
    });
}

function studentsToText(students: RosterStudent[]): string {
  return students.map((s) => `${s.studentNo}, ${s.name}`).join("\n");
}

// Map a sheet (array-of-arrays) to students. Finds 학번/이름 columns by header
// keyword; if no header is recognizable, assumes col0=학번, col1=이름.
function parseRosterFile(aoa: string[][]): RosterStudent[] {
  if (aoa.length === 0) return [];
  const header = aoa[0].map((c) => (c ?? "").trim());
  const findIdx = (kws: string[]) =>
    header.findIndex((h) => kws.some((k) => h.includes(k)));
  let snoIdx = findIdx(["학번", "번호"]);
  let nameIdx = findIdx(["이름", "성명", "성함"]);
  let dataStart = 1;
  if (snoIdx === -1 && nameIdx === -1) {
    snoIdx = 0;
    nameIdx = header.length > 1 ? 1 : -1;
    dataStart = 0;
  }
  const out: RosterStudent[] = [];
  for (let i = dataStart; i < aoa.length; i++) {
    const row = aoa[i];
    const studentNo = snoIdx >= 0 ? String(row[snoIdx] ?? "").trim() : "";
    const name = nameIdx >= 0 ? String(row[nameIdx] ?? "").trim() : "";
    if (!studentNo && !name) continue;
    out.push({ studentNo, name });
  }
  return out;
}

export function RosterManager() {
  const { user, loading, signInWithGoogle } = useAuth();

  const [rosters, setRosters] = useState<Roster[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [studentsText, setStudentsText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const loadRosters = useCallback(async () => {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch("/api/builder/rosters", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = (await res.json()) as { rosters: Roster[] };
      setRosters(data.rosters);
    }
  }, [user]);

  useEffect(() => {
    void loadRosters();
  }, [loadRosters]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setSchool("");
    setStudentsText("");
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const first = wb.SheetNames[0];
      const ws = first ? wb.Sheets[first] : undefined;
      if (!ws) {
        setParseError("파일을 읽지 못했어요.");
        return;
      }
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
        header: 1,
        blankrows: false,
        defval: "",
      });
      const rows = (aoa as unknown[][]).map((r) => r.map((c) => String(c ?? "")));
      const students = parseRosterFile(rows);
      if (students.length === 0) {
        setParseError("학생을 찾지 못했어요. 학번·이름 열이 있는지 확인해주세요.");
        return;
      }
      setStudentsText(studentsToText(students));
    } catch {
      setParseError(".xlsx, .xls, .csv 파일인지 확인해주세요.");
    } finally {
      e.target.value = ""; // allow re-uploading the same file
    }
  }

  function editRoster(r: Roster) {
    setEditingId(r.id);
    setName(r.name);
    setSchool(r.school);
    setStudentsText(studentsToText(r.students));
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }

  async function onSave() {
    if (busy || !user || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const url = editingId
        ? `/api/builder/rosters/${editingId}`
        : "/api/builder/rosters";
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          school: school.trim(),
          students: parseStudents(studentsText),
        }),
      });
      if (!res.ok) {
        setError("저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      resetForm();
      await loadRosters();
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-muted">···</p>;

  if (!user) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
        <h1 className="text-lg font-bold">명렬(반) 관리</h1>
        <p className="text-sm text-muted">
          반 명단을 만들려면 로그인이 필요합니다.
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

  const previewCount = parseStudents(studentsText).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">명렬(반) 관리</h1>
        <Link href="/builder" className="text-sm text-muted hover:text-foreground">
          ← 수업앱
        </Link>
      </div>

      <p className="rounded-xl border border-border bg-brand-soft p-3 text-xs leading-relaxed text-muted">
        반 명단을 만들어 두면, 학생이 이름 대신 <b>명단에서 자기 이름을 고르게</b> 할 수 있어요
        (다음 단계). 그러면 여러 과제·학년에 걸쳐 학생을 정확히 묶고, 생기부·첨언 열람이
        견고해집니다. 학번 기준이라 동명이인도 구분돼요.
      </p>

      {/* 만들기 / 편집 */}
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <span className="text-sm font-semibold">
          {editingId ? "명렬 편집" : "새 명렬 만들기"}
        </span>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="text-muted">반 이름</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 2학년 3반 / 통합사회 A"
              maxLength={60}
              className={inputClass}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="text-muted">학교</span>
            <input
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="예: OO고등학교"
              maxLength={60}
              className={inputClass}
            />
          </label>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted">
            엑셀/CSV로 올리기 (학번·이름 열이 있으면 자동 인식)
          </span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={onFile}
            className="text-sm"
          />
          {parseError && <p className="text-xs text-red-600">{parseError}</p>}
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">
            학생 명단 — 한 줄에 한 명: <span className="font-mono">학번, 이름</span>
          </span>
          <textarea
            value={studentsText}
            onChange={(e) => setStudentsText(e.target.value)}
            rows={8}
            placeholder={"20301, 김민수\n20302, 이서연\n20303, 박지호"}
            className={inputClass + " resize-y font-mono"}
          />
          <span className="text-xs text-muted">{previewCount}명 인식됨</span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={busy || !name.trim()}
            className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "저장 중…" : editingId ? "수정 저장" : "명렬 만들기"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full border border-border px-4 py-2 text-sm text-muted hover:border-brand"
            >
              취소
            </button>
          )}
        </div>
      </section>

      {/* 목록 */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">내 명렬</h2>
        {rosters.length === 0 ? (
          <p className="text-sm text-muted">아직 만든 명렬이 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rosters.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-3"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{r.name}</span>
                  <span className="text-xs text-muted">
                    {r.school ? `${r.school} · ` : ""}
                    학생 {r.students.length}명
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => editRoster(r)}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-brand"
                >
                  편집
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
