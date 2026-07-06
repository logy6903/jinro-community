"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { useAuth } from "@/lib/auth/AuthProvider";
import { app } from "@/lib/firebase/client";
import { BuilderPreview } from "@/components/builder/BuilderPreview";
import type {
  AiModelTier,
  Block,
  BuilderApp,
  ContentType,
  FieldType,
  Roster,
} from "@/lib/builder/types";

// Teacher workspace. Login-gated. An app is an ordered list of BLOCKS the
// teacher stacks: 📄 제시(자료: 텍스트/이미지/링크) + ✍️ 문항(입력) + 🤖 AI(문항 종속).
// This turns the app from a submission box into an activity: 자료 제시 → 활동.

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-brand";

const FIELD_TYPES: FieldType[] = ["short", "long", "number", "choice"];
const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  short: "단답",
  long: "장문",
  number: "숫자",
  choice: "객관식",
};

const CONTENT_TYPES: ContentType[] = ["text", "image", "pdf", "link"];
const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  text: "텍스트/지시문",
  image: "이미지",
  pdf: "PDF",
  link: "링크/영상",
};

const AI_TIERS: AiModelTier[] = ["fast", "smart"];
const AI_TIER_LABEL: Record<AiModelTier, string> = {
  fast: "간단 (빠름·저렴)",
  smart: "정밀 (고품질)",
};

function rid() {
  return Math.random().toString(36).slice(2);
}

// Upload a teacher's file to Firebase Storage; returns a public download URL.
// Requires Storage enabled + a rule allowing the signed-in teacher to write
// under builder_uploads/{uid}/. Throws when Storage isn't configured.
async function uploadFile(file: File, uid: string): Promise<string> {
  if (!app) throw new Error("Firebase not configured");
  const storage = getStorage(app);
  const safe = file.name.replace(/[^\w.\-]/g, "_");
  const r = ref(storage, `builder_uploads/${uid}/${Date.now()}_${safe}`);
  await uploadBytes(r, file);
  return getDownloadURL(r);
}

interface DraftAiBlock {
  title: string;
  instruction: string;
  model: AiModelTier;
  showToStudent: boolean;
}

interface DraftBlock {
  key: string;
  kind: "content" | "field";
  // content
  contentType: ContentType;
  value: string;
  caption: string;
  uploading: boolean;
  // field
  type: FieldType;
  label: string;
  required: boolean;
  options: string; // comma-separated; only for "choice"
  ai: DraftAiBlock | null; // AI attaches to a field block
}

function baseDraft(): DraftBlock {
  return {
    key: rid(),
    kind: "field",
    contentType: "text",
    value: "",
    caption: "",
    uploading: false,
    type: "short",
    label: "",
    required: false,
    options: "",
    ai: null,
  };
}
const newFieldDraft = (): DraftBlock => ({ ...baseDraft(), kind: "field" });
const newContentDraft = (): DraftBlock => ({ ...baseDraft(), kind: "content" });

function newAiBlock(): DraftAiBlock {
  return { title: "피드백", instruction: "", model: "fast", showToStudent: true };
}

// Convert the editor's draft blocks into stored Block[] (ids = draft keys so AI
// blocks can reference their field). Used for both saving and live preview.
function draftsToBlocks(drafts: DraftBlock[]): Block[] {
  let fieldNo = 0;
  return drafts.map((d) => {
    if (d.kind === "content") {
      return {
        id: d.key,
        kind: "content" as const,
        contentType: d.contentType,
        value: d.value.trim(),
        label: d.caption.trim() || undefined,
      };
    }
    fieldNo += 1;
    return {
      id: d.key,
      kind: "field" as const,
      type: d.type,
      label: d.label.trim() || `문항 ${fieldNo}`,
      required: d.required,
      options:
        d.type === "choice"
          ? d.options
              .split(",")
              .map((o) => o.trim())
              .filter(Boolean)
          : undefined,
    };
  });
}

