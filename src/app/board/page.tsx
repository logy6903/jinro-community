import Link from "next/link";
import { MaterialCard } from "@/components/MaterialCard";
import { listMaterials } from "@/lib/materials/repository";
import type { SchoolLevel } from "@/lib/domain/types";

// 자료 공유 게시판. List + filter are public (onion structure); posting
// requires login (handled on /board/new).

const FILTERS: { value: SchoolLevel | "all"; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "middle", label: "중학교" },
  { value: "high", label: "고등학교" },
];

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string }>;
}) {
  const raw = (await searchParams).level;
  const level: SchoolLevel | undefined =
    raw === "middle" || raw === "high" ? raw : undefined;
  const materials = await listMaterials(level);
  const active = level ?? "all";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">자료 공유 게시판</h1>
        <Link
          href="/board/new"
          className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          자료 올리기
        </Link>
      </div>

      <div className="flex gap-2">
        {FILTERS.map((f) => {
          const href = f.value === "all" ? "/board" : `/board?level=${f.value}`;
          const selected = f.value === active;
          return (
            <Link
              key={f.value}
              href={href}
              className={
                "rounded-full border px-3 py-1 text-sm transition-colors " +
                (selected
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-border text-muted hover:text-foreground")
              }
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {materials.length > 0 ? (
        <div className="flex flex-col gap-3">
          {materials.map((m) => (
            <MaterialCard key={m.id} material={m} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted">
          아직 공유된 자료가 없습니다. 첫 자료를 올려보세요.
        </div>
      )}
    </div>
  );
}
