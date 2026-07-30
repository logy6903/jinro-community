"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";

// 관리자에게만 보이는 헤더 진입구. 관리자 판별은 서버(ADMIN_EMAILS)가 하고,
// 여기선 /api/teachers/me의 admin 플래그만 받는다 — 클라이언트에 관리자 명단이
// 노출되지 않는다. 비관리자·비로그인은 아무것도 렌더하지 않음(링크 자체가 숨음).
// 실제 접근 통제는 서버 API(403)가 담당하므로 이 숨김은 편의일 뿐.

export function AdminMenu() {
  const { user } = useAuth();
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      setAdmin(false);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/teachers/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const { admin: isAdmin } = (await res.json()) as { admin?: boolean };
        if (alive) setAdmin(Boolean(isAdmin));
      } catch {
        // 조용히 무시 — 관리자 링크만 안 보일 뿐 기능에 영향 없음.
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  if (!admin) return null;

  return (
    <Link
      href="/admin/members"
      className="shrink-0 rounded-full border border-brand/40 px-3 py-1 text-xs font-medium text-brand hover:bg-brand-soft"
    >
      회원 관리
    </Link>
  );
}
