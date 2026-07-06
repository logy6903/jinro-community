import {
  createScheduleItem,
  deleteScheduleItem,
  listTeacherScheduleItems,
  sanitizeScheduleInput,
} from "@/lib/schedule/repository";
import { getAdminAuth } from "@/lib/firebase/admin";

// Teacher schedule items. GET returns the caller's own items; POST/DELETE mutate
// them. Public users see only the common layer (computed client-side), so an
// unauthenticated GET simply returns nothing.

async function uidFrom(req: Request): Promise<string | null> {
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const auth = getAdminAuth();
  if (!token || !auth) return null;
  try {
    return (await auth.verifyIdToken(token)).uid;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const uid = await uidFrom(req);
  if (!uid) return Response.json({ items: [] });
  return Response.json({ items: await listTeacherScheduleItems(uid) });
}

export async function POST(req: Request) {
  const uid = await uidFrom(req);
  if (!uid) return Response.json({ error: "auth_required" }, { status: 401 });
  const input = sanitizeScheduleInput(await req.json().catch(() => null));
  if (!input) return Response.json({ error: "invalid_input" }, { status: 400 });
  const id = await createScheduleItem(input, uid);
  if (!id) return Response.json({ error: "storage_unavailable" }, { status: 503 });
  return Response.json({ id });
}

export async function DELETE(req: Request) {
  const uid = await uidFrom(req);
  if (!uid) return Response.json({ error: "auth_required" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "missing_id" }, { status: 400 });
  return Response.json({ ok: await deleteScheduleItem(id, uid) });
}
