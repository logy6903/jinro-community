"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

// 헤더에 다는 "이 페이지 QR". 현재 페이지의 전체 URL을 담아, 미니 QR을 헤더에
// 보여주고 누르면 전체화면으로 확대(교실 화면·단톡방 공유용). 라우트가 바뀌면
// URL도 따라 갱신하고, 열 때 한 번 더 최신화(쿼리 변화 반영). 순수 클라이언트.
// useSearchParams는 정적 페이지 빌드에서 Suspense 경계를 요구하므로 쓰지 않는다.

export function HeaderQr() {
  const pathname = usePathname();
  const [url, setUrl] = useState("");
  const [big, setBig] = useState(false);

  const refresh = () => {
    if (typeof window !== "undefined") setUrl(window.location.href);
  };

  // 라우트 변화에 맞춰 URL 갱신 (SSR 가드).
  useEffect(() => {
    refresh();
  }, [pathname]);

  // 확대 중 ESC로 닫기.
  useEffect(() => {
    if (!big) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setBig(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [big]);

  if (!url) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          refresh();
          setBig(true);
        }}
        title="이 페이지 QR — 눌러서 크게 보기"
        aria-label="이 페이지 QR 크게 보기"
        className="rounded-md border border-border bg-white p-1 leading-none transition-shadow hover:shadow-md"
      >
        <QRCodeSVG value={url} size={26} />
      </button>

      {big && (
        <div
          className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center gap-6 bg-white p-8"
          onClick={() => setBig(false)}
          role="button"
          tabIndex={0}
        >
          <h2 className="text-center text-2xl font-bold text-neutral-900">
            진로교사 커뮤니티
          </h2>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <QRCodeSVG value={url} size={320} />
          </div>
          <p className="text-lg text-neutral-500">폰 카메라로 QR을 스캔하세요</p>
          <code className="max-w-[90vw] truncate rounded-lg bg-brand-soft px-4 py-2 text-sm text-brand">
            {url}
          </code>
          <span className="text-xs text-neutral-400">화면을 누르거나 ESC로 닫힘</span>
        </div>
      )}
    </>
  );
}
