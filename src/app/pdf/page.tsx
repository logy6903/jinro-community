import { listSources } from "@/lib/sources/repository";
import { PdfBrowser } from "@/components/PdfBrowser";

// 요강 PDF 작업실 목록. 서버가 전체를 불러오고, 헤더 필터(학년도·종류·국공립/사립
// ·대학)는 클라이언트에서 즉시 거른다. 하나 골라 작업대(/pdf/[id])로 들어간다.

export default async function PdfListPage() {
  const sources = await listSources();
  return <PdfBrowser sources={sources} />;
}
