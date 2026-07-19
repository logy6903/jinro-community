import { getAnthropicClient } from "../builder/anthropic";
import { SCHOOL_LEVEL_LABEL } from "../domain/labels";
import type { SchoolLevel } from "../domain/types";
import {
  LESSON_FORMAT_LABEL,
  type LessonPlan,
  type LessonPlanInput,
  type LessonSession,
} from "./types";

// 차시별 수업안 생성 엔진. 교사용·저빈도 호출이라 품질 우선으로 Opus를 쓴다
// (학생 단위 반복 호출인 AI 블록의 Haiku 기본과 대비 — 비용 민감 경로가 아니다).
// 결과는 초안이며 교사가 확정한다. API 키가 없으면 null을 반환해 호출부가
// graceful degrade 할 수 있게 한다(빌더 AI 블록과 동일 계약).

const MODEL = "claude-opus-4-8";
const MAX_TOKENS = 4096;
const DEFAULT_MINUTES: Record<SchoolLevel, number> = { middle: 45, high: 50 };

/** 원자료. 슬라이스1은 ContentCard를 이 모양으로 넘긴다(슬라이스2 업로드도 동일 모양). */
export interface LessonSource {
  id: string;
  title: string;
  body: string;
  schoolLevel: SchoolLevel;
}

const SYSTEM = [
  "너는 한국 학교의 진로교육 수업을 설계하는 전문가다.",
  "교사가 제공한 '원자료'와 '요청 조건'을 바탕으로, 요청한 차시 수에 맞춰 차시별 수업 계획안을 짠다.",
  "",
  "원칙:",
  "- 단순히 원자료를 N등분하지 말고, 요청한 차시 수에 맞게 학습목표·활동 밀도·시간 배분을 재구성한다.",
  "- 차시가 적으면 핵심만 압축하고, 많으면 도입·전개·심화·성찰로 여유 있게 확장한다.",
  "- 원자료에 없는 사실을 지어내지 않는다. 활동 아이디어는 보태되 자료의 취지에서 벗어나지 않는다.",
  "- 교사의 '자유 요청(바이브)'은 최대한 반영한다. 반 사정·강조점·추가 활동 요구를 우선 고려한다.",
  "- 각 차시는 학생 중심 활동으로, 교사가 그대로 수업할 수 있을 만큼 구체적으로 쓴다.",
  "- 모든 텍스트는 한국어. 아래 JSON 하나만 출력하고 그 외 설명·머리말·코드펜스를 붙이지 않는다.",
].join("\n");

/** 요청 조건 + 출력 형식을 사람이 읽는 프롬프트로 조립. */
function buildUserPrompt(source: LessonSource, input: LessonPlanInput): string {
  const level = input.schoolLevel ?? source.schoolLevel;
  const minutes = input.minutesPerSession ?? DEFAULT_MINUTES[level];

  const conditions = [
    `- 차시 수: 정확히 ${input.numSessions}차시`,
    `- 대상: ${SCHOOL_LEVEL_LABEL[level]}`,
    `- 차시당 시간: ${minutes}분`,
    input.format ? `- 수업 형태: ${LESSON_FORMAT_LABEL[input.format]}` : null,
    input.emphasis ? `- 강조할 목표: ${input.emphasis}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const vibe = input.notes?.trim()
    ? `\n[교사의 자유 요청 — 최대한 반영]\n${input.notes.trim()}\n`
    : "";

  return [
    "[원자료]",
    `제목: ${source.title}`,
    source.body,
    "",
    "[요청 조건]",
    conditions,
    vibe,
    "[출력 형식] 아래 JSON 하나만 출력한다:",
    "{",
    '  "overview": "이 수업 전체를 2~3문장으로 요약",',
    '  "sessions": [',
    "    {",
    '      "order": 1,',
    '      "title": "차시 제목",',
    '      "objectives": ["학습목표 문장", "..."],',
    '      "steps": ["활동 단계 (소요 시간)", "..."],',
    '      "materials": ["준비물", "..."],',
    `      "minutes": ${minutes},`,
    '      "reflection": "마무리 성찰/평가 한 줄"',
    "    }",
    "  ]",
    "}",
    `sessions 배열은 정확히 ${input.numSessions}개여야 한다.`,
  ].join("\n");
}

/** 모델 응답에서 JSON 객체 하나를 안전하게 뽑는다(코드펜스·머리말 방어). */
function extractJson(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```(?:json)?/gi, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

/**
 * 원자료 + 입력으로 차시별 수업안 초안을 생성. AI 미설정·생성 실패 시 null.
 * AI가 차시 수를 못 맞춰도 받은 그대로 반환한다(교사가 조정하는 초안 원칙).
 */
export async function generateLessonPlan(
  source: LessonSource,
  input: LessonPlanInput,
): Promise<LessonPlan | null> {
  const client = getAnthropicClient();
  if (!client) return null;

  const level = input.schoolLevel ?? source.schoolLevel;
  const fallbackMinutes = input.minutesPerSession ?? DEFAULT_MINUTES[level];

  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      messages: [{ role: "user", content: buildUserPrompt(source, input) }],
    });

    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    const obj = extractJson(text);
    if (!obj) return null;

    const rawSessions = Array.isArray(obj.sessions) ? obj.sessions : [];
    const sessions: LessonSession[] = rawSessions.map((s, i) => {
      const o = (s ?? {}) as Record<string, unknown>;
      return {
        order: typeof o.order === "number" ? o.order : i + 1,
        title: String(o.title ?? `${i + 1}차시`).trim(),
        objectives: toStringArray(o.objectives),
        steps: toStringArray(o.steps),
        materials: toStringArray(o.materials),
        minutes: typeof o.minutes === "number" ? o.minutes : fallbackMinutes,
        reflection: String(o.reflection ?? "").trim(),
      };
    });
    if (sessions.length === 0) return null;

    return {
      sourceId: source.id,
      sourceTitle: source.title,
      input,
      overview: String(obj.overview ?? "").trim(),
      sessions,
    };
  } catch {
    // 레이트리밋·거부·네트워크 실패 — 호출부가 502로 안내하도록 null.
    return null;
  }
}
