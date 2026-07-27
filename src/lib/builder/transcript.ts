// YouTube 자막(대본) 가져오기 — 무료 → 유료(자막) → 유료(AI 받아쓰기) 3단.
//
// WHY THIS EXISTS (2026-07-27 실측):
// 유튜브는 데이터센터 IP에서 오는 자막 요청을 막는다. 같은 영상·같은 요청이
// 로컬(가정 IP)에서는 자막 6,139자를 돌려주는데 Vercel에서는 자막 트랙이
// 아예 없는 것처럼 응답한다. 그래서 배포본에서만 "자막 없는 영상"으로 잘못
// 판단해 문항이 0개 생성됐다.
//
// 순서:
//   1) innertube 직접 호출 — 공짜. 로컬·미차단 환경에서는 이걸로 끝.
//   2) Supadata native — 이미 있는 자막만. 요청 1건 = 1 크레딧.
//   3) Supadata generate — 자막이 없는 영상을 AI가 받아쓴다.
//      **영상 1분당 2 크레딧**. 비용이 요청 수가 아니라 길이에 비례하므로
//      교사가 명시적으로 요청했을 때만(allowAi) 들어간다.
//
// 중요: 차단된 IP에서는 유튜브가 "에러"가 아니라 "자막 트랙 없음"처럼
// 응답한다. 따라서 1)의 '자막 없음'은 자막이 없다는 증거가 못 된다.
// 결론(no_captions)은 유료 경로까지 확인한 뒤에만 낸다.

const MAX_TRANSCRIPT_CHARS = 8000;

// Public innertube ANDROID client key — not a secret (it's YouTube's own public
// client key). Used to reach caption tracks the watch page no longer serves.
const YT_ANDROID_KEY = "AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w";

const SUPADATA_TRANSCRIPT = "https://api.supadata.ai/v1/transcript";
const SUPADATA_VIDEO = "https://api.supadata.ai/v1/youtube/video";
/** Videos over ~20 min come back as an async job; poll until it finishes. */
const JOB_POLL_INTERVAL_MS = 2000;
const JOB_TIMEOUT_MS = 120_000;

/** AI 받아쓰기 요금: 영상 1분당 2 크레딧. */
export const AI_CREDITS_PER_MINUTE = 2;
/** 메타데이터 조회 1건 = 1 크레딧. */
const METADATA_CREDITS = 1;

export interface TranscriptOptions {
  /** AI 받아쓰기 허용 여부. 교사가 버튼을 눌렀을 때만 true. */
  allowAi?: boolean;
  /** 이 교사가 더 쓸 수 있는 크레딧. AI 진입 전 예상 비용과 비교한다. */
  aiCreditsLeft?: number;
  /** 받아쓸 수 있는 최대 영상 길이(분). */
  maxAiMinutes?: number;
}

export type TranscriptOutcome =
  /** 대본을 확보함. `credits`는 이번에 실제로 쓴 크레딧. */
  | {
      status: "ok";
      title: string;
      text: string;
      source: "youtube" | "supadata" | "supadata_ai";
      credits: number;
    }
  /** 자막이 없는 영상. AI로 받아쓰면 되지만 아직 허용받지 않았다. */
  | { status: "no_captions"; title: string; credits: number }
  /** 너무 길어 AI 받아쓰기를 하지 않았다. */
  | { status: "too_long"; minutes: number; credits: number }
  /** 남은 무료 크레딧으로는 이 영상을 받아쓸 수 없다. */
  | { status: "quota_exceeded"; needed: number; minutes: number; credits: number }
  /**
   * 자막을 가져오지 못함 — 유튜브가 이 서버를 막았고 유료 폴백이 없거나
   * 실패. 교사에게 "자막 없는 영상"이라고 말하면 안 되는 경우.
   */
  | { status: "unavailable"; reason: string; credits: number }
  | { status: "not_youtube"; credits: number };

