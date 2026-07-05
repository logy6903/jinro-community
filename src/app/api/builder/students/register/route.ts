import { getAppByCode } from "@/lib/builder/repository";
import { getRosterById } from "@/lib/builder/rosterRepository";
import { createAccount } from "@/lib/builder/studentAuth";

// POST /api/builder/students/register — { code, studentNo, loginId, password }.
// First-time signup: validate class membership, take the name from the roster
// (impersonation-proof), then create the account + claim this class-학번.

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    code?: unknown;
    studentNo?: unknown;
    loginId?: unknown;
    password?: unknown;
  } | null;
  if (
    !body ||
    typeof body.code !== "string" ||
    typeof body.studentNo !== "string" ||
    typeof body.loginId !== "string" ||
    typeof body.password !== "string"
  ) {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }
  if (body.loginId.trim().length < 3) {
    return Response.json({ error: "weak_id" }, { status: 400 });
  }
  if (body.password.length < 4) {
    return Response.json({ error: "weak_password" }, { status: 400 });
  }

  const app = await getAppByCode(body.code);
  if (!app || !app.rosterId) {
    return Response.json({ error: "no_roster" }, { status: 404 });
  }
  const roster = await getRosterById(app.rosterId);
  if (!roster) return Response.json({ error: "no_roster" }, { status: 404 });

  const studentNo = body.studentNo.trim();
  const member = roster.students.find((s) => s.studentNo === studentNo);
  if (!member) return Response.json({ error: "not_in_roster" }, { status: 403 });

  const result = await createAccount(
    body.loginId,
    member.name,
    body.password,
    app.rosterId,
    studentNo,
  );
  if (result === "id_taken") {
    return Response.json({ error: "id_taken" }, { status: 409 });
  }
  if (result === "no_taken") {
    return Response.json({ error: "no_taken" }, { status: 409 });
  }
  if (result !== "ok") {
    return Response.json({ error: "storage_unavailable" }, { status: 503 });
  }
  return Response.json({ name: member.name, studentNo });
}
