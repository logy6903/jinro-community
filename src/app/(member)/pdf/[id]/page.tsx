import { notFound } from "next/navigation";
import { getSourceById } from "@/lib/sources/repository";
import { PdfWorkbench } from "@/components/PdfWorkbench";

// 요강 작업대. 서버에서 원본 메타를 가져와 전체화면 작업대(클라이언트)를 띄운다.
// 왼쪽 원본(pdf.js) | 오른쪽 추출 결과(다음 증분).

export default async function PdfSourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const s = await getSourceById(id);
  if (!s) notFound();

  return <PdfWorkbench source={s} />;
}
