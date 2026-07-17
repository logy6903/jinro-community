"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";

// Client-side auth context. Google sign-in only.
// 회원 전용 서비스라, 로그인하면 서버가 검증할 수 있도록 idToken을 /api/session에
// 보내 httpOnly 세션 쿠키를 굽는다(서버렌더 페이지·콘텐츠 API가 이 쿠키로 회원 판정).
// 로그아웃 시 쿠키도 함께 제거.

/** 현재 사용자의 idToken으로 서버 세션 쿠키를 (재)발급. 실패해도 조용히 무시. */
async function syncSession(u: User): Promise<void> {
  try {
    const idToken = await u.getIdToken();
    await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
  } catch {
    /* 네트워크 실패 시 다음 로드에서 재시도 */
  }
}

interface AuthState {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      // Firebase client config not set yet — stay signed-out, don't crash.
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      // 로그인 상태면 서버 세션 쿠키를 맞춰둔다(페이지 로드마다 1회, 갱신 겸용).
      if (u) void syncSession(u);
    });
  }, []);

  async function signInWithGoogle() {
    if (!auth) {
      console.warn("Firebase client not configured (NEXT_PUBLIC_FIREBASE_*).");
      return;
    }
    await signInWithPopup(auth, new GoogleAuthProvider());
  }

  async function signOut() {
    if (!auth) return;
    try {
      await fetch("/api/session", { method: "DELETE" });
    } catch {
      /* 쿠키 제거 실패해도 클라이언트 로그아웃은 진행 */
    }
    await firebaseSignOut(auth);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