export function AppBuilder() {
  const { user, loading, signInWithGoogle } = useAuth();

  const [apps, setApps] = useState<BuilderApp[]>([]);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);

  const [title, setTitle] = useState("");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [semester, setSemester] = useState<number>(1);
  const [openAt, setOpenAt] = useState("");
  const [closeAt, setCloseAt] = useState("");
  const [rosterId, setRosterId] = useState("");
  const [drafts, setDrafts] = useState<DraftBlock[]>([
    newContentDraft(),
    newFieldDraft(),
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // 🤖 자료 → 문항 자동 생성 (제작 단계 AI, 앱당 1회)
  const [genSelected, setGenSelected] = useState<Set<string>>(new Set());
  const [genCount, setGenCount] = useState(4);
  const [genChoiceCount, setGenChoiceCount] = useState(5);
  const [genModel, setGenModel] = useState<AiModelTier>("fast");
  const [genInstruction, setGenInstruction] = useState("");
  const [genBusy, setGenBusy] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const loadApps = useCallback(async () => {
    if (!user) return;
    setLoadingApps(true);
    try {
      const token = await user.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [appsRes, rostersRes] = await Promise.all([
        fetch("/api/builder/apps", { headers }),
        fetch("/api/builder/rosters", { headers }),
      ]);
      if (appsRes.ok) {
        const data = (await appsRes.json()) as { apps: BuilderApp[] };
        setApps(data.apps);
      }
      if (rostersRes.ok) {
        const data = (await rostersRes.json()) as { rosters: Roster[] };
        setRosters(data.rosters);
      }
    } finally {
      setLoadingApps(false);
    }
  }, [user]);

  useEffect(() => {
    void loadApps();
  }, [loadApps]);

  function updateDraft(key: string, patch: Partial<DraftBlock>) {
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }
  function removeDraft(key: string) {
    setDrafts((ds) => (ds.length > 1 ? ds.filter((d) => d.key !== key) : ds));
  }
  function moveDraft(key: string, dir: -1 | 1) {
    setDrafts((ds) => {
      const i = ds.findIndex((d) => d.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ds.length) return ds;
      const next = [...ds];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  async function onContentFile(key: string, file: File | undefined) {
    if (!file || !user) return;
    updateDraft(key, { uploading: true });
    try {
      const url = await uploadFile(file, user.uid);
      updateDraft(key, { value: url, uploading: false });
    } catch {
      updateDraft(key, { uploading: false });
      setError(
        "파일 업로드에 실패했어요. Firebase Storage 설정을 확인하거나 URL을 직접 붙여넣어 주세요.",
      );
    }
  }
  function updateAi(key: string, patch: Partial<DraftAiBlock>) {
    setDrafts((ds) =>
      ds.map((d) =>
        d.key === key && d.ai ? { ...d, ai: { ...d.ai, ...patch } } : d,
      ),
    );
  }

  function toggleGen(key: string) {
    setGenSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Send the selected 제시 자료 to the AI and append the returned questions as
  // editable field drafts. Draft-stage AI — one call per app, teacher-side.
  async function onGenerateQuestions() {
    if (genBusy || !user) return;
    const chosen = drafts.filter(
      (d) => d.kind === "content" && genSelected.has(d.key) && d.value.trim(),
    );
    if (chosen.length === 0) {
      setGenError("문항의 근거가 될 자료를 하나 이상 선택하세요.");
      return;
    }
    setGenBusy(true);
    setGenError(null);
    try {
      const token = await user.getIdToken();
      const materials = chosen.map((d) => ({
        contentType: d.contentType,
        value: d.value.trim(),
        label: d.caption.trim() || undefined,
      }));
      const res = await fetch("/api/builder/generate-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          materials,
          count: genCount,
          model: genModel,
          choiceCount: genChoiceCount,
          instruction: genInstruction.trim() || undefined,
        }),
      });
      if (res.status === 503) {
        setGenError("AI가 설정되지 않았어요 (.env.local 의 ANTHROPIC_API_KEY 확인).");
        return;
      }
      if (!res.ok) {
        setGenError("문항 생성에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      const data = (await res.json()) as {
        items: (
          | { kind: "content"; label?: string; text: string }
          | { kind: "field"; type: FieldType; label: string; options?: string[] }
        )[];
      };
      if (data.items.length === 0) {
        setGenError("문항을 만들지 못했어요. 자료 내용을 확인해 주세요.");
        return;
      }
      // Append in order: AI-generated 보기/지문 as content drafts, questions as
      // field drafts. The teacher can edit or delete any of them.
      setDrafts((ds) => [
        ...ds,
        ...data.items.map((it) =>
          it.kind === "content"
            ? { ...newContentDraft(), value: it.text, caption: it.label ?? "" }
            : {
                ...newFieldDraft(),
                type: it.type,
                label: it.label,
                options: it.options?.join(", ") ?? "",
              },
        ),
      ]);
    } catch {
      setGenError("네트워크 오류가 발생했어요.");
    } finally {
      setGenBusy(false);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !user) return;
    setBusy(true);
    setError(null);
    try {
      if (!title.trim()) {
        setError("제목을 입력해 주세요.");
        return;
      }
      if (drafts.filter((d) => d.kind === "field").length === 0) {
        setError("학생이 답할 문항을 하나 이상 넣어 주세요.");
        return;
      }

      const blocks = draftsToBlocks(drafts);

      const aiBlocks = drafts
        .filter((d) => d.kind === "field" && d.ai && d.ai.instruction.trim())
        .map((d) => ({
          title: d.ai!.title.trim() || "AI 피드백",
          instruction: d.ai!.instruction.trim(),
          model: d.ai!.model,
          showToStudent: d.ai!.showToStudent,
          inputFieldIds: [d.key],
        }));

      const token = await user.getIdToken();
      const res = await fetch("/api/builder/apps", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          year,
          semester,
          openAt,
          closeAt,
          rosterId,
          blocks,
          aiBlocks,
        }),
      });
      if (!res.ok) {
        setError("생성에 실패했어요. 객관식은 선택지를, 자료는 내용을 채워 주세요.");
        return;
      }
      setTitle("");
      setDrafts([newContentDraft(), newFieldDraft()]);
      await loadApps();
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-muted">···</p>;

  if (!user) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
        <h1 className="text-lg font-bold">수업앱 만들기</h1>
        <p className="text-sm text-muted">
          학생에게 나눠줄 활동(자료 제시 + 문항)을 만들려면 로그인이 필요합니다.
        </p>
        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          className="self-start rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Google로 로그인
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">수업앱 만들기</h1>
          <div className="flex gap-2">
            <Link
              href="/builder/rosters"
              className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted hover:border-brand"
            >
              👥 명렬 관리
            </Link>
            <Link
              href="/builder/records"
              className="rounded-full border border-brand/50 px-3 py-1 text-xs font-medium text-brand hover:bg-brand-soft"
            >
              📄 생활기록부 생성
            </Link>
          </div>
        </div>
        <form onSubmit={onCreate} className="flex flex-col gap-4">
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="text-muted">앱 제목</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                placeholder="예: 3주차 지문 분석 활동"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">연도</span>
              <input
                type="number"
                value={year || ""}
                onChange={(e) => setYear(Number(e.target.value) || 0)}
                min={2000}
                max={2100}
                className={inputClass + " max-w-[7rem]"}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">학기</span>
              <select
                value={semester}
                onChange={(e) => setSemester(Number(e.target.value))}
                className={inputClass + " max-w-[6.5rem]"}
              >
                <option value={1}>1학기</option>
                <option value={2}>2학기</option>
              </select>
            </label>
          </div>

          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="text-muted">제출 시작 (선택)</span>
              <input
                type="datetime-local"
                value={openAt}
                onChange={(e) => setOpenAt(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="text-muted">제출 마감 (선택)</span>
              <input
                type="datetime-local"
                value={closeAt}
                onChange={(e) => setCloseAt(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">
              대상 학급 (선택 — 지정하면 학생이 학번·비밀번호로 로그인)
            </span>
            <select
              value={rosterId}
              onChange={(e) => setRosterId(e.target.value)}
              className={inputClass}
            >
              <option value="">개방형 (학번·이름 자유 입력, 로그인 없음)</option>
              {rosters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.school ? ` · ${r.school}` : ""} · {r.students.length}명
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-3">
            <span className="text-sm text-muted">
              활동 구성 — 자료(제시)와 문항(입력)을 순서대로 쌓으세요
            </span>

            {drafts.map((d, i) => {
              const fieldNo = drafts
                .slice(0, i + 1)
                .filter((x) => x.kind === "field").length;

              if (d.kind === "content") {
                return (
                  <div
                    key={d.key}
                    className="flex flex-col gap-2 rounded-xl border border-border bg-brand-soft p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted">
                        📄 제시 자료
                      </span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => moveDraft(d.key, -1)}
                          disabled={i === 0}
                          className="rounded-lg border border-border bg-card px-2 text-xs text-muted hover:border-brand disabled:opacity-30"
                          aria-label="위로"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveDraft(d.key, 1)}
                          disabled={i === drafts.length - 1}
                          className="rounded-lg border border-border bg-card px-2 text-xs text-muted hover:border-brand disabled:opacity-30"
                          aria-label="아래로"
                        >
                          ▼
                        </button>
                        <button
                          type="button"
                          onClick={() => removeDraft(d.key)}
                          className="rounded-lg border border-border bg-card px-2 text-sm text-muted hover:border-brand"
                          aria-label="자료 삭제"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={d.contentType}
                        onChange={(e) =>
                          updateDraft(d.key, {
                            contentType: e.target.value as ContentType,
                          })
                        }
                        className={inputClass + " max-w-[9rem]"}
                      >
                        {CONTENT_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {CONTENT_TYPE_LABEL[t]}
                          </option>
                        ))}
                      </select>
                      <input
                        value={d.caption}
                        onChange={(e) =>
                          updateDraft(d.key, { caption: e.target.value })
                        }
                        placeholder={
                          d.contentType === "image"
                            ? "지시문 (예: 다음 그림을 보고 물음에 답하시오)"
                            : d.contentType === "link"
                              ? "지시문 (예: 다음 영상을 보고 물음에 답하시오)"
                              : "지시문 (예: 다음 글을 읽고 물음에 답하시오)"
                        }
                        maxLength={200}
                        className={inputClass}
                      />
                    </div>
                    {d.contentType === "text" ? (
                      <textarea
                        value={d.value}
                        onChange={(e) =>
                          updateDraft(d.key, { value: e.target.value })
                        }
                        rows={4}
                        placeholder="학생에게 보여줄 내용 (지문·설명·문제)"
                        className={inputClass + " resize-y"}
                      />
                    ) : (
                      <div className="flex flex-col gap-1">
                        {(d.contentType === "image" ||
                          d.contentType === "pdf") && (
                          <div className="flex items-center gap-2">
                            <input
                              type="file"
                              accept={
                                d.contentType === "image"
                                  ? "image/*"
                                  : "application/pdf"
                              }
                              onChange={(e) =>
                                void onContentFile(d.key, e.target.files?.[0])
                              }
                              className="text-xs"
                            />
                            {d.uploading && (
                              <span className="text-xs text-muted">업로드 중…</span>
                            )}
                          </div>
                        )}
                        <input
                          value={d.value}
                          onChange={(e) =>
                            updateDraft(d.key, { value: e.target.value })
                          }
                          placeholder={
                            d.contentType === "image"
                              ? "이미지 URL (또는 위에서 파일 업로드)"
                              : d.contentType === "pdf"
                                ? "PDF URL (또는 위에서 파일 업로드)"
                                : "링크/유튜브 URL (https://...)"
                          }
                          className={inputClass}
                        />
                        {d.contentType === "link" && (
                          <span className="text-xs text-muted">
                            유튜브 링크는 학생 화면에서 바로 재생돼요.
                          </span>
                        )}
                        {d.contentType === "image" && d.value && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={d.value}
                            alt=""
                            className="max-h-40 rounded-lg border border-border"
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              }

              // field block
              return (
                <div
                  key={d.key}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted">
                      ✍️ 문항 {fieldNo}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveDraft(d.key, -1)}
                        disabled={i === 0}
                        className="rounded-lg border border-border px-2 text-xs text-muted hover:border-brand disabled:opacity-30"
                        aria-label="위로"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => moveDraft(d.key, 1)}
                        disabled={i === drafts.length - 1}
                        className="rounded-lg border border-border px-2 text-xs text-muted hover:border-brand disabled:opacity-30"
                        aria-label="아래로"
                      >
                        ▼
                      </button>
                      {!d.ai && (
                        <button
                          type="button"
                          onClick={() =>
                            updateDraft(d.key, { ai: newAiBlock() })
                          }
                          className="rounded-full border border-brand/50 px-2.5 py-1 text-xs font-medium text-brand hover:bg-brand-soft"
                        >
                          🤖 AI 기능 추가
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeDraft(d.key)}
                        className="rounded-lg border border-border px-2 text-sm text-muted hover:border-brand"
                        aria-label="문항 삭제"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <select
                      value={d.type}
                      onChange={(e) =>
                        updateDraft(d.key, { type: e.target.value as FieldType })
                      }
                      className={inputClass + " max-w-[7rem]"}
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {FIELD_TYPE_LABEL[t]}
                        </option>
                      ))}
                    </select>
                    <input
                      value={d.label}
                      onChange={(e) =>
                        updateDraft(d.key, { label: e.target.value })
                      }
                      placeholder={`질문 내용 (비우면 문항 ${fieldNo})`}
                      maxLength={200}
                      className={inputClass}
                    />
                  </div>

                  {d.type === "choice" && (
                    <input
                      value={d.options}
                      onChange={(e) =>
                        updateDraft(d.key, { options: e.target.value })
                      }
                      placeholder="선택지 (쉼표로 구분: 상, 중, 하)"
                      className={inputClass}
                    />
                  )}

                  <label className="flex items-center gap-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={d.required}
                      onChange={(e) =>
                        updateDraft(d.key, { required: e.target.checked })
                      }
                    />
                    필수 입력
                  </label>

                  {d.ai && (
                    <div className="mt-1 flex flex-col gap-2 rounded-lg border border-brand/40 bg-brand-soft p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-brand">
                          🤖 이 문항에 붙는 AI
                        </span>
                        <button
                          type="button"
                          onClick={() => updateDraft(d.key, { ai: null })}
                          className="rounded-lg border border-border bg-card px-2 text-sm text-muted hover:border-brand"
                          aria-label="AI 기능 삭제"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={d.ai.title}
                          onChange={(e) =>
                            updateAi(d.key, { title: e.target.value })
                          }
                          placeholder="이름 (예: 피드백)"
                          maxLength={40}
                          className={inputClass + " max-w-[10rem]"}
                        />
                        <select
                          value={d.ai.model}
                          onChange={(e) =>
                            updateAi(d.key, {
                              model: e.target.value as AiModelTier,
                            })
                          }
                          className={inputClass}
                        >
                          {AI_TIERS.map((t) => (
                            <option key={t} value={t}>
                              {AI_TIER_LABEL[t]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <textarea
                        value={d.ai.instruction}
                        onChange={(e) =>
                          updateAi(d.key, { instruction: e.target.value })
                        }
                        rows={3}
                        placeholder="AI에게 시킬 일 (예: 학생 답을 읽고 잘한 점과 고칠 점을 알려줘. 정답은 알려주지 마.)"
                        maxLength={2000}
                        className={inputClass + " resize-y"}
                      />
                      <label className="flex items-center gap-2 text-xs text-muted">
                        <input
                          type="checkbox"
                          checked={d.ai.showToStudent}
                          onChange={(e) =>
                            updateAi(d.key, { showToStudent: e.target.checked })
                          }
                        />
                        학생에게 결과 보여주기 (끄면 교사만 봄)
                      </label>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDrafts((ds) => [...ds, newContentDraft()])}
                className="self-start rounded-full border border-border px-3 py-1 text-sm text-muted hover:border-brand"
              >
                + 자료 제시
              </button>
              <button
                type="button"
                onClick={() => setDrafts((ds) => [...ds, newFieldDraft()])}
                className="self-start rounded-full border border-border px-3 py-1 text-sm text-muted hover:border-brand"
              >
                + 문항
              </button>
            </div>

            {drafts.some((d) => d.kind === "content" && d.value.trim()) && (
              <div className="flex flex-col gap-2 rounded-xl border border-brand/40 bg-brand-soft p-3">
                <span className="text-xs font-semibold text-brand">
                  🤖 자료로 문항 자동 생성
                </span>
                <p className="text-xs text-muted">
                  문항의 근거가 될 자료를 고르면 AI가 문항 초안(+필요하면 &lt;보기&gt;
                  같은 자료)을 만들어 아래에 추가해요. 이미지·PDF도 읽습니다. 아래
                  &lsquo;추가 요청&rsquo;에 원하는 형식을 적을 수 있어요. (추가 후 자유롭게 수정·삭제)
                </p>
                <div className="flex flex-wrap gap-2">
                  {drafts
                    .filter((d) => d.kind === "content" && d.value.trim())
                    .map((d, idx) => (
                      <label
                        key={d.key}
                        className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={genSelected.has(d.key)}
                          onChange={() => toggleGen(d.key)}
                        />
                        {d.caption.trim() ||
                          `${CONTENT_TYPE_LABEL[d.contentType]} 자료 ${idx + 1}`}
                      </label>
                    ))}
                </div>
                <textarea
                  value={genInstruction}
                  onChange={(e) => setGenInstruction(e.target.value)}
                  rows={2}
                  placeholder="추가 요청 (선택) — 예: <보기> ㄱ·ㄴ·ㄷ을 만들고, 그중 옳은 것을 있는 대로 고르는 객관식으로 출제해줘"
                  maxLength={1000}
                  className={inputClass + " resize-y text-xs"}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1 text-xs text-muted">
                    문항 수
                    <select
                      value={genCount}
                      onChange={(e) => setGenCount(Number(e.target.value))}
                      className="rounded-lg border border-border bg-card px-2 py-1 text-xs"
                    >
                      {[2, 3, 4, 5, 6, 8].map((n) => (
                        <option key={n} value={n}>
                          {n}개
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1 text-xs text-muted">
                    객관식 선지
                    <select
                      value={genChoiceCount}
                      onChange={(e) => setGenChoiceCount(Number(e.target.value))}
                      className="rounded-lg border border-border bg-card px-2 py-1 text-xs"
                    >
                      {[3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n}개
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1 text-xs text-muted">
                    품질
                    <select
                      value={genModel}
                      onChange={(e) => setGenModel(e.target.value as AiModelTier)}
                      className="rounded-lg border border-border bg-card px-2 py-1 text-xs"
                    >
                      <option value="fast">간단 (무료·빠름)</option>
                      <option value="smart">정밀 (고품질)</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => void onGenerateQuestions()}
                    disabled={genBusy || genSelected.size === 0}
                    className="rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {genBusy ? "생성 중…" : "🤖 문항 생성"}
                  </button>
                </div>
                {genError && <p className="text-xs text-red-600">{genError}</p>}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "만드는 중…" : "앱 만들기"}
            </button>
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="rounded-full border border-border px-5 py-2 text-sm text-muted hover:border-brand"
            >
              {showPreview ? "미리보기 닫기" : "👀 학생 화면 미리보기"}
            </button>
          </div>
        </form>

        {showPreview && (
          <BuilderPreview
            title={title}
            blocks={draftsToBlocks(drafts).filter(
              (b) => b.kind !== "content" || b.value.trim(),
            )}
          />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted">내가 만든 앱</h2>
        {loadingApps ? (
          <p className="text-sm text-muted">불러오는 중…</p>
        ) : apps.length === 0 ? (
          <p className="text-sm text-muted">아직 만든 앱이 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {apps.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-3"
              >
                <div className="flex flex-col">
                  <Link
                    href={`/builder/${a.id}`}
                    className="text-sm font-medium hover:text-brand"
                  >
                    {a.title}
                  </Link>
                  <span className="text-xs text-muted">
                    {a.school && `${a.school} · `}
                    {a.year > 0 && (
                      <>
                        {a.year}년 {a.semester || "?"}학기 ·{" "}
                      </>
                    )}
                    공유 코드 <span className="font-mono">{a.code}</span> ·{" "}
                    <Link href={`/a/${a.code}`} className="hover:text-brand">
                      /a/{a.code}
                    </Link>
                    {a.aiBlocks.length > 0 && " · 🤖 AI"}
                  </span>
                </div>
                <Link
                  href={`/builder/${a.id}`}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-brand"
                >
                  결과 보기
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
