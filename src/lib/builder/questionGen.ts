import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "./anthropic";
import type { AiModelTier, ContentType, FieldType } from "./types";

// Draft-stage AI: read the materials a teacher has put on an app (제시 자료) and
// propose a student activity from them. Output is an ordered list of items — the
// AI can emit not just questions but also its own presentation blocks (e.g. a
// <보기> set the question refers to). This runs once at authoring time (teacher
// side), not per student, so cost is negligible — Haiku by default, Opus opt-in.
// Images and PDFs are fetched server-side and sent as vision/document blocks so
// Claude reads the actual worksheet, not just a caption.

const MODEL_ID: Record<AiModelTier, string> = {
  fast: "claude-haiku-4-5",
  smart: "claude-opus-4-8",
};

const MAX_FETCH_BYTES = 8 * 1024 * 1024; // 8MB per asset — keeps the request sane
type ImageMedia = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
const IMAGE_TYPES: ImageMedia[] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];
const MAX_ITEMS = 30;

export interface SourceMaterial {
  contentType: ContentType;
  /** text: the body; image/pdf/link: the URL. */
  value: string;
  label?: string;
}

/**
 * A generated activity element. `content` is a presentation block the AI made
 * itself (a <보기> set, an extra passage); `field` is a student question.
 */
export type GeneratedItem =
  | { kind: "content"; label?: string; text: string }
  | { kind: "field"; type: FieldType; label: string; options?: string[] };

export interface GenerateOptions {
  count: number;
  tier: AiModelTier;
  /** How many options each generated 객관식 question should have. */
  choiceCount: number;
  /** Extra teacher instruction beyond the source material (optional). */
  instruction?: string;
}

async function fetchAsBase64(
  url: string,
): Promise<{ data: string; mediaType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_FETCH_BYTES) return null;
    const mediaType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    return { data: buf.toString("base64"), mediaType };
  } catch {
    return null;
  }
}

function youTubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?[^#]*\bv=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/(?:embed|shorts|live)\/([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// Best-effort YouTube transcript so the AI can actually ground questions in the
// video, not just its title. Pulls captionTracks from the watch page, prefers
// Korean, fetches the json3 caption feed. Returns "" transcript when a video has
// no captions (grounding then forbids inventing questions about it).
async function fetchYouTube(
  url: string,
): Promise<{ title: string; transcript: string } | null> {
  const id = youTubeId(url);
  if (!id) return null;
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${id}&hl=ko`, {
      headers: {
        "Accept-Language": "ko,en;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const titleMatch = html.match(/<title>([^<]*)<\/title>/);
    const title = titleMatch
      ? titleMatch[1].replace(/\s*-\s*YouTube\s*$/, "").trim()
      : "";
    const tracksMatch = html.match(/"captionTracks":(\[.*?\])/);
    if (!tracksMatch) return { title, transcript: "" };
    let tracks: Array<{ baseUrl?: string; languageCode?: string }>;
    try {
      tracks = JSON.parse(tracksMatch[1]);
    } catch {
      return { title, transcript: "" };
    }
    const track = tracks.find((t) => t.languageCode === "ko") ?? tracks[0];
    if (!track?.baseUrl) return { title, transcript: "" };
    const capRes = await fetch(`${track.baseUrl}&fmt=json3`);
    if (!capRes.ok) return { title, transcript: "" };
    const cap = (await capRes.json()) as {
      events?: Array<{ segs?: Array<{ utf8?: string }> }>;
    };
    const transcript = (cap.events ?? [])
      .flatMap((e) => e.segs ?? [])
      .map((s) => s.utf8 ?? "")
      .join("")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000);
    return { title, transcript };
  } catch {
    return null;
  }
}

// Build the multimodal user content: an intro, each material as the right block,
// then the output instruction. Unreadable assets degrade to a text note.
async function buildContent(
  materials: SourceMaterial[],
  opts: GenerateOptions,
): Promise<Anthropic.ContentBlockParam[]> {
  const content: Anthropic.ContentBlockParam[] = [
    {
      type: "text",
      text: "다음은 교사가 학생에게 제시한 수업 자료입니다. 이 자료들을 바탕으로 학생 활동을 만들어 주세요.",
    },
  ];

  for (const m of materials) {
    const caption = m.label?.trim() ? `[자료: ${m.label.trim()}]` : "[자료]";
    if (m.contentType === "text") {
      content.push({ type: "text", text: `${caption}\n${m.value}` });
    } else if (m.contentType === "link") {
      const yt = await fetchYouTube(m.value);
      if (yt && yt.transcript) {
        content.push({
          type: "text",
          text: `${caption} (유튜브 영상 대본)\n제목: ${yt.title}\n${yt.transcript}`,
        });
      } else if (yt) {
        content.push({
          type: "text",
          text: `${caption} (유튜브: ${yt.title || m.value})\n※ 자막이 없어 영상 내용을 읽지 못했습니다. 이 영상 내용에 대한 문항은 만들지 마세요.`,
        });
      } else {
        content.push({
          type: "text",
          text: `${caption} (링크: ${m.value})\n※ 내용을 읽지 못했습니다. 이 링크 내용에 대한 문항은 만들지 마세요.`,
        });
      }
    } else if (m.contentType === "image") {
      const fetched = await fetchAsBase64(m.value);
      if (fetched && (IMAGE_TYPES as readonly string[]).includes(fetched.mediaType)) {
        content.push({ type: "text", text: caption });
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: fetched.mediaType as ImageMedia,
            data: fetched.data,
          },
        });
      } else {
        content.push({ type: "text", text: `${caption} (이미지 자료 — 열 수 없어 제목만 참고)` });
      }
    } else if (m.contentType === "pdf") {
      const fetched = await fetchAsBase64(m.value);
      if (fetched) {
        content.push({ type: "text", text: caption });
        content.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: fetched.data },
        });
      } else {
        content.push({ type: "text", text: `${caption} (PDF 자료 — 열 수 없어 제목만 참고)` });
      }
    }
  }

  const extra = opts.instruction?.trim()
    ? `\n\n[교사 추가 요청 — 반드시 반영]\n${opts.instruction.trim()}`
    : "";

  content.push({
    type: "text",
    text:
      `오직 위에 제시된 자료 안의 내용만 근거로 학생 활동을 만들어 주세요. 자료에 없는 내용·배경지식·추측은 절대 넣지 마세요. 학생이 이 자료만 보고 풀 수 있어야 합니다.\n` +
      `출력은 오직 JSON 배열이며, 순서가 있는 항목들입니다. 각 항목은 둘 중 하나입니다.\n` +
      `1) 제시·보기 블록: {"kind":"content","label":"보기","text":"내용"} — 문항이 참조할 <보기>·지문·표 등 학생에게 보여줄 자료. 필요할 때만, 해당 문항 바로 앞에 배치하세요.\n` +
      `2) 문항: {"kind":"field","type":"short"|"long"|"choice","label":"문항 텍스트","options":["보기1","보기2"]} — options는 type이 choice일 때만.\n` +
      `문항은 자료로 확실히 낼 수 있는 범위에서 최대 ${opts.count}개까지 만드세요(자료가 부족하면 더 적게, 지어내지 말 것). 객관식(choice) 문항의 선지(options)는 정확히 ${opts.choiceCount}개로 만드세요. 단답은 short, 서술형은 long입니다.\n` +
      `<보기>에서 옳은 것을 고르는 유형이면, 먼저 kind:content로 <보기>(예: ㄱ,ㄴ,ㄷ 항목)를 만들고, 이어서 그 보기를 참조하는 kind:choice 문항을 두세요.\n` +
      `자료 이해·적용·자기생각을 고루 섞고, 정답은 쓰지 마세요. JSON 외의 설명은 절대 붙이지 마세요.` +
      extra,
  });

  return content;
}

const SYSTEM = [
  "너는 교사가 올린 수업 자료를 분석해, 오직 그 자료 안의 정보만으로 학생 활동(제시 블록 + 문항)을 설계하는 조력자다.",
  "절대 규칙: 제시된 자료 안에 실제로 있는 내용으로만 문항·보기·선지를 만든다. 자료에 없는 배경지식·상식·외부 정보·추측은 절대 쓰지 않는다.",
  "학생이 그 자료만 보고 답할 수 있어야 한다. 자료가 부실해 근거 있는 문항을 만들 수 없으면, 문항 수를 줄이거나 만들지 않는다(억지로 지어내지 않는다).",
  "교사의 추가 요청은 자료 범위 안에서 반영한다. 정답은 쓰지 않는다. 한국어로, 반드시 JSON 배열만 출력한다.",
].join("\n");

function parseItems(raw: string, choiceCount: number): GeneratedItem[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: GeneratedItem[] = [];
  for (const item of parsed.slice(0, MAX_ITEMS)) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;

    if (r.kind === "content") {
      const text = typeof r.text === "string" ? r.text.trim().slice(0, 4000) : "";
      if (!text) continue;
      const label =
        typeof r.label === "string" ? r.label.trim().slice(0, 80) : undefined;
      out.push({ kind: "content", label, text });
      continue;
    }

    // default to a field
    const label = typeof r.label === "string" ? r.label.trim().slice(0, 400) : "";
    if (!label) continue;
    const type: FieldType =
      r.type === "long" || r.type === "choice" || r.type === "number"
        ? r.type
        : "short";
    let options: string[] | undefined;
    if (type === "choice") {
      options = Array.isArray(r.options)
        ? r.options
            .filter((o): o is string => typeof o === "string")
            .map((o) => o.trim())
            .filter(Boolean)
            .slice(0, Math.max(2, choiceCount))
        : [];
    }
    out.push({ kind: "field", type, label, options });
  }
  return out;
}

export async function generateItems(
  materials: SourceMaterial[],
  opts: GenerateOptions,
): Promise<GeneratedItem[] | null> {
  const client = getAnthropicClient();
  if (!client) return null;
  if (materials.length === 0) return [];

  const content = await buildContent(materials, opts);
  try {
    const res = await client.messages.create({
      model: MODEL_ID[opts.tier] ?? MODEL_ID.fast,
      max_tokens: 3000,
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });
    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    return parseItems(text, opts.choiceCount);
  } catch {
    return null;
  }
}
