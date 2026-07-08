import { PDFDocument } from "pdf-lib";

// 원본 PDF에서 표의 페이지 범위만 잘라 작은 PDF로 만든다. Pass 2가 89페이지 통째
// 대신 그 몇 페이지만 전송 → 입력 토큰 30~50배↓ + 딴 표에 안 휘둘려 정확도↑.
// 여러 페이지 표는 범위를 통째로 넘겨 헤더·병합라벨을 경계 너머로 이어붙인다.

/** [start..end] (1-based, 포함) 페이지만 담은 새 PDF Buffer. */
export async function extractPageRange(
  pdfBytes: Uint8Array,
  start: number,
  end: number,
): Promise<Buffer> {
  const src = await PDFDocument.load(pdfBytes);
  const total = src.getPageCount();
  const s = Math.max(1, Math.min(total, Math.floor(start)));
  const e = Math.max(s, Math.min(total, Math.floor(end)));
  const out = await PDFDocument.create();
  const indices: number[] = [];
  for (let p = s; p <= e; p++) indices.push(p - 1);
  const copied = await out.copyPages(src, indices);
  copied.forEach((pg) => out.addPage(pg));
  return Buffer.from(await out.save());
}
