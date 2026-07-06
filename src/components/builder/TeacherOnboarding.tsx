"use client";

import { useState } from "react";
import type { User } from "firebase/auth";
import type { TeacherProfile, TeacherRole } from "@/lib/builder/types";

// Teacher onboarding form (진로교사 게이트). Shown after Google sign-in when the
// teacher has no profile yet. Requires school (the whole point) + role; name is
// prefilled from the Google account but editable. Not hard verification — a
// self-declaration that captures who's using the tool.

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-brand";

const REGIONS = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

const ROLES: { value: TeacherRole; label: string }[] = [
  { value: "career_lead", label: "진로전담교사" },
  { value: "subject", label: "진로담당(교과)" },
  { value: "homeroom", label: "담임" },
  { value: "admin", label: "관리자/부장" },
  { value: "other", label: "기타" },
];

export function TeacherOnboarding({
  user,
  onDone,
}: {
  user: User;
  onDone: (profile: TeacherProfile) => void;
}) {
  const [name, setName] = useState(user.displayName ?? "");
  const [school, setSchool] = useState("");
  const [region, setRegion] = useState("");
  const [role, setRole] = useState<TeacherRole>("career_lead");
  const [contact, setContact] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!name.trim() || !school.trim()) {
      setError("이름과 소속학교는 필수예요.");
      return;
    }
    if (!agree) {
      setError("진로교육 담당 교사 확인에 체크해 주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/builder/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          school: school.trim(),
          region,
          role,
          contact: contact.trim(),
        }),
      });
      if (!res.ok) {
        setError("저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      const data = (await res.json()) as { profile: TeacherProfile };
      onDone(data.profile);
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-bold">교사 정보 등록</h1>
        <p className="text-sm text-muted">
          수업앱 빌더는 <b>진로교육 담당 교사</b>를 위한 도구예요. 처음 오셨으니
          소속과 담당을 알려주세요. (한 번만 입력하면 됩니다)
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">이름 *</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">소속학교 *</span>
          <input
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            placeholder="예: OO고등학교"
            maxLength={60}
            className={inputClass}
            autoFocus
          />
        </label>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="text-muted">지역</span>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className={inputClass}
            >
              <option value="">선택</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="text-muted">담당</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as TeacherRole)}
              className={inputClass}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">연락처 (선택 — 학교 이메일/전화)</span>
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            maxLength={80}
            className={inputClass}
          />
        </label>

        <label className="flex items-start gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            본인은 학교에서 진로교육을 담당하는 교사이며, 입력한 정보가 사실임을
            확인합니다.
          </span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="self-start rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "저장 중…" : "시작하기"}
        </button>
      </form>
    </div>
  );
}
