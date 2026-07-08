import { DATASET_CATEGORY_LABEL } from "../domain/labels";
import { getDatasetById, listDatasets } from "../datasets/repository";
import { listMaterials } from "../materials/repository";
import { listInfoItems } from "../info/repository";

// 규칙기반(LLM 없음) 로컬 응답. 질문을 키워드로 파싱해 저장된 데이터에서 매칭되는
// 행/자료를 "그대로(verbatim)" 돌려준다. 생성이 없으니 할루시네이션 불가 —
// closed-world. 완전성은 봉투/제목 메타로, 세부는 행으로. 비용 0 → 로그인 불필요.

const TOP_DATASETS = 4;
const MAX_ROWS = 40;
const TOP_MATERIALS = 4;
const TOP_INFO = 6;

/** 2+글자 KO/EN 토큰. */
function words(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^0-9a-z가-힣]+/i)
    .filter((w) => w.length >= 2);
}
/** 양방향 부분매칭 (논술대학 ↔ 논술). */
function hit(hay: string[], token: string): boolean {
  return hay.some((w) => w.includes(token) || token.includes(w));
}
function score(hay: string, tokens: string[]): number {
  const hw = words(hay);
  return tokens.reduce((acc, t) => acc + (hit(hw, t) ? 1 : 0), 0);
}

export interface LocalDataset {
  id: string;
  title: string;
  source: string;
  category: string;
  columns: string[];
  rows: string[][];
  originalUrl?: string;
}
export interface LocalMaterial {
  title: string;
  author: string;
  summary: string;
  body: string;
}
export interface LocalInfo {
  title: string;
  summary: string;
  source: string;
  url: string;
}
export interface LocalAnswer {
  datasets: LocalDataset[];
  materials: LocalMaterial[];
  infos: LocalInfo[];
  empty: boolean;
}

export async function answerLocal(question: string): Promise<LocalAnswer> {
  const tokens = words(question);
  if (tokens.length === 0) {
    return { datasets: [], materials: [], infos: [], empty: true };
  }

  // ① 데이터셋: 봉투로 찾고, 큰 표는 질문 매칭 행만(작은 표는 통째).
  const envs = await listDatasets();
  const pickedDs = envs
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

  const datasets: LocalDataset[] = [];
  for (const { d } of pickedDs) {
    const full = await getDatasetById(d.id);
    if (!full) continue;
    const rows =
      full.rows.length <= MAX_ROWS
        ? full.rows
        : full.rows
            .filter((r) => r.some((c) => tokens.some((t) => hit(words(c), t))))
            .slice(0, MAX_ROWS);
    datasets.push({
      id: full.id,
      title: full.title,
      source: full.source,
      category: DATASET_CATEGORY_LABEL[full.category],
      columns: full.columns,
      rows: rows.length > 0 ? rows : full.rows.slice(0, MAX_ROWS),
      originalUrl: full.originalUrl,
    });
  }

  // ② 교사 공유 자료.
  const mats = await listMaterials();
  const materials: LocalMaterial[] = mats
    .map((m) => ({ m, s: score([m.title, m.summary, m.body].join(" "), tokens) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, TOP_MATERIALS)
    .map(({ m }) => ({
      title: m.title,
      author: m.authorName,
      summary: m.summary,
      body: m.body.slice(0, 300),
    }));

  // ③ 외부 정보.
  const infoItems = await listInfoItems();
  const infos: LocalInfo[] = infoItems
    .map((it) => ({ it, s: score([it.title, it.summary, it.source].join(" "), tokens) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, TOP_INFO)
    .map(({ it }) => ({
      title: it.title,
      summary: it.summary,
      source: it.source,
      url: it.url,
    }));

  return {
    datasets,
    materials,
    infos,
    empty: datasets.length === 0 && materials.length === 0 && infos.length === 0,
  };
}
