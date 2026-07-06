import Anthropic from "@anthropic-ai/sdk";
import { getActivePeriods } from "../calendar/engine";
import { getCardsForNow } from "../content/query";
import type { SchoolLevel } from "../domain/types";
import { CATEGORY_LABEL, SCHOOL_LEVEL_LABEL } from "../domain/labels";

// "오늘의 수업" — the bridge between Track 1 (일정표) and Track 2 (수업자료).
// Today's period + hint (from the calendar engine, free) + the period's activity
// cards (grounding) → Claude drafts a ready-to-use lesson. Teacher-reviewed, not
// full-auto ("AI는 대신 쓰지 않는다"). Cost-sensitive: generated on demand only.

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 1400;

const SYSTEM = [
  "너는 진로교사의 수업 준비를 돕는 도우미다. 오늘의 시기·주제와 커뮤니티의 진로 활동 자료를 참고해, 교사가 오늘 바로 쓸 수 있는 '수업 초안'을 만든다.",
  "규칙:",
  "- 도입 → 전개 → 정리 흐름으로, 각 단계에 구체적인 활동을 제시한다.",
  "- 준비물과, 학생용 활동지(질문 3~5개 수준)를 간단히 포함한다.",
  "- 참고 자료가 있으면 그 아이디어를 살리되, 없는 내용을 지어내지 않는다.",
  "- 이건 교사가 다듬어 쓸 '초안'이다. 완벽·완성을 강요하지 말고, AI가 대신 다 해주는 게 아니라 교사를 돕는다는 태도로.",
  "- 한국어로, 실용적이고 간결하게. 마크다운 제목/불릿을 적절히 사용.",
].join("\n");

let client: Anthropic | null | undefined;
function getClient(): Anthropic | null {
  if (client !== undefined) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  client = apiKey ? new Anthropic({ apiKey }) : null;
  return client;
}

export interface TodayContext {
  date: string;
  level: SchoolLevel;
  period: string | null;
  hint: string | null;
}

export interface TodayResult extends TodayContext {
  /** false when ANTHROPIC_API_KEY is unset. */
  configured: boolean;
  draft: string;
  usedCards: string[];
}

export async function generateToday(level: SchoolLevel): Promise<TodayResult> {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const period = getActivePeriods(level, now)[0];
  const cards = await getCardsForNow(level, now);
  const ctx: TodayContext = {
    date,
    level,
    period: period?.label ?? null,
    hint: period?.hint ?? null,
  };

  const c = getClient();
  if (!c) return { ...ctx, configured: false, draft: "", usedCards: [] };
  if (!period) {
    return {
      ...ctx,
      configured: true,
      draft: "오늘은 달력상 특정 진로 시기가 없어요. 상시 활동 카드를 참고해 자유롭게 구성하세요.",
      usedCards: [],
    };
  }

  const cardText =
    cards.length > 0
      ? cards
          .map((cd) => `- [${CATEGORY_LABEL[cd.category]}] ${cd.title}: ${cd.summary}`)
          .join("\n")
      : "(참고 자료 없음 — 시기·주제에 맞게 구성)";
  const content = `오늘: ${date}\n대상: ${SCHOOL_LEVEL_LABEL[level]}\n시기: ${period.label}\n이 시기 힌트: ${period.hint}\n\n[참고 활동 자료]\n${cardText}\n\n위 시기·주제에 맞는 '오늘 쓸 수업 초안'을 만들어줘.`;

  try {
    const res = await c.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });
    const draft = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    return {
      ...ctx,
      configured: true,
      draft: draft || "초안을 생성하지 못했어요.",
      usedCards: cards.map((cd) => cd.title),
    };
  } catch {
    return {
      ...ctx,
      configured: true,
      draft: "일시적으로 생성하지 못했어요. 잠시 후 다시 시도해주세요.",
      usedCards: [],
    };
  }
}
