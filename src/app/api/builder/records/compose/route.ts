import { verifyRequestUser } from "@/lib/builder/auth";
import { weaveRecords, type WeaveInput } from "@/lib/builder/records";

// POST /api/builder/records/compose — 생기부 phase 2.
// Body: { students: [{ studentName, parts: [{label, value}] }], instruction? }.
// Weaves each student's slot values (ai-drafted + teacher-entered) into one
// 생기부 paragraph. The data comes from the teacher's own edited grid, so this
// only requires auth (no Firestore read); inputs are capped defensively.

const MAX_STUDENTS = 400;
const MAX_PARTS = 12;
const VALUE_MAX = 4000;

function sanitize(raw: unknown): WeaveInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => {
      const studentName =
        typeof s.studentName === "string"
          ? s.studentName.trim().slice(0, 60) || "익명"
          : "익명";
      const parts = Array.isArray(s.parts)
        ? s.parts
            .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
            .map((p) => ({
              label: typeof p.label === "string" ? p.label.slice(0, 40) : "",
              value:
                typeof p.value === "string" ? p.value.slice(0, VALUE_MAX) : "",
            }))
            .slice(0, MAX_PARTS)
        : [];
      return { studentName, parts };
    })
    .slice(0, MAX_STUDENTS);
}

export async function POST(req: Request) {
  const user = await verifyRequestUser(req);
  if (!user) return Response.json({ error: "auth_required" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    students?: unknown;
    instruction?: unknown;
  } | null;

  const students = sanitize(body?.students);
  if (students.length === 0) {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }
  const instruction =
    typeof body?.instruction === "string" ? body.instruction : undefined;

  const records = await weaveRecords(students, instruction);
  if (records === null) {
    return Response.json({ error: "ai_unavailable" }, { status: 503 });
  }
  return Response.json({ records });
}
