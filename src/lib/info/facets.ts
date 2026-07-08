import type { DatasetCategory } from "@/lib/domain/types";
import { DATASET_CATEGORY_LABEL } from "@/lib/domain/labels";

// Single source of truth for the 6 filter axes. The filter UI renders one
// dropdown per FacetDef; the query filters items by the same keys. Keep the
// InfoItem field names in sync with FacetKey.

export type FacetKey =
  | "type"
  | "category"
  | "level"
  | "grade"
  | "source"
  | "timing";

export interface FacetOption {
  value: string;
  label: string;
}

export interface FacetDef {
  key: FacetKey;
  label: string;
  options: FacetOption[];
}

const CATEGORY_OPTIONS: FacetOption[] = (
  Object.keys(DATASET_CATEGORY_LABEL) as DatasetCategory[]
).map((k) => ({ value: k, label: DATASET_CATEGORY_LABEL[k] }));

const SOURCE_VALUES = [
  "교육부",
  "시도교육청",
  "평가원",
  "대교협",
  "서교연",
  "I&AI",
  "현장교사",
  "기타",
];

export const FACETS: FacetDef[] = [
  {
    key: "type",
    label: "유형",
    options: [
      { value: "source", label: "원문 자료" },
      { value: "briefing", label: "소식·브리핑" },
      { value: "explainer", label: "해설·연재" },
      { value: "data", label: "데이터" },
    ],
  },
  { key: "category", label: "구분", options: CATEGORY_OPTIONS },
  {
    key: "level",
    label: "학교급",
    options: [
      { value: "middle", label: "중" },
      { value: "high", label: "고" },
      { value: "both", label: "공통" },
    ],
  },
  {
    key: "grade",
    label: "대상 학년",
    options: [
      { value: "middle", label: "중등" },
      { value: "h1", label: "고1" },
      { value: "h2", label: "고2" },
      { value: "h3", label: "고3" },
      { value: "all", label: "전학년" },
    ],
  },
  {
    key: "source",
    label: "출처",
    options: SOURCE_VALUES.map((s) => ({ value: s, label: s })),
  },
  {
    key: "timing",
    label: "시기",
    options: [
      { value: "recent", label: "최신" },
      { value: "period", label: "지금 시기" },
      { value: "evergreen", label: "상시" },
    ],
  },
];

/** Human label for a facet value (for badges in the result list). */
export function facetLabel(key: FacetKey, value: string): string {
  const def = FACETS.find((f) => f.key === key);
  return def?.options.find((o) => o.value === value)?.label ?? value;
}
