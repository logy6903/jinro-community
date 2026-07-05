import Anthropic from "@anthropic-ai/sdk";
import type { Dataset } from "../domain/types";
import { DATASET_CATEGORY_LABEL, DATASET_LEVEL_LABEL } from "../domain/labels";
import { retrieve } from "./retrieve";

// Grounded answer generation. Claude answers ONLY from retrieved teacher tables
// and cites sources; when nothing relevant is found it says so rather than
// inventing. Local client getter (not imported from builder/) to keep the chat
// feature self-contained. Haiku by default — grounded extraction, cost-
// sensitive per the DB-size-independent design.

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 800;

const SYSTEM = [
  "너는 진로교사 커뮤니티의 자료 안내 도우미다. 교사들이 올린 데이터(표)를 근거로 질문에 답한다.",
  "규칙:",
  "- 반드시 아래 제공된 표의 내용만 근거로 답한다. 표에 없는 내용은 절대 지어내지 않는다.",
  "- 답의 근거가 된 자료의 제목·출처·작성자를 함께 밝힌다.",
  "- 관련 정보가 표에 없으면 '아직 검증된 자료가 없어요'라고 솔직히 말한다.",
  "- 여러 자료의 값이 서로 다르면 각각을 출처와 함께 보여주고, 임의로 하나만 고르지 않는다.",
  "- 한국어로, 교사가 읽기 쉽게 간결히 답한다.",
].join("\n");

let client: Anthropic | null | undefined;
function getClient(): Anthropic | null {
  if (client !== undefined) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  client = apiKey ? new Anthropic({ apiKey }) : null;
  return client;
}

function renderDataset(d: Dataset): string {
  const meta = [
    `구분: ${DATASET_CATEGORY_LABEL[d.category]}`,
    `대상: ${DATASET_LEVEL_LABEL[d.schoolLevel]}`,
    d.year && `시기: ${d.year}`,
    d.source && `출처: ${d.source}`,
    `작성: ${d.authorName}`,
    ...d.customFields.map((f) => `${f.key}: ${f.value}`),
  ]
    .filter(Boolean)
    .join(" / ");
  const header = d.columns.join(" | ");
  const body = d.rows
    .map((r) => d.columns.map((_, i) => r[i] ?? "").join(" | "))
    .join("\n");
  return `[자료: ${d.title}]\n${meta}\n표:\n${header}\n${body}`;
}

export interface ChatResult {
  answer: string;
  sources: string[];
  /** false when ANTHROPIC_API_KEY is unset (chatbot not yet enabled). */
  configured: boolean;
}

export async function ask(question: string): Promise<ChatResult> {
  const c = getClient();
  if (!c) return { answer: "", sources: [], configured: false };

  const datasets = await retrieve(question);
  if (datasets.length === 0) {
    return {
      answer:
        "아직 그 질문에 답할 검증된 자료가 없어요. 관련 엑셀을 올려주시면 그 자료를 근거로 답할 수 있어요.",
      sources: [],
      configured: true,
    };
  }

  const context = datasets.map(renderDataset).join("\n\n---\n\n");
  const content = `아래는 교사들이 올린 자료입니다.\n\n${context}\n\n[질문]\n${question}`;

  try {
    const res = await c.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });
    const answer = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    return {
      answer: answer || "답을 생성하지 못했어요.",
      sources: datasets.map((d) => d.title),
      configured: true,
    };
  } catch {
    return {
      answer: "일시적으로 답변을 생성하지 못했어요. 잠시 후 다시 시도해주세요.",
      sources: [],
      configured: true,
    };
  }
}
