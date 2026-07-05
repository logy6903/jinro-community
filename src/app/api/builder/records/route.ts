import { getAppById, listSubmissions } from "@/lib/builder/repository";
import { verifyRequestUser } from "@/lib/builder/auth";
import { fillAiSlots, type StudentActivity } from "@/lib/builder/records";
import type { RecordSlot } from "@/lib/builder/types";

// POST /api/builder/records — 생기부 phase 1.
// Body: { appIds: string[], slots: RecordSlot[] }. Gathers the teacher's own
// apps, groups submissions by student name, and drafts each "ai" slot from that
// student's activity. Returns { rows: [{ studentName, ai: {slotId: text} }] }.
// Teacher ("판단") slots are left for the result grid. Owner-only.

const MAX_SLOTS = 12;

function sanitizeAiSlots(raw: unknown): RecordSlot[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .filter((s) => s.source === "ai")
    .map((s) => ({
      id: typeof s.id === "string" ? s.id : "",
      label: typeof s.label === "string" ? s.label.trim().slice(0, 40) : "",
      source: "ai" as const,
      instruction:
        typeof s.instruction === "string"
          ? s.instruction.trim().slice(0, 1000)
          : "",
    }))
    .filter((s) => s.id && s.label)
    .slice(0, MAX_SLOTS);
}

export async function POST(req: Request) {
  const user = await verifyRequestUser(req);
  if (!user) return Response.json({ error: "auth_required" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    appIds?: unknown;
    slots?: unknown;
  } | null;

  const appIds = Array.isArray(body?.appIds)
    ? body.appIds.filter((x): x is string => typeof x === "string")
    : [];
  if (appIds.length === 0) {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }
  const aiSlots = sanitizeAiSlots(body?.slots);

  const apps = [];
  for (const id of appIds) {
    const app = await getAppById(id);
    if (!app) continue;
    if (app.ownerUid !== user.uid) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    apps.push(app);
  }
  if (apps.length === 0) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  // Group submissions by student name (MVP identity — a roster hardens this).
  const byStudent = new Map<string, string[]>();
  for (const app of apps) {
    const subs = await listSubmissions(app.id);
    for (const s of subs) {
      const name = s.studentName.trim() || "익명";
      const content = app.fields
        .map((f) => {
          const v = s.answers[f.id];
          return `- ${f.label}: ${v === undefined || v === "" ? "(빈칸)" : String(v)}`;
        })
        .join("\n");
      const arr = byStudent.get(name) ?? [];
      arr.push(`[과제: ${app.title}]\n${content}`);
      byStudent.set(name, arr);
    }
  }

  const students: StudentActivity[] = [...byStudent.entries()]
    .map(([studentName, works]) => ({
      studentName,
      activityText: works.join("\n\n"),
    }))
    .sort((a, b) => a.studentName.localeCompare(b.studentName, "ko"));

  if (students.length === 0) {
    return Response.json({ rows: [] });
  }

  const rows = await fillAiSlots(students, aiSlots);
  if (rows === null) {
    return Response.json({ error: "ai_unavailable" }, { status: 503 });
  }
  return Response.json({ rows });
}
