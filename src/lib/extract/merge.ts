import type { ExtractedNote, ExtractedTable } from "./types";

// 추출된 표에 주석(조건)을 병합해 저장용 {columns, rows, customFields} 생성.
// 조건을 버리지 않는 게 핵심: 전역주석→모든 행, 특정주석→매칭 행에 붙이고,
// 어느 행에도 안 붙은 특정주석은 customField로 남긴다. 저장 시 '비고/조건' 열로
// 각 행에 붙어, 챗봇이 인용할 때 조건이 반드시 딸려 나가게 한다.

/** 2+글자 토큰. */
function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^0-9a-z가-힣]+/i)
    .filter((w) => w.length >= 2);
}

function label(n: ExtractedNote): string {
  return `${n.marker ? n.marker + " " : ""}${n.text}`.trim();
}

export interface MergedTable {
  columns: string[];
  rows: string[][];
  customFields: { key: string; value: string }[];
}

export function mergeNotes(t: ExtractedTable): MergedTable {
  if (t.notes.length === 0) {
    return { columns: t.columns, rows: t.rows, customFields: [] };
  }
  const used = new Set<number>();
  const columns = [...t.columns, "비고/조건"];
  const rows = t.rows.map((row) => {
    const rowText = tokens(row.join(" "));
    const applied: string[] = [];
    t.notes.forEach((n, idx) => {
      const global = n.appliesTo.trim() === "";
      const match =
        global ||
        tokens(n.appliesTo).some((tk) =>
          rowText.some((rt) => rt.includes(tk) || tk.includes(rt)),
        );
      if (match) {
        applied.push(label(n));
        used.add(idx);
      }
    });
    return [...row, applied.join(" / ")];
  });
  const orphan = t.notes
    .filter((_, idx) => !used.has(idx))
    .slice(0, 12)
    .map((n) => ({ key: "주석", value: label(n) }));
  return { columns, rows, customFields: orphan };
}
