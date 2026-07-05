import { getAppById, listSubmissions } from "@/lib/builder/repository";
import { verifyRequestUser } from "@/lib/builder/auth";

// GET /api/builder/apps/:id — one app plus its submissions, for the teacher
// dashboard. Owner-only: a teacher can only read submissions to their own app.

export async function GET(
  req: Request,
  ctx: RouteContext<"/api/builder/apps/[id]">,
) {
  const user = await verifyRequestUser(req);
  if (!user) return Response.json({ error: "auth_required" }, { status: 401 });

  const { id } = await ctx.params;
  const app = await getAppById(id);
  if (!app) return Response.json({ error: "not_found" }, { status: 404 });
  if (app.ownerUid !== user.uid) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const submissions = await listSubmissions(id);
  return Response.json({ app, submissions });
}
