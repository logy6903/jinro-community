import { getAnthropicClient } from "./anthropic";
import { neisByteLength, truncateToBytes } from "./bytes";
import type { RecordSlot } from "./types";

// 생활기록부(생기부) generation, two phases:
//   1. fillAiSlots  — draft each "ai" slot from a student's activity submissions.
//   2. weaveRecords — weave all slot values (ai-drafted + teacher-entered) into
//      one NEIS-ready 세부능력·특기사항 paragraph within the byte limit.
// Model is Haiku (the free tier — 생기부 초안 is offered free; low frequency keeps
// the cost small). Both phases degrade gracefully when the client is unset.

const RECORD_BYTE_LIMIT = 1500;
const MODEL = "claude-haiku-4-5";
const CONCURRENCY = 4;

type Client = NonNullable<ReturnType<typeof getAnthropicClient>>;

export interface StudentActivity {
  studentName: string;
  studentNo?: string;
  activityText: string;
}

export interface FilledRow {
  studentName: string;
  studentNo?: string;
  /** AI slot values, keyed by slot id. Teacher slots are absent (filled later). */
  ai: Record<string, string>;
}

export interface WeaveInput {
  studentName: string;
  parts: { label: string; value: string }[];
}

export interface RecordResult {
  studentName: string;
  text: string;
  bytes: number;
}

function textOf(res: { content: { type: string }[] }): string {
  return (res.content as { type: string; text?: string }[])
    .map((b) => (b.type === "text" ? (b.text ?? "") : ""))
    .join("")
    .trim();
}

// --- Phase 1: fill AI slots from activity -----------------------------------

async function fillSlotsForStudent(
  client: Client,
  activityText: string,
  aiSlots: RecordSlot[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const slot of aiSlots) {
    const system =
      [
        "너는 교사의 생활기록부 작성을 돕는다. 학생 제출 내용에서 아래 지시에 맞는 항목만 뽑아 정리한다.",
        "규칙: 한국어, 명사형 종결(~함/~음), 3인칭 관찰, 사실 기반(근거 없는 칭찬·과장 금지), 2~3문장.",
      ].join("\n") + `\n\n[뽑을 항목: ${slot.label}]\n${slot.instruction ?? ""}`;
    try {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 600,
        system,
        messages: [{ role: "user", content: `[학생 제출]\n${activityText}` }],
      });
      out[slot.id] = textOf(res);
    } catch {
      out[slot.id] = "";
    }
  }
  return out;
}

export async function fillAiSlots(
  students: StudentActivity[],
  aiSlots: RecordSlot[],
): Promise<FilledRow[] | null> {
  const client = getAnthropicClient();
  if (!client) return null;
  if (aiSlots.length === 0) {
    return students.map((s) => ({
      studentName: s.studentName,
      studentNo: s.studentNo,
      ai: {},
    }));
  }

  const rows: FilledRow[] = [];
  for (let i = 0; i < students.length; i += CONCURRENCY) {
    const batch = students.slice(i, i + CONCURRENCY);
    const done = await Promise.all(
      batch.map(async (s) => ({
        studentName: s.studentName,
        studentNo: s.studentNo,
        ai: await fillSlotsForStudent(client, s.activityText, aiSlots),
      })),
    );
    rows.push(...done);
  }
  return rows;
}

// --- Phase 2: weave slot values into one 생기부 paragraph ---------------------

async function weaveForStudent(
  client: Client,
  input: WeaveInput,
  instruction: string | undefined,
): Promise<RecordResult> {
  const system =
    [
      "너는 교사의 생활기록부(세부능력 및 특기사항)를 완성한다. 아래 항목들을 자연스럽게 하나의 문단으로 엮는다.",
      "규칙: 3인칭 관찰 서술, 명사형 종결(~함/~음/~을 보임), 근거 없는 과장 금지, 학생 이름 미기재, 기재 금지 항목(대학명·교외 수상·어학성적·자격증 등) 제외, 한 문단, 1500바이트(약 500자) 이내.",
      "제공된 항목의 사실을 넘어서는 내용은 지어내지 않는다.",
    ].join("\n") +
    (instruction?.trim() ? `\n\n[교사 지시]\n${instruction.trim()}` : "");

  const body = input.parts
    .filter((p) => p.value.trim())
    .map((p) => `- ${p.label}: ${p.value.trim()}`)
    .join("\n");

  if (!body) {
    return { studentName: input.studentName, text: "", bytes: 0 };
  }

  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system,
      messages: [
        {
          role: "user",
          content: `다음 항목들을 엮어 생활기록부 문장을 완성하라.\n\n${body}`,
        },
      ],
    });
    const text = truncateToBytes(textOf(res), RECORD_BYTE_LIMIT);
    return { studentName: input.studentName, text, bytes: neisByteLength(text) };
  } catch {
    return { studentName: input.studentName, text: "", bytes: 0 };
  }
}

export async function weaveRecords(
  inputs: WeaveInput[],
  instruction?: string,
): Promise<RecordResult[] | null> {
  const client = getAnthropicClient();
  if (!client) return null;

  const results: RecordResult[] = [];
  for (let i = 0; i < inputs.length; i += CONCURRENCY) {
    const batch = inputs.slice(i, i + CONCURRENCY);
    const done = await Promise.all(
      batch.map((inp) => weaveForStudent(client, inp, instruction)),
    );
    results.push(...done);
  }
  return results;
}
