"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  RecaptchaVerifier,
  linkWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  REGIONS,
  type MemberSchoolLevel,
  type TeacherProfile,
} from "@/lib/members/types";

// 회원 가입 — Google 로그인 → 교사 프로필(이름·학교급·학교명·지역) 입력 → 즉시 가입.
// 로그인은 부가 레이어라 열람은 가입 없이도 가능. 문제 계정은 관리자가 삭제.

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-brand";

/** 010-1234-5678 → +821012345678 (Firebase는 E.164만 받음). */
function toE164(raw: string): string {
  const d = raw.replace(/[^0-9]/g, "");
  if (d.startsWith("82")) return "+" + d;
  if (d.startsWith("0")) return "+82" + d.slice(1);
  return "+82" + d;
}

export default function SignupPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  // undefined = 아직 조회 전, null = 프로필 없음, 객체 = 있음
  const [profile, setProfile] = useState<TeacherProfile | null | undefined>(undefined);

  const [name, setName] = useState("");
  const [schoolLevel, setSchoolLevel] = useState<MemberSchoolLevel>("high");
  const [schoolName, setSchoolName] = useState("");
  const [region, setRegion] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // 휴대폰 SMS 인증 — 오타 방지가 목적이라, 인증을 마쳐야 가입이 된다.
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [sending, setSending] = useState(false);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  async function sendCode() {
    if (!user || !auth || sending) return;
    const e164 = toE164(phone);
    if (!/^\+82\d{9,10}$/.test(e164)) {
      setError("휴대폰 번호를 정확히 입력해주세요. (예: 010-1234-5678)");
      return;
    }
    setSending(true);
    setError(null);
    try {
      recaptchaRef.current?.clear();
      const verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
      });
      recaptchaRef.current = verifier;
      setConfirmation(await linkWithPhoneNumber(user, e164, verifier));
    } catch (e) {
      const c = (e as { code?: string })?.code ?? "unknown";
      const map: Record<string, string> = {
        "auth/operation-not-allowed":
          "전화 로그인이 아직 켜지지 않았어요. (관리자: Firebase → Authentication → 전화 사용 설정·저장)",
        "auth/unauthorized-domain":
          "이 사이트 도메인이 Firebase 승인 도메인에 없어요. (관리자 설정 필요)",
        "auth/credential-already-in-use": "이미 다른 계정에 등록된 번호예요.",
        "auth/invalid-phone-number": "번호 형식이 올바르지 않아요.",
        "auth/too-many-requests": "요청이 많아요. 잠시 후 다시 시도해주세요.",
        "auth/requires-recent-login": "보안을 위해 다시 로그인한 뒤 시도해주세요.",
        "auth/billing-not-enabled": "SMS를 보내려면 결제(Blaze)가 필요해요.",
        "auth/captcha-check-failed": "reCAPTCHA 확인 실패 — 새로고침 후 다시 시도해주세요.",
      };
      setError(
        (map[c] ?? "인증번호 발송에 실패했어요. 번호를 확인해주세요.") + ` [${c}]`,
      );
    } finally {
      setSending(false);
    }
  }

  async function verifyCode() {
    if (!confirmation || !user || sending) return;
    setSending(true);
    setError(null);
    try {
      await confirmation.confirm(code.trim());
      await user.getIdToken(true); // phone_number 클레임이 실리도록 토큰 갱신
      setPhoneVerified(true);
      setConfirmation(null);
    } catch {
      setError("인증번호가 맞지 않아요. 다시 확인해주세요.");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (!user) {
      setProfile(undefined);
      return;
    }
    let cancelled = false;
    // 이미 번호가 계정에 연결돼 있으면 인증 단계를 건너뛴다.
    if (user.phoneNumber) {
      setPhone(user.phoneNumber);
      setPhoneVerified(true);
    }
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/teachers/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        const data = res.ok
          ? ((await res.json()) as { profile: TeacherProfile | null; admin?: boolean })
          : { profile: null, admin: false };
        setProfile(data.profile);
        setIsAdmin(!!data.admin);
        if (data.profile) {
          setName(data.profile.name);
          setSchoolLevel(data.profile.schoolLevel);
          setSchoolName(data.profile.schoolName);
          setRegion(data.profile.region);
        } else if (user.displayName) {
          setName(user.displayName);
        }
      } catch {
        if (!cancelled) setProfile(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function submit() {
    if (!user || saving) return;
    if (!name.trim() || !schoolName.trim()) {
      setError("이름과 학교명을 입력해주세요.");
      return;
    }
    if (!phoneVerified) {
      setError("휴대폰 인증을 먼저 완료해주세요.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // 인증 직후의 phone_number 클레임이 확실히 실리도록 강제 갱신.
      const token = await user.getIdToken(true);
      const res = await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, schoolLevel, schoolName, region }),
      });
      if (!res.ok) {
        setError("저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      const { profile: saved } = (await res.json()) as { profile: TeacherProfile };
      setProfile(saved);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">회원 가입</h1>
        <p className="text-sm text-muted">
          Google로 로그인한 뒤 교사 정보를 입력하면 바로 가입돼요. (열람은 가입 없이도 가능)
        </p>
      </div>

      {isAdmin && (
        <Link
          href="/admin/members"
          className="self-start text-sm font-medium text-brand hover:underline"
        >
          관리자: 회원 관리 →
        </Link>
      )}

      {!user ? (
        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          disabled={loading}
          className="self-start rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "확인 중…" : "Google로 계속하기"}
        </button>
      ) : profile === undefined ? (
        <p className="text-sm text-muted">불러오는 중…</p>
      ) : (
        <div className="flex flex-col gap-4">
          {profile && (
            <div className="rounded-xl bg-green-50 px-4 py-3 text-sm leading-relaxed text-green-800">
              ✓ 가입되어 있어요. 아래에서 정보를 수정할 수 있습니다.
            </div>
          )}

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">이름</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className={inputClass} placeholder="예: 김진로" />
          </label>

          {/* 휴대폰 SMS 인증 — 오타 방지. 인증을 마쳐야 가입 버튼이 열린다. */}
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-medium">
              휴대폰 번호{" "}
              {phoneVerified && <span className="text-green-600">✓ 인증됨</span>}
            </span>
            {phoneVerified ? (
              <input value={phone} disabled className={`${inputClass} bg-neutral-50 text-muted`} />
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="010-1234-5678"
                    inputMode="tel"
                    disabled={!!confirmation}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => void sendCode()}
                    disabled={sending || !!confirmation}
                    className="shrink-0 rounded-lg border border-border px-3 text-xs hover:border-brand disabled:opacity-50"
                  >
                    {confirmation ? "발송됨" : sending ? "발송 중…" : "인증번호 받기"}
                  </button>
                </div>
                {confirmation && (
                  <div className="mt-1 flex gap-2">
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="인증번호 6자리"
                      inputMode="numeric"
                      maxLength={6}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => void verifyCode()}
                      disabled={sending}
                      className="shrink-0 rounded-lg bg-brand px-4 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      확인
                    </button>
                  </div>
                )}
                <span className="text-xs text-muted">
                  문자로 온 6자리 코드를 넣으면 번호가 확인돼요. (번호 오타 방지)
                </span>
              </>
            )}
          </div>
          {/* Firebase Phone Auth가 요구하는 보이지 않는 reCAPTCHA 자리 */}
          <div id="recaptcha-container" />

          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="font-medium">학교급</span>
              <select value={schoolLevel} onChange={(e) => setSchoolLevel(e.target.value as MemberSchoolLevel)} className={inputClass}>
                <option value="middle">중학교</option>
                <option value="high">고등학교</option>
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="font-medium">지역(시도)</span>
              <select value={region} onChange={(e) => setRegion(e.target.value)} className={inputClass}>
                <option value="">선택</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">학교명</span>
            <input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} maxLength={80} className={inputClass} placeholder="예: ○○고등학교" />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving || !phoneVerified}
            title={!phoneVerified ? "휴대폰 인증을 먼저 완료해주세요." : undefined}
            className="self-start rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "저장 중…" : profile ? "정보 수정" : "가입하기"}
          </button>
          <p className="text-xs text-muted">가입 계정: {user.email}</p>
        </div>
      )}
    </div>
  );
}
