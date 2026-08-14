"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

// 헤더에 다는 커뮤니티 홍보용 QR. 항상 사이트 첫 화면(가입 안내)을 가리키는
// 고정 QR이다 — 선생님들에게 보여주고 스캔시켜 가입시키는 용도.
//
// 예전엔 "현재 페이지 주소"를 담았는데, 회원 전용 페이지가 대부분이라 비회원이
// 스캔하면 결국 가입 화면으로 튕겼고(=주소만 다르고 결과는 같음) 페이지마다
// 모양이 바뀌어 혼란스러웠다. 그래서 고정 주소로 바꿨다.
//
// 학생에게 나눠주는 QR은 이것과 별개다 — 수업앱 화면 아래쪽의 "학생 배포용 QR".

export function HeaderQr() {
  const [url, setUrl] = useState("");
  const [big, setBig] = useState(false);

  // 사이트 첫 화면 주소로 고정 (페이지를 옮겨다녀도 바뀌지 않는다).
  useEffect(() => {
    if (typeof window !== "undefined") setUrl(window.location.origin + "/");
  }, []);

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
        onClick={() => setBig(true)}
        title="커뮤니티 홍보용 QR — 선생님께 보여주고 스캔하면 가입 안내로 연결됩니다"
        aria-label="커뮤니티 홍보용 QR 크게 보기"
        className="flex items-center gap-1 rounded-md border border-border bg-white px-1 py-1 leading-none transition-shadow hover:shadow-md"
      >
        <QRCodeSVG value={url} size={26} />
        <span className="pr-0.5 text-[9px] leading-tight text-neutral-500">
          가입 안내
        </span>
      </button>

      {big && (
        <div
          className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center gap-6 bg-white p-8"
          onClick={() => setBig(false)}
          role="button"
          tabIndex={0}
        >
          <span className="rounded-full border border-neutral-300 px-3 py-1 text-sm font-medium text-neutral-600">
            선생님 가입 안내 QR
          </span>
          <h2 className="text-center text-2xl font-bold text-neutral-900">
            진로교사 커뮤니티
          </h2>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <QRCodeSVG value={url} size={320} />
          </div>
          <p className="text-lg text-neutral-500">
            폰 카메라로 스캔하면 가입 안내 화면이 열립니다
          </p>
          <code className="max-w-[90vw] truncate rounded-lg bg-brand-soft px-4 py-2 text-sm text-brand">
            {url}
          </code>
          <span className="text-xs text-neutral-400">화면을 누르거나 ESC로 닫힘</span>
        </div>
      )}
    </>
  );
}
