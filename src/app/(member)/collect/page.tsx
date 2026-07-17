import { listDatasets } from "@/lib/datasets/repository";
import { DatasetCollector } from "@/components/DatasetCollector";

// 데이터 정리·엑셀 내보내기. 서버가 데이터셋 목록(행 제외)을 넘기고, 클라이언트가
// 구분·대상·학년도로 필터해 엑셀로 내보낸다. 언어모델 미사용 — 저장 데이터만.

export default async function CollectPage() {
  const datasets = await listDatasets();
  return <DatasetCollector datasets={datasets} />;
}
