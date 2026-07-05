import { getAppByCode } from "@/lib/builder/repository";
import { getRosterById } from "@/lib/builder/rosterRepository";
import {
  enrollAccount,
  getAccount,
  verifyPassword,
} from "@/lib/builder/studentAuth";

// POST /api/builder/students/enroll — { code, loginId, password, studentNo }.
// Grade change / new class: attach this year's class-학번 to an existing account.

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    code?: unknown;
    loginId?: unknown;
    password?: unknown;
    studentNo?: unknown;
  } | null;
  if (
    !body ||
    typeof body.code !== "string" ||
    typeof body.loginId !== "string" ||
    typeof body.password !== "string" ||
    typeof body.studentNo !== "string"
  ) {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }

  const app = await getAppByCode(body.code);
  if (!app || !app.rosterId) {
    return Response.json({ error: "no_roster" }, { status: 404 });
  }
  const roster = await getRosterById(app.rosterId);
  if (!roster) return Response.json({ error: "no_roster" }, { status: 404 });

  const account = await getAccount(body.loginId);
  if (!account || !verifyPassword(body.password, account.password)) {
    return Response.json({ error: "bad_login" }, { status: 401 });
  }

  const studentNo = body.studentNo.trim();
  const member = roster.students.find((s) => s.studentNo === studentNo);
  if (!member) return Response.json({ error: "not_in_roster" }, { status: 403 });

  const result = await enrollAccount(body.loginId, app.rosterId, studentNo);
  if (result === "no_taken") {
    return Response.json({ error: "no_taken" }, { status: 409 });
  }
  if (result !== "ok") {
    return Response.json({ error: "storage_unavailable" }, { status: 503 });
  }
  return Response.json({ name: account.name, studentNo });
}
