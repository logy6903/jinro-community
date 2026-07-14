import type { DecodedIdToken } from "firebase-admin/auth";
import { getAdminAuth } from "../firebase/admin";

// Authorization: Bearer <idToken> 검증 → 디코드된 토큰(uid·email 포함) 또는 null.
export async function decodeBearer(req: Request): Promise<DecodedIdToken | null> {
  const h = req.headers.get("authorization");
  const token = h?.startsWith("Bearer ") ? h.slice(7) : null;
  const auth = getAdminAuth();
  if (!token || !auth) return null;
  try {
    return await auth.verifyIdToken(token);
  } catch {
    return null;
  }
}
