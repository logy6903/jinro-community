import { requireMember } from "@/lib/members/session";

// 회원 전용 구역. 비회원이면 여기서 /signup으로 리다이렉트되고 아래 페이지들은
// 아예 렌더되지 않는다 — 서버렌더 데이터가 HTML로 새어나갈 여지가 없다.
//
// 이 그룹 밖(공개)에 남는 것:
//   /signup            — 가입/로그인
//   /a/[code]          — 학생 수업앱 (학생은 회원이 아니므로 반드시 공개)
//   /api/session       — 세션 쿠키 발급
// 라우트 그룹 `(member)`는 URL에 영향을 주지 않는다(/datasets 등 그대로).

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireMember();
  return <>{children}</>;
}
