"use client";

import { useState } from "react";

// Login gate for roster (학급) apps. Identity = a self-chosen 아이디 that stays
// the same across years; 학번 is a per-class enrollment attached to it.
//
//   로그인 (returning): 아이디 + 비밀번호. If the account isn't enrolled in THIS
//     class yet (new grade/year), it asks for this class's 학번 once and attaches
//     it — the same account, updated.
//   가입 (first time): 학번 → server confirms class membership + the roster name
//     (the student never types their own name) → choose 아이디 + 비밀번호.

export interface StudentIdentity {
  loginId: string;
  name: string;
  studentNo: string;
  password: string;
}

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-brand";
const primaryBtn =
  "rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50";
const ghostBtn =
  "rounded-full border border-border px-4 py-2 text-sm text-muted hover:border-brand";

export function StudentAuthGate({
  appTitle,
  code,
  onAuthed,
}: {
  appTitle: string;
  code: string;
  onAuthed: (id: StudentIdentity) => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [studentNo, setStudentNo] = useState("");
  const [name, setName] = useState<string | null>(null); // resolved (roster/account) name
  const [needEnroll, setNeedEnroll] = useState(false); // logged in but not in this class
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function switchMode(next: "login" | "register") {
    setMode(next);
    setName(null);
    setNeedEnroll(false);
    setStudentNo("");
    setPassword("");
    setError(null);
  }

  async function post<T>(path: string, payload: unknown): Promise<Response> {
    return fetch(`/api/builder/students/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  // ── 로그인 ────────────────────────────────────────────────────────────────
  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !loginId.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      const res = await post("auth", { code, loginId: loginId.trim(), password });
      const data = (await res.json()) as {
        name?: string;
        enrolled?: boolean;
        studentNo?: string;
      };
      if (res.status === 401) {
        setError("아이디 또는 비밀번호가 틀려요.");
        return;
      }
      if (!res.ok) {
        setError("로그인에 실패했어요. 다시 시도해 주세요.");
        return;
      }
      if (data.enrolled) {
        onAuthed({
          loginId: loginId.trim(),
          name: data.name ?? "",
          studentNo: data.studentNo ?? "",
          password,
        });
      } else {
        // Account exists but isn't in this class yet — grade/year changed.
        setName(data.name ?? "");
        setNeedEnroll(true);
      }
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setBusy(false);
    }
  }

  async function onEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !studentNo.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await post("enroll", {
        code,
        loginId: loginId.trim(),
        password,
        studentNo: studentNo.trim(),
      });
      const data = (await res.json()) as { name?: string; studentNo?: string };
      if (res.status === 403) {
        setError("명단에 없는 학번이에요. 담당 선생님께 문의하세요.");
        return;
      }
      if (res.status === 409) {
        setError("이미 다른 학생이 등록한 학번이에요.");
        return;
      }
      if (!res.ok) {
        setError("등록에 실패했어요. 다시 시도해 주세요.");
        return;
      }
      onAuthed({
        loginId: loginId.trim(),
        name: data.name ?? name ?? "",
        studentNo: data.studentNo ?? studentNo.trim(),
        password,
      });
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setBusy(false);
    }
  }

  // ── 가입 ──────────────────────────────────────────────────────────────────
  async function onCheck(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !studentNo.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await post("check", { code, studentNo: studentNo.trim() });
      const data = (await res.json()) as {
        inRoster?: boolean;
        name?: string;
        claimed?: boolean;
      };
      if (!res.ok) {
        setError("확인에 실패했어요.");
        return;
      }
      if (!data.inRoster) {
        setError("명단에 없는 학번이에요. 담당 선생님께 문의하세요.");
        return;
      }
      if (data.claimed) {
        setError("이미 가입된 학번이에요. 위에서 '로그인'으로 들어오세요.");
        return;
      }
      setName(data.name ?? "");
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setBusy(false);
    }
  }

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (loginId.trim().length < 3) {
      setError("아이디는 3자 이상으로 정해 주세요.");
      return;
    }
    if (password.length < 4) {
      setError("비밀번호는 4자 이상으로 정해 주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await post("register", {
        code,
        studentNo: studentNo.trim(),
        loginId: loginId.trim(),
        password,
      });
      const data = (await res.json()) as { name?: string; studentNo?: string };
      if (res.status === 409) {
        const body = data as { error?: string };
        setError(
          body.error === "no_taken"
            ? "방금 다른 학생이 이 학번을 가입했어요. 선생님께 문의하세요."
            : "이미 사용 중인 아이디예요. 다른 아이디로 정해 주세요.",
        );
        return;
      }
      if (!res.ok) {
        setError("가입에 실패했어요. 다시 시도해 주세요.");
        return;
      }
      onAuthed({
        loginId: loginId.trim(),
        name: data.name ?? name ?? "",
        studentNo: data.studentNo ?? studentNo.trim(),
        password,
      });
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
      <h1 className="text-lg font-bold">{appTitle}</h1>

      <div className="flex gap-1 rounded-full border border-border p-1 text-sm">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={`flex-1 rounded-full px-3 py-1.5 font-medium transition ${
              mode === m ? "bg-brand text-white" : "text-muted hover:text-foreground"
            }`}
          >
            {m === "login" ? "로그인" : "처음이에요 (가입)"}
          </button>
        ))}
      </div>

      {mode === "login" && !needEnroll && (
        <form onSubmit={onLogin} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">아이디</span>
            <input
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              maxLength={30}
              autoCapitalize="none"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy || !loginId.trim() || !password}
            className={`self-start ${primaryBtn}`}
          >
            {busy ? "확인 중…" : "로그인"}
          </button>
        </form>
      )}

      {mode === "login" && needEnroll && (
        <form onSubmit={onEnroll} className="flex flex-col gap-3">
          <p className="text-sm">
            <span className="font-semibold">{name}</span>님, 새 학급이네요.{" "}
            <span className="text-muted">이번 반 학번을 입력하면 이어집니다.</span>
          </p>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">이번 학년 학번</span>
            <input
              value={studentNo}
              onChange={(e) => setStudentNo(e.target.value)}
              maxLength={20}
              placeholder="예: 20301"
              className={inputClass}
              autoFocus
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !studentNo.trim()} className={primaryBtn}>
              {busy ? "등록 중…" : "등록하고 시작"}
            </button>
            <button
              type="button"
              onClick={() => {
                setNeedEnroll(false);
                setStudentNo("");
                setError(null);
              }}
              className={ghostBtn}
            >
              뒤로
            </button>
          </div>
        </form>
      )}

      {mode === "register" && name === null && (
        <form onSubmit={onCheck} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">학번</span>
            <input
              value={studentNo}
              onChange={(e) => setStudentNo(e.target.value)}
              maxLength={20}
              placeholder="예: 20301"
              className={inputClass}
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy || !studentNo.trim()}
            className={`self-start ${primaryBtn}`}
          >
            {busy ? "확인 중…" : "다음"}
          </button>
        </form>
      )}

      {mode === "register" && name !== null && (
        <form onSubmit={onRegister} className="flex flex-col gap-3">
          <p className="text-sm">
            <span className="font-semibold">{name}</span>님, 반가워요.{" "}
            <span className="text-muted">앞으로 쓸 아이디와 비밀번호를 정하세요.</span>
          </p>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">아이디 (3자 이상, 매년 그대로 씁니다)</span>
            <input
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              maxLength={30}
              autoCapitalize="none"
              className={inputClass}
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">비밀번호 (4자 이상, 잊지 마세요)</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className={primaryBtn}>
              {busy ? "가입 중…" : "가입하고 시작"}
            </button>
            <button
              type="button"
              onClick={() => {
                setName(null);
                setError(null);
              }}
              className={ghostBtn}
            >
              학번 다시
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
