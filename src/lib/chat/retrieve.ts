import type { Dataset } from "../domain/types";
import { DATASET_CATEGORY_LABEL } from "../domain/labels";
import { getDatasetById, listDatasets } from "../datasets/repository";

// Retrieval for the grounded chatbot. Two stages, no embeddings (MVP):
//   1. Route to relevant datasets by their "봉투" (envelope) + column names.
//   2. Within picked datasets, keep rows that match the question.
// Keyword-based → cost is DB-size-independent (only matched rows reach Claude).

const TOP_DATASETS = 3;
const MAX_CONTEXT_ROWS = 60; // total rows fed to Claude, across datasets

/** Split a KO/EN string into 2+ char search words. */
function words(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^0-9a-z가-힣]+/i)
    .filter((w) => w.length >= 2);
}

/** Bidirectional partial match — handles Korean compounds (논술대학 ↔ 논술). */
function hit(haystackWords: string[], token: string): boolean {
  return haystackWords.some((w) => w.includes(token) || token.includes(w));
}

function envelopeWords(d: Omit<Dataset, "rows">): string[] {
  return words(
    [
      d.title,
      DATASET_CATEGORY_LABEL[d.category],
      d.year,
      d.source,
      ...d.columns,
      ...d.customFields.flatMap((f) => [f.key, f.value]),
    ].join(" "),
  );
}

function pickRows(ds: Dataset, tokens: string[], budget: number): string[][] {
  if (budget <= 0) return [];
  // Small table: include every row. The dataset already matched at the envelope
  // level, and full rows preserve comparison context (e.g. all 대학 in a table).
  if (ds.rows.length <= budget) return ds.rows;
  // Large table: keep rows matching the question, then cap to the row budget.
  const matching = ds.rows.filter((r) =>
    r.some((cell) => {
      const cw = words(cell);
      return tokens.some((t) => hit(cw, t));
    }),
  );
  return (matching.length > 0 ? matching : ds.rows).slice(0, budget);
}

/** Datasets (with a trimmed row subset) relevant to the question. */
export async function retrieve(question: string): Promise<Dataset[]> {
  const tokens = words(question);
  const envelopes = await listDatasets();
  if (envelopes.length === 0) return [];

  const scored = envelopes
    .map((d) => {
      const ew = envelopeWords(d);
      const s = tokens.reduce((acc, t) => acc + (hit(ew, t) ? 1 : 0), 0);
      return { d, s };
    })
    .sort((a, b) => b.s - a.s);

  // Only use datasets that actually matched. No match → honest "no data".
  const picked = scored.filter((x) => x.s > 0).slice(0, TOP_DATASETS);
  if (picked.length === 0) return [];

  const out: Dataset[] = [];
  let budget = MAX_CONTEXT_ROWS;
  for (const { d } of picked) {
    const full = await getDatasetById(d.id);
    if (!full) continue;
    const rows = pickRows(full, tokens, budget);
    budget -= rows.length;
    out.push({ ...full, rows });
    if (budget <= 0) break;
  }
  return out;
}
