// YouTube 자막(대본) 가져오기 — 2단 폴백.
//
// WHY THIS EXISTS (2026-07-27 실측):
// 유튜브는 데이터센터 IP에서 오는 자막 요청을 막는다. 같은 영상·같은 요청이
// 로컬(가정 IP)에서는 자막 6,139자를 돌려주는데 Vercel에서는 자막 트랙이
// 아예 없는 것처럼 응답한다. 그래서 배포본에서만 "자막 없는 영상"으로 잘못
// 판단해 문항이 0개 생성됐다.
//
// 그래서 순서는:
//   1) innertube 직접 호출 — 공짜. 로컬 개발·차단 안 된 환경에서는 이걸로 끝.
//   2) Supadata — 유료(요청 1건 = 1 크레딧). 1)이 실패하면 사용.
//
// 중요: 차단된 IP에서는 유튜브가 "에러"가 아니라 "자막 트랙 없음"처럼
// 응답한다. 따라서 1)의 '자막 없음'은 자막이 정말 없다는 증거가 못 된다.
// 결론(no_captions)은 유료 경로까지 확인한 뒤에만 내린다.

const MAX_TRANSCRIPT_CHARS = 8000;

// Public innertube ANDROID client key — not a secret (it's YouTube's own public
// client key). Used to reach caption tracks the watch page no longer serves.
const YT_ANDROID_KEY = "AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w";

const SUPADATA_ENDPOINT = "https://api.supadata.ai/v1/transcript";
/** Videos over ~20 min come back as an async job; poll until it finishes. */
const JOB_POLL_INTERVAL_MS = 2000;
const JOB_TIMEOUT_MS = 90_000;

export type TranscriptOutcome =
  /** 대본을 확보함. */
  | { status: "ok"; title: string; text: string; source: "youtube" | "supadata" }
  /** 자막이 정말 없는 영상 (유료 경로까지 확인함). */
  | { status: "no_captions"; title: string }
  /**
   * 자막을 가져오지 못함 — 유튜브가 이 서버를 막았고 유료 폴백이 없거나
   * 실패. 교사에게 "자막 없는 영상"이라고 말하면 안 되는 경우.
   */
  | { status: "unavailable"; reason: string }
  | { status: "not_youtube" };

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
  message?: string;
  jobId?: string;
  status?: string;
}

/** Paid path. null = not configured; throws nothing — errors become outcomes. */
async function viaSupadata(url: string): Promise<TranscriptOutcome | null> {
  const key = process.env.SUPADATA_API_KEY;
  if (!key) return null;

  const headers = { "x-api-key": key };
  try {
    // mode=native: 이미 있는 자막만 가져온다(요청 1건 = 1 크레딧).
    // 기본값 auto는 자막이 없으면 AI 음성인식으로 넘어가는데, 그건
    // "영상 1분당 2 크레딧"이다. 12분짜리 자막 없는 영상 한 번이면 24
    // 크레딧 — 무료 100건의 1/4이 버튼 한 번에 날아간다. 자막이 없을
    // 때는 교사에게 대본 붙여넣기를 안내하는 흐름이 이미 있으므로,
    // 비용이 예측 가능한 native로 고정한다.
    const qs = new URLSearchParams({
      url,
      lang: "ko",
      text: "true",
      mode: "native",
    });
    let res = await fetch(`${SUPADATA_ENDPOINT}?${qs}`, { headers });
    let body = (await res.json().catch(() => ({}))) as SupadataBody;

    // Long videos (>20 min) return 202 + a job to poll.
    if (res.status === 202 && body.jobId) {
      const deadline = Date.now() + JOB_TIMEOUT_MS;
      const jobUrl = `${SUPADATA_ENDPOINT}/${encodeURIComponent(body.jobId)}`;
      for (;;) {
        if (Date.now() > deadline) {
          return { status: "unavailable", reason: "transcript_job_timeout" };
        }
        await new Promise((r) => setTimeout(r, JOB_POLL_INTERVAL_MS));
        res = await fetch(jobUrl, { headers });
        body = (await res.json().catch(() => ({}))) as SupadataBody;
        if (body.status === "completed") break;
        if (body.status === "failed") {
          return { status: "unavailable", reason: body.error ?? "transcript_job_failed" };
        }
      }
    } else if (!res.ok) {
      return {
        status: "unavailable",
        reason: `supadata_http_${res.status}${body.error ? `_${body.error}` : ""}`,
      };
    }

    const text = (body.content ?? "").replace(/\s+/g, " ").trim();
    if (!text) return { status: "no_captions", title: "" };
    return {
      status: "ok",
      title: "",
      text: text.slice(0, MAX_TRANSCRIPT_CHARS),
      source: "supadata",
    };
  } catch {
    return { status: "unavailable", reason: "supadata_unreachable" };
  }
}

/**
 * 유튜브 영상 URL → 대본. 무료 경로 먼저, 실패하면 유료 폴백.
 */
export async function getYouTubeTranscript(
  url: string,
): Promise<TranscriptOutcome> {
  const id = youTubeId(url);
  if (!id) return { status: "not_youtube" };

  const free = await viaInnertube(id);
  if (free.text) {
    return { status: "ok", title: free.title, text: free.text, source: "youtube" };
  }

  // 무료 경로가 빈손 — 자막이 없는 건지 우리가 막힌 건지 여기선 알 수 없다.
  const paid = await viaSupadata(url);
  if (!paid) {
    return {
      status: "unavailable",
      reason: free.title ? "youtube_blocked_no_fallback" : "youtube_unreachable",
    };
  }
  // 유료 경로가 제목을 안 주므로 무료 경로에서 얻은 제목을 살린다.
  if (paid.status === "ok") return { ...paid, title: free.title };
  if (paid.status === "no_captions") return { ...paid, title: free.title };
  return paid;
}
