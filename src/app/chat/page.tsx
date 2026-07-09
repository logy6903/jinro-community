"use client";

import { useRef, useState } from "react";
import type { LocalAnswer, LocalDataset } from "@/lib/chat/local";

// 자료 검색 — 저장된 데이터에서만 답한다(LLM 없음, 생성 없음). 질문 키워드로
// 매칭되는 행/자료를 그대로 보여주고 출처를 밝힌다. 로그인 불필요(비용 0).

type Turn =
  | { role: "user"; text: string }
  | { role: "bot"; answer: LocalAnswer };

const EXAMPLES = [
  "성균관대 논술 최저",
  "수능최저 3합 6",
  "학교장추천 모집단위",
];

export default function ChatPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listEnd = useRef<HTMLDivElement>(null);

  async function ask(question: string) {
    if (busy) return;
    const q = question.trim();
    if (!q) return;
    setInput("");
    setTurns((t) => [...t, { role: "user", text: q }]);
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const answer = (await res.json()) as LocalAnswer;
      setTurns((t) => [...t, { role: "bot", answer }]);
    } catch {
      setTurns((t) => [
        ...t,
        {
          role: "bot",
          answer: { datasets: [], materials: [], infos: [], empty: true },
        },
      ]);
    } finally {
      setBusy(false);
      setTimeout(() => listEnd.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">자료 검색</h1>
        <p className="text-sm text-muted">
          교사들이 올린 데이터에서만 찾아 <b>그대로</b> 보여줍니다. 없는 내용은
          지어내지 않아요(AI 생성 아님). 답마다 출처를 밝힙니다.
        </p>
      </div>

      {turns.length === 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted">이렇게 검색해보세요</p>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => void ask(ex)}
              className="self-start rounded-full border border-border px-3 py-1.5 text-sm text-muted hover:border-brand hover:text-foreground"
            >
              {ex}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {turns.map((t, i) =>
            t.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl bg-brand px-4 py-2.5 text-sm text-white">
                  {t.text}
                </div>
              </div>
            ) : (
              <BotAnswer key={i} answer={t.answer} />
            ),
          )}
          {busy && (
            <div className="rounded-2xl border border-border bg-card px-4 py-2.5 text-sm text-muted">
              자료를 찾는 중…
            </div>
          )}
          <div ref={listEnd} />
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
        className="sticky bottom-4 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="예: 성균관대 논술 최저"
          maxLength={500}
          className="flex-1 rounded-full border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          검색
        </button>
      </form>
    </div>
  );
}

function BotAnswer({ answer }: { answer: LocalAnswer }) {
  if (answer.empty) {
    return (
      <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted">
        저장된 자료에서 찾지 못했어요. 관련 데이터를 올리면 그 자료로 답할 수 있어요.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {answer.datasets.map((d) => (
        <DatasetCard key={d.id} d={d} />
      ))}
      {answer.materials.map((m, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">{m.title}</p>
          <p className="mt-1 text-xs text-muted">공유글 · {m.author}</p>
          <p className="mt-2 text-sm leading-relaxed">{m.summary || m.body}</p>
        </div>
      ))}
      {answer.infos.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-2 text-xs font-semibold text-muted">관련 정보</p>
          <ul className="flex flex-col gap-1.5">
            {answer.infos.map((it, i) => (
              <li key={i} className="text-sm">
                {it.url ? (
                  <a href={it.url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                    {it.title}
                  </a>
                ) : (
                  it.title
                )}
                <span className="text-xs text-muted"> — {it.summary} ({it.source})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DatasetCard({ d }: { d: LocalDataset }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
          {d.category}
        </span>
        <span className="text-sm font-semibold">{d.title}</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-xs">
          <thead className="bg-brand-soft">
            <tr>
              {d.columns.map((c, i) => (
                <th key={i} className="whitespace-nowrap px-3 py-1.5 text-left font-medium text-brand">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.rows.map((row, ri) => (
              <tr key={ri} className="border-t border-border">
                {d.columns.map((_, ci) => (
                  <td key={ci} className="whitespace-nowrap px-3 py-1 text-foreground/80">
                    {row[ci]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        {d.source && <span>출처: {d.source}</span>}
        {d.sourceId && d.sourcePage && (
          <a
            href={`/api/pdf/${d.sourceId}/page?start=${d.sourcePage}&end=${d.sourceEndPage ?? d.sourcePage}`}
            className="font-medium text-brand hover:underline"
          >
            출처 페이지 PDF ⬇
            {d.sourceEndPage && d.sourceEndPage > d.sourcePage
              ? ` (${d.sourcePage}~${d.sourceEndPage}p)`
              : ` (${d.sourcePage}p)`}
          </a>
        )}
        {d.originalUrl && (
          <a href={d.originalUrl} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
            원문 전체 ↗
          </a>
        )}
      </p>
    </div>
  );
}
