import type { Dataset } from "../domain/types";
import { DATASET_CATEGORY_LABEL, DATASET_LEVEL_LABEL } from "../domain/labels";
import { getDatasetById, listDatasets } from "../datasets/repository";
import { listMaterials } from "../materials/repository";
import { listInfoItems } from "../info/repository";

// Retrieval for the grounded chatbot — now across THREE sources:
//   ① 데이터 표 (datasets)        — 정확한 값 조회에 강함
//   ② 교사 공유 자료 (shared_materials) — 아이디어·맥락
//   ③ 외부 정보 (info_items)       — 정책·입시 소식
// Keyword-based (no embeddings) → cost stays independent of DB size. Each source
// scored against the question; matched items are rendered into one grounding
// context with clear section headers so Claude can cite which source it used.

const TOP_DATASETS = 2;
const MAX_DATASET_ROWS = 40;
const TOP_MATERIALS = 3;
const MAT_BODY_CHARS = 400;
const TOP_INFO = 6;

/** 2+ char KO/EN words. */
function words(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^0-9a-z가-힣]+/i)
    .filter((w) => w.length >= 2);
}
/** Bidirectional partial match — handles Korean compounds (논술대학 ↔ 논술). */
function hit(hayWords: string[], token: string): boolean {
  return hayWords.some((w) => w.includes(token) || token.includes(w));
}
function score(hay: string, tokens: string[]): number {
  const hw = words(hay);
  return tokens.reduce((acc, t) => acc + (hit(hw, t) ? 1 : 0), 0);
}

export interface RetrievedContext {
  /** Full grounding text (empty when nothing matched). */
  context: string;
  /** Labels of the sources used, for the UI "근거 자료" line. */
  sources: string[];
}

function renderDatasetBlock(d: Dataset): string {
  const meta = [
    `구분: ${DATASET_CATEGORY_LABEL[d.category]}`,
    `대상: ${DATASET_LEVEL_LABEL[d.schoolLevel]}`,
    d.year && `시기: ${d.year}`,
    d.source && `출처: ${d.source}`,
    `작성: ${d.authorName}`,
  ]
    .filter(Boolean)
    .join(" / ");
  const header = d.columns.join(" | ");
  const body = d.rows
    .map((r) => d.columns.map((_, i) => r[i] ?? "").join(" | "))
    .join("\n");
  return `[표: ${d.title}]\n${meta}\n${header}\n${body}`;
}

async function fromDatasets(tokens: string[]) {
  const envs = await listDatasets();
  const picked = envs
    .map((d) => ({
      d,
      s: score(
        [
          d.title,
          DATASET_CATEGORY_LABEL[d.category],
          d.year,
          d.source,
          ...d.columns,
          ...d.customFields.flatMap((f) => [f.key, f.value]),
        ].join(" "),
        tokens,
      ),
    }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, TOP_DATASETS);

  const blocks: string[] = [];
  const sources: string[] = [];
  for (const { d } of picked) {
    const full = await getDatasetById(d.id);
    if (!full) continue;
    // 작은 표는 통째, 큰 표만 질문 매칭 행으로 (비교 맥락 보존).
    const rows =
      full.rows.length <= MAX_DATASET_ROWS
        ? full.rows
        : full.rows
            .filter((r) => r.some((c) => tokens.some((t) => hit(words(c), t))))
            .slice(0, MAX_DATASET_ROWS);
    blocks.push(
      renderDatasetBlock({
        ...full,
        rows: rows.length > 0 ? rows : full.rows.slice(0, MAX_DATASET_ROWS),
      }),
    );
    sources.push(full.title);
  }
  return { blocks, sources };
}

async function fromMaterials(tokens: string[]) {
  const mats = await listMaterials();
  const picked = mats
    .map((m) => ({ m, s: score([m.title, m.summary, m.body].join(" "), tokens) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, TOP_MATERIALS);
  const blocks = picked.map(
    ({ m }) =>
      `[공유글: ${m.title}]\n작성: ${m.authorName}\n요약: ${m.summary}\n내용: ${m.body.slice(0, MAT_BODY_CHARS)}`,
  );
  return { blocks, sources: picked.map((x) => x.m.title) };
}

async function fromInfo(tokens: string[]) {
  const infos = await listInfoItems();
  const picked = infos
    .map((it) => ({
      it,
      s: score([it.title, it.summary, it.source].join(" "), tokens),
    }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, TOP_INFO);
  const blocks = picked.map(
    ({ it }) =>
      `- ${it.title} — ${it.summary} (출처: ${it.source}${it.publishedAt ? ` · ${it.publishedAt}` : ""})`,
  );
  return { blocks, sources: picked.map((x) => x.it.title) };
}

export async function retrieveContext(
  question: string,
): Promise<RetrievedContext> {
  const tokens = words(question);
  if (tokens.length === 0) return { context: "", sources: [] };

  const [ds, mat, info] = await Promise.all([
    fromDatasets(tokens),
    fromMaterials(tokens),
    fromInfo(tokens),
  ]);

  const sections: string[] = [];
  if (ds.blocks.length) sections.push("### 데이터 표\n" + ds.blocks.join("\n\n"));
  if (mat.blocks.length)
    sections.push("### 교사 공유 자료\n" + mat.blocks.join("\n\n"));
  if (info.blocks.length)
    sections.push("### 외부 정보\n" + info.blocks.join("\n"));

  return {
    context: sections.join("\n\n"),
    sources: [...ds.sources, ...mat.sources, ...info.sources],
  };
}
