import { verifyRequestUser } from "@/lib/builder/auth";
import {
  getTeacherProfile,
  sanitizeProfileInput,
  upsertTeacherProfile,
} from "@/lib/builder/teacherProfile";

// GET  /api/builder/profile — the signed-in teacher's own profile (or null).
// POST /api/builder/profile — create/update it (onboarding gate). Identity comes
// from the verified token, never the body.

export async function GET(req: Request) {
  const user = await verifyRequestUser(req);
  if (!user) return Response.json({ error: "auth_required" }, { status: 401 });

  const profile = await getTeacherProfile(user.uid);
  return Response.json({ profile });
}

export async function POST(req: Request) {
  const user = await verifyRequestUser(req);
  if (!user) return Response.json({ error: "auth_required" }, { status: 401 });

  const input = sanitizeProfileInput(await req.json().catch(() => null));
  if (!input) return Response.json({ error: "invalid_input" }, { status: 400 });

  const profile = await upsertTeacherProfile(user.uid, input);
  if (!profile) {
    return Response.json({ error: "storage_unavailable" }, { status: 503 });
  }
  return Response.json({ profile });
}
