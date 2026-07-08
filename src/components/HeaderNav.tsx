"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// 헤더 내비. "쓰기(활용)"와 "올리기(기여)"를 행동 축으로 분리:
//  - 직접 링크: 오늘 수업 · 챗봇 · 일정표 (매일 꺼내 쓰는 것)
//  - 자료실 ▾: 데이터 · 자료 공유 · 정보 (둘러보는 지식 베이스)
//  - 올리기 ▾: 엑셀 데이터 / 자료 공유 글 (기여, 로그인)
//  - 수업앱 (도구)

interface NavItem {
  href: string;
  label: string;
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
        <div className="absolute left-0 top-full z-40 mt-1.5 min-w-[10rem] rounded-xl border border-border bg-card p-1 shadow-lg">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-brand-soft"
            >
              {it.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function HeaderNav() {
  return (
    <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <Link
        href="/today"
        className="text-sm font-medium text-brand hover:opacity-80"
      >
        오늘 수업
      </Link>
      <Link href="/chat" className="text-sm text-muted hover:text-foreground">
        챗봇
      </Link>
      <Link href="/schedule" className="text-sm text-muted hover:text-foreground">
        일정표
      </Link>
      <Dropdown
        label="자료실"
        items={[
          { href: "/datasets", label: "데이터" },
          { href: "/board", label: "자료 공유" },
          { href: "/info", label: "정보" },
        ]}
      />
      <Dropdown
        label="올리기"
        accent
        items={[
          { href: "/datasets/new", label: "엑셀 데이터 올리기" },
          { href: "/datasets/from-pdf", label: "요강 PDF에서 뽑기" },
          { href: "/board/new", label: "자료 공유 글쓰기" },
        ]}
      />
      <Link href="/builder" className="text-sm text-muted hover:text-foreground">
        수업앱
      </Link>
    </nav>
  );
}
