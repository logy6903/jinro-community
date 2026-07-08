import { getDatasetById } from "@/lib/datasets/repository";
import type { Dataset } from "@/lib/domain/types";

// POST /api/datasets/export — 주어진 id들의 전체 데이터셋(행 포함)을 반환.
// 엑셀 내보내기용. 읽기는 공개(양파구조)라 게이트 없음. 언어모델 미사용 —
// 저장된 데이터를 그대로 돌려줄 뿐(결정론적, 할루시네이션 불가).

const MAX_IDS = 80;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((x): x is string => typeof x === "string").slice(0, MAX_IDS)
    : [];
  if (ids.length === 0) {
    return Response.json({ datasets: [] });
  }

  const datasets = (
    await Promise.all(ids.map((id) => getDatasetById(id)))
  ).filter((d): d is Dataset => !!d);

  return Response.json({ datasets });
}
