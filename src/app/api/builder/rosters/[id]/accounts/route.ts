import {
  getRosterById,
  sanitizeRosterInput,
  updateRoster,
} from "@/lib/builder/rosterRepository";
import { verifyRequestUser } from "@/lib/builder/auth";
import {
  listRosterAccounts,
  renameAccount,
  resetAccountPassword,
  unenrollStudent,
} from "@/lib/builder/studentAuth";

// Teacher-only management of the student accounts tied to a roster.
//   GET  — per-student account link status (registered 아이디, or null).
//   POST — { action, studentNo, ... }: reset_password | rename | unenroll.
// Owner is always verified against the roster; the student endpoints elsewhere
// never touch these — only the teacher who owns the 명렬 can.

async function requireOwner(req: Request, id: string) {
  const user = await verifyRequestUser(req);
  if (!user) return { error: Response.json({ error: "auth_required" }, { status: 401 }) };
  const roster = await getRosterById(id);
  if (!roster) return { error: Response.json({ error: "not_found" }, { status: 404 }) };
  if (roster.ownerUid !== user.uid) {
    return { error: Response.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { roster };
}

export async function GET(
  req: Request,
  ctx: RouteContext<"/api/builder/rosters/[id]/accounts">,
) {
  const { id } = await ctx.params;
  const { error, roster } = await requireOwner(req, id);
  if (error) return error;

  const accounts = await listRosterAccounts(id, roster.students);
  return Response.json({ accounts });
}

export async function POST(
  req: Request,
  ctx: RouteContext<"/api/builder/rosters/[id]/accounts">,
) {
  const { id } = await ctx.params;
  const { error, roster } = await requireOwner(req, id);
  if (error) return error;

  const body = (await req.json().catch(() => null)) as {
    action?: unknown;
    studentNo?: unknown;
    name?: unknown;
    password?: unknown;
  } | null;
  if (!body || typeof body.action !== "string" || typeof body.studentNo !== "string") {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }
  const studentNo = body.studentNo.trim();
  const student = roster.students.find((s) => s.studentNo === studentNo);
  if (!student) return Response.json({ error: "not_in_roster" }, { status: 404 });

  const links = await listRosterAccounts(id, roster.students);
  const loginId = links.find((l) => l.studentNo === studentNo)?.loginId ?? null;

  if (body.action === "reset_password") {
    if (!loginId) return Response.json({ error: "not_registered" }, { status: 409 });
    if (typeof body.password !== "string" || body.password.length < 4) {
      return Response.json({ error: "weak_password" }, { status: 400 });
    }
    const ok = await resetAccountPassword(loginId, body.password);
    return ok
      ? Response.json({ ok: true })
      : Response.json({ error: "storage_unavailable" }, { status: 503 });
  }

  if (body.action === "rename") {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return Response.json({ error: "invalid_input" }, { status: 400 });
    }
    const name = body.name.trim().slice(0, 40);
    // Roster is the source of truth for names — update it, then the account.
    const input = sanitizeRosterInput({
      name: roster.name,
      school: roster.school,
      students: roster.students.map((s) =>
        s.studentNo === studentNo ? { ...s, name } : s,
      ),
    });
    if (!input) return Response.json({ error: "invalid_input" }, { status: 400 });
    const ok = await updateRoster(id, input);
    if (!ok) return Response.json({ error: "storage_unavailable" }, { status: 503 });
    if (loginId) await renameAccount(loginId, name);
    return Response.json({ ok: true, name });
  }

  if (body.action === "unenroll") {
    if (!loginId) return Response.json({ error: "not_registered" }, { status: 409 });
    const ok = await unenrollStudent(id, studentNo);
    return ok
      ? Response.json({ ok: true })
      : Response.json({ error: "storage_unavailable" }, { status: 503 });
  }

  return Response.json({ error: "invalid_input" }, { status: 400 });
}
