"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

// "학생 배포용 QR" 버튼. 앱 목록·상세 어디서든 한 번 눌러 교실 화면용 큰 QR을
// 띄운다. 헤더의 가입 안내 QR과 구별되도록 항상 "학생 배포용"이라고 밝힌다.
//
// 학생 링크(/a/{code})는 회원 게이트 밖이라 학생은 로그인 없이 들어간다.

export function StudentQrButton({
  code,
  title,
  className,
  label = "QR 배포",
}: {
  /** 앱 공유 코드 (/a/{code}). */
  code: string;
  /** 앱 제목 — 확대 화면에 표시. */
  title: string;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setUrl(`${window.location.origin}/a/${code}`);
    }
  }, [code]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="학생에게 나눠줄 QR 띄우기 (교실 화면용)"
        className={
          className ??
          "rounded-full bg-brand px-3 py-1 text-xs font-medium text-white hover:opacity-90"
        }
      >
        {label}
      </button>

      {open && url && (
        <div
          className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center gap-6 bg-white p-8"
          onClick={() => setOpen(false)}
          role="button"
          tabIndex={0}
        >
          <span className="rounded-full bg-brand px-3 py-1 text-sm font-medium text-white">
            학생 배포용 QR
          </span>
          <h2 className="text-center text-2xl font-bold text-neutral-900">{title}</h2>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <QRCodeSVG value={url} size={340} />
          </div>
          <p className="text-lg text-neutral-500">
            학생은 폰 카메라로 스캔하면 바로 들어옵니다 (로그인 없음)
          </p>
          <code className="rounded-lg bg-brand-soft px-4 py-2 text-sm text-brand">
            {url}
          </code>
          <span className="text-xs text-neutral-400">화면을 누르거나 ESC로 닫힘</span>
        </div>
      )}
    </>
  );
}
