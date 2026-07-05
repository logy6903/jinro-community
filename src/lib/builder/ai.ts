import Anthropic from "@anthropic-ai/sdk";
import type { AiBlockConfig, AnswerValue, BuilderApp } from "./types";

// Server-side AI blocks. On submit, the engine feeds the student's answers to
// Claude with the teacher's instruction and returns the result. The API key
// never reaches the client. When ANTHROPIC_API_KEY is unset, everything returns
// empty and the submission is still saved without feedback (graceful fallback,
// same contract as the Firestore layer).

// Teacher-facing "세기" maps to a real model. Per-student calls are the cost-
// sensitive path, so the default tier is Haiku; the teacher opts into Opus.
const MODEL_ID: Record<AiBlockConfig["model"], string> = {
  fast: "claude-haiku-4-5",
  smart: "claude-opus-4-8",
};

// Deliberately short output — feedback, not an essay — which also caps cost.
const MAX_TOKENS = 1024;

// Pedagogical guardrail wrapped around every teacher instruction: help the
// student improve rather than doing the work for them.
const GUARDRAIL = [
  "너는 교사가 만든 학습 도우미다. 학생의 제출물을 읽고 아래 교사의 지시에 따라 반응한다.",
  "규칙: 한국어로, 학생이 이해하기 쉽고 격려하는 어조로 답한다.",
  "정답을 통째로 대신 써주지 말고, 학생이 스스로 고치거나 더 생각하도록 돕는다.",
  "3~6문장으로 간결하게. 제출물과 무관한 잡담은 하지 않는다.",
].join("\n");

let client: Anthropic | null | undefined;

function getClient(): Anthropic | null {
  if (client !== undefined) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  client = apiKey ? new Anthropic({ apiKey }) : null;
  return client;
}

export function isAiConfigured(): boolean {
  return getClient() !== null;
}

/** Render the answers the block reads as a readable block of text. */
function renderAnswers(
  app: BuilderApp,
  answers: Record<string, AnswerValue>,
  block: AiBlockConfig,
): string {
  const ids = block.inputFieldIds ?? [];
  const fields =
    ids.length > 0 ? app.fields.filter((f) => ids.includes(f.id)) : app.fields;
  return fields
    .map((f) => {
      const v = answers[f.id];
      return `- ${f.label}: ${v === undefined || v === "" ? "(빈칸)" : String(v)}`;
    })
    .join("\n");
}

async function runOne(
  app: BuilderApp,
  answers: Record<string, AnswerValue>,
  block: AiBlockConfig,
): Promise<string | null> {
  const c = getClient();
  if (!c) return null;
  const model = MODEL_ID[block.model] ?? MODEL_ID.fast;
  const system = `${GUARDRAIL}\n\n[교사의 지시]\n${block.instruction}`;
  const content = `[학생 제출물]\n${renderAnswers(app, answers, block)}`;

  try {
    const res = await c.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: "user", content }],
    });
    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    return text || null;
  } catch {
    // A single block failing (rate limit, refusal, network) must not fail the
    // whole submission — the answer is already validated and worth saving.
    return null;
  }
}

/**
 * Run every AI block on a submission. Blocks run concurrently; a block that
 * fails or yields nothing is simply omitted from the result. Returns a map of
 * blockId → output text.
 */
export async function runAiBlocks(
  app: BuilderApp,
  answers: Record<string, AnswerValue>,
): Promise<Record<string, string>> {
  const blocks = app.aiBlocks ?? [];
  if (blocks.length === 0 || !isAiConfigured()) return {};

  const results = await Promise.all(
    blocks.map(async (b) => [b.id, await runOne(app, answers, b)] as const),
  );

  const out: Record<string, string> = {};
  for (const [id, text] of results) {
    if (text) out[id] = text;
  }
  return out;
}