export function youTubeId(url: string): string | null {
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

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

// timedtext XML → plain text (strips <text>/<p> wrappers and inner <s> segments).
function timedTextToString(xml: string): string {
  const parts = [
    ...xml.matchAll(/<(?:text|p)\b[^>]*>([\s\S]*?)<\/(?:text|p)>/g),
  ].map((m) => m[1].replace(/<[^>]+>/g, ""));
  return decodeEntities(parts.join(" ")).replace(/\s+/g, " ").trim();
}

/** Free path. Returns the title even when captions can't be read. */
async function viaInnertube(
  id: string,
): Promise<{ title: string; text: string }> {
  try {
    const res = await fetch(
      `https://www.youtube.com/youtubei/v1/player?key=${YT_ANDROID_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent":
            "com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip",
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: "ANDROID",
              clientVersion: "20.10.38",
              androidSdkVersion: 34,
              hl: "ko",
              gl: "KR",
            },
          },
          videoId: id,
        }),
      },
    );
    if (!res.ok) return { title: "", text: "" };
    const j = (await res.json()) as {
      videoDetails?: { title?: string };
      captions?: {
        playerCaptionsTracklistRenderer?: {
          captionTracks?: Array<{ baseUrl?: string; languageCode?: string }>;
        };
      };
    };
    const title = j.videoDetails?.title ?? "";
    const tracks =
      j.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
    const track = tracks.find((t) => t.languageCode === "ko") ?? tracks[0];
    if (!track?.baseUrl) return { title, text: "" };
    const capRes = await fetch(track.baseUrl);
    if (!capRes.ok) return { title, text: "" };
    return {
      title,
      text: timedTextToString(await capRes.text()).slice(0, MAX_TRANSCRIPT_CHARS),
    };
  } catch {
    return { title: "", text: "" };
  }
}

interface SupadataBody {
  content?: string;
  lang?: string;
  error?: string;
  jobId?: string;
  status?: string;
}

/** 응답 헤더의 실제 청구량. 없으면 호출자가 넘긴 추정치를 쓴다. */
function billed(res: Response, fallback: number): number {
  const raw = res.headers.get("x-billable-requests");
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** 영상 길이(초). 1 크레딧. 못 읽으면 null. */
async function fetchDurationSec(
  url: string,
  key: string,
): Promise<number | null> {
  try {
    const res = await fetch(
      `${SUPADATA_VIDEO}?${new URLSearchParams({ id: url })}`,
      { headers: { "x-api-key": key } },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { media?: { duration?: number } };
    const d = j.media?.duration;
    return typeof d === "number" && d > 0 ? d : null;
  } catch {
    return null;
  }
}

/** 202로 시작한 비동기 잡을 끝날 때까지 폴링. 잡 조회는 과금되지 않는다. */
async function awaitJob(
  jobId: string,
  key: string,
): Promise<SupadataBody | null> {
  const deadline = Date.now() + JOB_TIMEOUT_MS;
  const jobUrl = `${SUPADATA_TRANSCRIPT}/${encodeURIComponent(jobId)}`;
  for (;;) {
    if (Date.now() > deadline) return null;
    await new Promise((r) => setTimeout(r, JOB_POLL_INTERVAL_MS));
    const res = await fetch(jobUrl, { headers: { "x-api-key": key } });
    const body = (await res.json().catch(() => ({}))) as SupadataBody;
    if (body.status === "completed") return body;
    if (body.status === "failed") return null;
  }
}

async function callTranscript(
  url: string,
  key: string,
  mode: "native" | "generate",
  fallbackCredits: number,
): Promise<{ text: string; credits: number } | { error: string; credits: number }> {
  const qs = new URLSearchParams({ url, lang: "ko", text: "true", mode });
  const res = await fetch(`${SUPADATA_TRANSCRIPT}?${qs}`, {
    headers: { "x-api-key": key },
  });
  let body = (await res.json().catch(() => ({}))) as SupadataBody;
  const credits = billed(res, fallbackCredits);

  if (res.status === 202 && body.jobId) {
    const done = await awaitJob(body.jobId, key);
    if (!done) return { error: "transcript_job_failed", credits };
    body = done;
  } else if (!res.ok) {
    return { error: `supadata_http_${res.status}`, credits };
  }

  const text = (body.content ?? "").replace(/\s+/g, " ").trim();
  return { text: text.slice(0, MAX_TRANSCRIPT_CHARS), credits };
}

/**
 * 유튜브 영상 URL → 대본. 무료 경로 먼저, 실패하면 유료 자막,
 * 그래도 없으면 (허용된 경우에만) AI 받아쓰기.
 */
export async function getYouTubeTranscript(
  url: string,
  opts: TranscriptOptions = {},
): Promise<TranscriptOutcome> {
  const id = youTubeId(url);
  if (!id) return { status: "not_youtube", credits: 0 };

  // 1) 무료 경로
  const free = await viaInnertube(id);
  if (free.text) {
    return {
      status: "ok",
      title: free.title,
      text: free.text,
      source: "youtube",
      credits: 0,
    };
  }

  const key = process.env.SUPADATA_API_KEY;
  if (!key) {
    return {
      status: "unavailable",
      reason: free.title ? "youtube_blocked_no_fallback" : "youtube_unreachable",
      credits: 0,
    };
  }

  let spent = 0;

  // 2) 유료 — 이미 있는 자막만 (1 크레딧)
  const native = await callTranscript(url, key, "native", 1);
  spent += native.credits;
  if ("text" in native && native.text) {
    return {
      status: "ok",
      title: free.title,
      text: native.text,
      source: "supadata",
      credits: spent,
    };
  }

  // 3) 자막이 없다. AI 받아쓰기는 교사가 명시적으로 요청했을 때만.
  if (!opts.allowAi) {
    return { status: "no_captions", title: free.title, credits: spent };
  }

  // 길이를 먼저 확인한다(1 크레딧). 비용이 길이에 비례하므로, 얼마가 들지
  // 모르는 채로 받아쓰기에 들어가면 긴 영상 하나가 할당량을 통째로 먹는다.
  const durationSec = await fetchDurationSec(url, key);
  spent += METADATA_CREDITS;
  if (durationSec === null) {
    return { status: "unavailable", reason: "duration_unknown", credits: spent };
  }

  const minutes = Math.ceil(durationSec / 60);
  const maxMinutes = opts.maxAiMinutes ?? 20;
  if (minutes > maxMinutes) {
    return { status: "too_long", minutes, credits: spent };
  }

  const estimate = minutes * AI_CREDITS_PER_MINUTE;
  if (opts.aiCreditsLeft !== undefined && estimate > opts.aiCreditsLeft) {
    return { status: "quota_exceeded", needed: estimate, minutes, credits: spent };
  }

  const gen = await callTranscript(url, key, "generate", estimate);
  spent += gen.credits;
  if ("error" in gen || !gen.text) {
    return { status: "unavailable", reason: "ai_transcript_failed", credits: spent };
  }
  return {
    status: "ok",
    title: free.title,
    text: gen.text,
    source: "supadata_ai",
    credits: spent,
  };
}
