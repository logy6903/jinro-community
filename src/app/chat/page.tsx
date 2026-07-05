"use client";

import { useRef, useState } from "react";

// Grounded chatbot UI. Each question is answered from the teacher-uploaded
// datasets, with sources. Stateless per question (MVP) — grounded Q&A doesn't
// need conversation history.

interface Turn {
  role: "user" | "bot";
  text: string;
  sources?: string[];
}

const EXAMPLES = [
  "수능최저 안 보는 논술 대학 알려줘",
  "가천대 의예과 논술 수능최저는?",
  "데이터분석가가 되려면 어떤 학과가 좋아?",
];

export default function ChatPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listEnd = useRef<HTMLDivElement>(null);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setTurns((t) => [...t, { role: "user", text: q }]);
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = (await res.json()) as {
        answer: string;
        sources?: string[];
      };
      setTurns((t) => [
        ...t,
        { role: "bot", text: data.answer, sources: data.sources },
      ]);
    } catch {
      setTurns((t) => [
        ...t,
        { role: "bot", text: "네트워크 오류가 발생했어요. 다시 시도해주세요." },
      ]);
    } finally {
      setBusy(false);
      setTimeout(() => listEnd.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">자료 챗봇</h1>
        <p className="text-sm text-muted">
          교사들이 올린 데이터를 근거로 답합니다. 없는 내용은 지어내지 않고, 답마다
          출처를 밝혀요.
        </p>
      </div>

      {turns.length === 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted">이렇게 물어보세요</p>
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
          {turns.map((t, i) => (
            <div
              key={i}
              className={t.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed " +
                  (t.role === "user"
                    ? "bg-brand text-white"
                    : "border border-border bg-card")
                }
              >
                <p className="whitespace-pre-wrap">{t.text}</p>
                {t.sources && t.sources.length > 0 && (
                  <p className="mt-2 border-t border-border/50 pt-2 text-xs text-muted">
                    근거 자료: {t.sources.join(", ")}
                  </p>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-border bg-card px-4 py-2.5 text-sm text-muted">
                자료를 찾는 중…
              </div>
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
          placeholder="진학·진로 자료에 대해 물어보세요"
          maxLength={500}
          className="flex-1 rounded-full border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          질문
        </button>
      </form>
    </div>
  );
}
