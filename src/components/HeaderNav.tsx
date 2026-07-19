"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// 헤더 내비. 콘텐츠 축으로 재편 — "받기(열람)"와 "올리기(기여)"를 두 문으로 분리:
//  - 직접 링크: 챗봇 · 일정표 (매일 꺼내 쓰는 것)
//  - 자료실 ▾ (받기, 비회원도 열람): 수업 자료(/board) · 진학 자료(/info)
//  - 공유 작업실 ▾ (올리기, 로그인): 대입[요강·내신·기타공유] / 고입[요강(준비중)]
//    / 수업[자료공유] + 정보 검토·보정. 소제목으로 구역을 나눔.
//  - 수업앱 (도구)

// 드롭다운 한 항목. 한 패널 안에서 링크 외에 구역 소제목(heading)·
// 준비중(soon, 비활성)·구분선(divider)을 섞어 2단 느낌을 낸다(플라이아웃 X).
interface NavItem {
  href?: string;
  label?: string;
  /** 구역 소제목 (예: "대입 자료"). 클릭 불가. */
  heading?: boolean;
  /** 아직 없는 기능 — 회색 + "준비 중" 배지, 클릭 불가(로드맵 신호). */
  soon?: boolean;
  /** 가로 구분선. */
  divider?: boolean;
}

function Dropdown({
  label,
  items,
  accent,
}: {
  label: string;
  items: NavItem[];
  accent?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          accent
            ? "inline-flex items-center gap-1 rounded-full border border-brand/40 px-3 py-1 text-sm font-medium text-brand hover:bg-brand-soft"
            : "inline-flex items-center gap-0.5 text-sm text-muted hover:text-foreground"
        }
      >
        {accent && <span className="text-xs">+</span>}
        {label}
        <span className="text-[10px]">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1.5 min-w-[11rem] rounded-xl border border-border bg-card p-1 shadow-lg">
          {items.map((it, i) => {
            if (it.divider) {
              return <div key={`d${i}`} className="my-1 border-t border-border" />;
            }
            if (it.heading) {
              return (
                <div
                  key={`h${i}`}
                  className="px-3 pb-1 pt-2 text-[11px] font-semibold tracking-wide text-muted"
                >
                  {it.label}
                </div>
              );
            }
            if (it.soon || !it.href) {
              return (
                <div
                  key={`s${i}`}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-muted/60"
                >
                  <span>{it.label}</span>
                  {it.soon && (
                    <span className="ml-2 rounded-full bg-border/60 px-1.5 py-0.5 text-[10px] text-muted">
                      준비 중
                    </span>
                  )}
                </div>
              );
            }
            return (
              <Link
                key={`${it.href}${i}`}
                href={it.href}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-brand-soft"
              >
                {it.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function HeaderNav() {
  return (
    <nav className="flex flex-1 flex-wrap items-center justify-evenly gap-x-4 gap-y-1">
      <Link
        href="/chat"
        className="text-sm font-medium text-brand hover:opacity-80"
      >
        챗봇
      </Link>
      <Link href="/schedule" className="text-sm text-muted hover:text-foreground">
        일정표
      </Link>
      <Dropdown
        label="자료실"
        items={[
          { href: "/board", label: "수업 자료" },
          { href: "/datasets", label: "진학 자료" },
          { href: "/info", label: "소식·정보" },
        ]}
      />
      <Dropdown
        label="공유 작업실"
        accent
        items={[
          { heading: true, label: "대입 자료" },
          { href: "/pdf", label: "요강 작업실 (PDF)" },
          { href: "/naeshin", label: "내신 검수 (베타)" },
          { href: "/board/new", label: "기타 자료 공유" },
          { heading: true, label: "고입 자료" },
          { soon: true, label: "요강 작업실" },
          { heading: true, label: "수업 자료" },
          { href: "/board/new", label: "자료 공유" },
          { divider: true },
          { href: "/info/review", label: "정보 검토 및 보정 요청" },
        ]}
      />
      <Link href="/builder" className="text-sm text-muted hover:text-foreground">
        수업앱
      </Link>
    </nav>
  );
}
