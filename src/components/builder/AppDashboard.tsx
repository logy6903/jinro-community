"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { BuilderApp, Submission } from "@/lib/builder/types";

// Per-app teacher dashboard: the shareable link + a live table of submissions.
// Owner-gated by the authenticated fetch (the API returns 403 for others).

export function AppDashboard({ appId }: { appId: string }) {
  const { user, loading, signInWithGoogle } = useAuth();
  const [app, setApp] = useState<BuilderApp | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "denied" | "error">(
    "idle",
  );
  const [copied, setCopied] = useState(false);
  const [qrBig, setQrBig] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setState("loading");
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/builder/apps/${appId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403 || res.status === 404) {
        setState("denied");
        return;
      }
      if (!res.ok) {
        setState("error");
        return;
      }
      const data = (await res.json()) as {
        app: BuilderApp;
        submissions: Submission[];
      };
      setApp(data.app);
      setSubmissions(data.submissions);
      setState("idle");
    } catch {
      setState("error");
    }
  }, [user, appId]);

  useEffect(() => {
    void load();
  }, [load]);

  const shareUrl =
    app && typeof window !== "undefined"
      ? `${window.location.origin}/a/${app.code}`
      : app
        ? `/a/${app.code}`
        : "";

  function copy() {
    if (!shareUrl) return;
    void navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (loading) return <p className="text-sm text-muted">···</p>;

  if (!user) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
        <p className="text-sm text-muted">결과를 보려면 로그인이 필요합니다.</p>
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

  if (state === "denied") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">이 앱의 결과를 볼 권한이 없어요.</p>
        <Link href="/builder" className="text-sm text-brand hover:underline">
          ← 내 앱 목록으로
        </Link>
      </div>
    );
  }

  if (state === "loading" || !app) {
    return <p className="text-sm text-muted">불러오는 중…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/builder" className="text-sm text-muted hover:text-foreground">
        ← 내 앱 목록으로
      </Link>

      <header className="flex flex-col gap-3">
        <h1 className="text-xl font-bold">{app.title}</h1>
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
          <span className="text-xs text-muted">학생에게 공유할 링크</span>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand">
              {shareUrl}
            </code>
            <button
              type="button"
              onClick={copy}
              className="rounded-full border border-border px-3 py-2 text-xs hover:border-brand"
            >
              {copied ? "복사됨" : "복사"}
            </button>
          </div>

          {shareUrl && (
            <div className="flex items-center gap-3">
              <div className="rounded-lg border border-border bg-white p-2">
                <QRCodeSVG value={shareUrl} size={96} />
              </div>
              <div className="flex flex-col items-start gap-1">
                <span className="text-xs text-muted">학생이 폰으로 스캔해 바로 접속</span>
                <button
                  type="button"
                  onClick={() => setQrBig(true)}
                  className="rounded-full border border-border px-3 py-1 text-xs hover:border-brand"
                >
                  QR 크게 보기 (교실 화면용)
                </button>
              </div>
            </div>
          )}

          <span className="text-xs text-muted">
            공유 코드 <span className="font-mono">{app.code}</span>
          </span>

          {qrBig && shareUrl && (
            <div
              className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center gap-6 bg-white p-8"
              onClick={() => setQrBig(false)}
              role="button"
              tabIndex={0}
            >
              <h2 className="text-center text-2xl font-bold text-neutral-900">{app.title}</h2>
              <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                <QRCodeSVG value={shareUrl} size={340} />
              </div>
              <p className="text-lg text-neutral-500">폰 카메라로 QR을 스캔하세요</p>
              <code className="rounded-lg bg-brand-soft px-4 py-2 text-sm text-brand">{shareUrl}</code>
              <span className="text-xs text-neutral-400">화면을 누르면 닫힘</span>
            </div>
          )}
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted">
          제출 {submissions.length}건
        </h2>
        {submissions.length === 0 ? (
          <p className="text-sm text-muted">아직 제출이 없어요.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="py-2 pr-3 font-medium">학번</th>
                  <th className="py-2 pr-3 font-medium">이름</th>
                  {app.fields.map((f) => (
                    <th key={f.id} className="py-2 pr-3 font-medium">
                      {f.label}
                    </th>
                  ))}
                  {app.aiBlocks.map((b) => (
                    <th key={b.id} className="py-2 pr-3 font-medium text-brand">
                      🤖 {b.title}
                    </th>
                  ))}
                  <th className="py-2 font-medium">제출 시각</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.id} className="border-b border-border align-top">
                    <td className="py-2 pr-3">{s.studentNo}</td>
                    <td className="py-2 pr-3">{s.studentName}</td>
                    {app.fields.map((f) => (
                      <td key={f.id} className="py-2 pr-3 whitespace-pre-wrap">
                        {s.answers[f.id] !== undefined
                          ? String(s.answers[f.id])
                          : "—"}
                      </td>
                    ))}
                    {app.aiBlocks.map((b) => (
                      <td
                        key={b.id}
                        className="max-w-[16rem] whitespace-pre-wrap py-2 pr-3 text-xs text-muted"
                      >
                        {s.aiOutputs?.[b.id] ?? "—"}
                      </td>
                    ))}
                    <td className="py-2 text-xs text-muted">
                      {s.submittedAt.slice(0, 16).replace("T", " ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
