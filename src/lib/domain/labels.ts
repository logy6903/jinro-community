import type {
  CardCategory,
  DatasetCategory,
  DatasetLevel,
  SchoolLevel,
} from "./types";

// Korean display labels for domain enums. UI text is Korean; identifiers English.

export const SCHOOL_LEVEL_LABEL: Record<SchoolLevel, string> = {
  middle: "중학교",
  high: "고등학교",
};

export const CATEGORY_LABEL: Record<CardCategory, string> = {
  activity: "활동",
  lesson: "수업",
  info: "정보",
  checklist: "체크리스트",
};

export const CATEGORY_EMOJI: Record<CardCategory, string> = {
  activity: "🎯",
  lesson: "📖",
  info: "📰",
  checklist: "✅",
};

/** Narrow an arbitrary string to a SchoolLevel, defaulting to middle. */
export function parseSchoolLevel(value: string | undefined): SchoolLevel {
  return value === "high" ? "high" : "middle";
}

export const DATASET_CATEGORY_LABEL: Record<DatasetCategory, string> = {
  admission: "입시·전형",
  essay: "논술",
  record: "학생부·세특",
  interview: "면접",
  result: "입결·경쟁률",
  career: "진로·직업",
  activity: "체험·활동",
  contest: "공모전",
  etc: "기타",
};

export const DATASET_LEVEL_LABEL: Record<DatasetLevel, string> = {
  middle: "중학교",
  high: "고등학교",
  both: "중·고 공통",
};
