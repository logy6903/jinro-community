"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { Roster } from "@/lib/builder/types";

// Teacher panel: the student accounts tied to one roster. Shows who has
// registered (아이디) and lets the teacher fix what students can't — reset a
// forgotten password, correct a locked name, or detach a wrongly-claimed 학번.

interface AccountLink {
  studentNo: string;
  name: string;
  loginId: string | null;
}

type Active = { no: string; kind: "rename" | "reset"; value: string };

const inputSm =
  "rounded-lg border border-border bg-card px-2 py-1 text-sm outline-none focus:border-brand";
const chip = "rounded-full border border-border px-2.5 py-1 text-xs hover:border-brand";

function errorMessage(code: unknown): string {
  switch (code) {
    case "weak_password":
      return "비밀번호는 4자 이상이어야 해요.";
    case "not_registered":
      return "아직 가입하지 않은 학생이에요.";
    case "not_in_roster":
      return "명단에서 찾지 못했어요.";
    default:
      return "처리에 실패했어요. 다시 시도해 주세요.";
  }
}

export function RosterAccounts({
  roster,
  onChanged,
}: {
  roster: Roster;
  onChanged?: () => void;
}) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<AccountLink[] | null>(null);
  const [active, setActive] = useState<Active | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch(`/api/builder/rosters/${roster.id}/accounts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const d = (await res.json()) as { accounts: AccountLink[] };
      setAccounts(d.accounts);
    } else {
      setError("계정 정보를 불러오지 못했어요.");
    }
  }, [user, roster.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(
    action: "rename" | "reset_password" | "unenroll",
    studentNo: string,
    extra?: Record<string, string>,
  ) {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/builder/rosters/${roster.id}/accounts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, studentNo, ...extra }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: unknown };
        setError(errorMessage(d.error));
        return;
      }
      setActive(null);
      await load();
      if (action === "rename" || action === "unenroll") onChanged?.();
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setBusy(false);
    }
  }

  if (accounts === null) {
    return <p className="px-1 py-2 text-xs text-muted">계정 정보를 불러오는 중…</p>;
  }

  const registered = accounts.filter((a) => a.loginId).length;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted">
        가입 {registered} / {accounts.length}명 · 이름은 학생이 못 바꿔요(여기서 수정).
        비밀번호를 잊으면 초기화해 주세요.
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-1 pr-3 font-medium">학번</th>
              <th className="py-1 pr-3 font-medium">이름</th>
              <th className="py-1 pr-3 font-medium">아이디</th>
              <th className="py-1 font-medium">관리</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => {
              const editing = active && active.no === a.studentNo ? active : null;
              const renaming = editing?.kind === "rename";
              const resetting = editing?.kind === "reset";
              return (
                <tr key={a.studentNo} className="border-t border-border align-top">
                  <td className="py-2 pr-3 font-mono text-xs">{a.studentNo}</td>
                  <td className="py-2 pr-3">
                    {renaming ? (
                      <div className="flex items-center gap-1">
                        <input
                          value={editing!.value}
                          onChange={(e) =>
                            setActive({ ...editing!, value: e.target.value })
                          }
                          maxLength={40}
                          className={inputSm + " w-24"}
                          autoFocus
                        />
                        <button
                          type="button"
                          disabled={busy || !editing!.value.trim()}
                          onClick={() =>
                            void act("rename", a.studentNo, {
                              name: editing!.value.trim(),
                            })
                          }
                          className={chip + " border-brand text-brand"}
                        >
                          저장
                        </button>
                        <button
                          type="button"
                          onClick={() => setActive(null)}
                          className={chip}
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      a.name || <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    {a.loginId ? (
                      <span className="font-mono text-xs">{a.loginId}</span>
                    ) : (
                      <span className="text-xs text-muted">미가입</span>
                    )}
                  </td>
                  <td className="py-2">
                    {resetting ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editing!.value}
                          onChange={(e) =>
                            setActive({ ...editing!, value: e.target.value })
                          }
                          placeholder="새 비밀번호"
                          className={inputSm + " w-28"}
                          autoFocus
                        />
                        <button
                          type="button"
                          disabled={busy || editing!.value.length < 4}
                          onClick={() =>
                            void act("reset_password", a.studentNo, {
                              password: editing!.value,
                            })
                          }
                          className={chip + " border-brand text-brand"}
                        >
                          설정
                        </button>
                        <button
                          type="button"
                          onClick={() => setActive(null)}
                          className={chip}
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setActive({ no: a.studentNo, kind: "rename", value: a.name })
                          }
                          className={chip}
                        >
                          이름
                        </button>
                        <button
                          type="button"
                          disabled={!a.loginId}
                          onClick={() =>
                            setActive({ no: a.studentNo, kind: "reset", value: "" })
                          }
                          className={chip + " disabled:opacity-40"}
                        >
                          비번 초기화
                        </button>
                        <button
                          type="button"
                          disabled={!a.loginId}
                          onClick={() => {
                            if (
                              typeof window !== "undefined" &&
                              window.confirm(
                                `${a.name} 학생의 이 반 계정 연결을 해제할까요?\n학생은 다시 가입해야 합니다. (다른 학년 기록은 유지)`,
                              )
                            ) {
                              void act("unenroll", a.studentNo);
                            }
                          }}
                          className={chip + " text-red-600 disabled:opacity-40"}
                        >
                          연결 해제
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
