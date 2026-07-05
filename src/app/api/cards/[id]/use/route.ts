import { recordUsageForUser } from "@/lib/content/repository";
import { getAdminAuth } from "@/lib/firebase/admin";

// POST /api/cards/:id/use — records one teacher's "우리 반에서 써봤어요".
// Requires a Firebase ID token (Authorization: Bearer <token>) so the signal
// is per-teacher and deduped. Returns { usedCount, alreadyUsed }.

export async function POST(
  req: Request,
  ctx: RouteContext<"/api/cards/[id]/use">,
) {
  const { id } = await ctx.params;

  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const adminAuth = getAdminAuth();
  if (!token || !adminAuth) {
    return Response.json({ error: "auth_required" }, { status: 401 });
  }

  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(token)).uid;
  } catch {
    return Response.json({ error: "invalid_token" }, { status: 401 });
  }

  const result = await recordUsageForUser(id, uid);
  return Response.json(result ?? { usedCount: null, alreadyUsed: false });
}
