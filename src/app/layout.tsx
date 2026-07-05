import type { Metadata } from "next";
import Link from "next/link";
import { AuthButton } from "@/components/AuthButton";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "진로교사 커뮤니티 · I&AI 미래역량교육연구소",
  description:
    "전국 진로교사를 위한 무료 커뮤니티. 시기별로 지금 필요한 활동·수업·정보를 알아서 띄워드립니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <header className="border-b border-border bg-card">
            <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
              <div className="flex items-baseline gap-4">
                <Link href="/" className="flex items-baseline gap-2">
                  <span className="text-lg font-bold tracking-tight">
                    진로교사 커뮤니티
                  </span>
                  <span className="text-xs text-muted">베타</span>
                </Link>
                <Link
                  href="/chat"
                  className="text-sm font-medium text-brand hover:opacity-80"
                >
                  챗봇
                </Link>
                <Link
                  href="/datasets"
                  className="text-sm text-muted hover:text-foreground"
                >
                  데이터
                </Link>
                <Link
                  href="/board"
                  className="text-sm text-muted hover:text-foreground"
                >
                  자료 공유
                </Link>
                <Link
                  href="/info"
                  className="text-sm text-muted hover:text-foreground"
                >
                  정보
                </Link>
                <Link
                  href="/builder"
                  className="text-sm text-muted hover:text-foreground"
                >
                  수업앱
                </Link>
              </div>
              <AuthButton />
            </div>
          </header>
          <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-6">
            {children}
          </main>
          <footer className="border-t border-border bg-card">
            <div className="mx-auto max-w-3xl px-5 py-6 text-xs leading-relaxed text-muted">
              이 페이지의 자료는 I&amp;AI 미래역량교육연구소가 만들고 정리합니다.
              누구나 보고, 단톡방에 링크 하나로 공유할 수 있습니다.
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
