import Link from "next/link";
import { InfoReviewRow } from "@/components/InfoReviewRow";
import { listUnreviewedInfoItems } from "@/lib/info/repository";

// 정보 검토·보정 — AI가 자동 태깅한(reviewed:false) 항목의 구분·학교급·
// 대상학년을 교사가 확인·수정하는 화면. 저장은 로그인 필요(PATCH 토큰검증).

export default async function InfoReviewPage() {
  const items = await listUnreviewedInfoItems();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">정보 검토·보정</h1>
        <p className="text-sm text-muted">
          AI가 자동으로 매긴 구분·학교급·대상 학년을 확인하고 필요하면 고칩니다.
          확정하면 정보 목록에서 &lsquo;검토 대기&rsquo;가 사라집니다. (저장은 로그인 필요)
        </p>
      </div>

      {items.length > 0 ? (
        <div className="flex flex-col gap-3">
          {items.map((it) => (
            <InfoReviewRow key={it.id} item={it} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted">
          검토 대기 중인 항목이 없습니다.{" "}
          <Link href="/info" className="text-brand hover:opacity-80">
            정보로 돌아가기
          </Link>
        </div>
      )}
    </div>
  );
}
