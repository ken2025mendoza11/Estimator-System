import { createHash } from "node:crypto";
import { SignJWT } from "jose";
import { getSessionUser } from "@/lib/auth/verify.server";

/** Fixed UUID v5 namespace for this app. Do not change it — user keys must stay stable. */
const USER_NAMESPACE = "c1e0a7e0-7b1a-4e3a-9c2d-5f6a7b8c9d0e";
const TOKEN_SECONDS = 10 * 60;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Same better-auth user id always becomes the same Supabase `auth.uid()`. */
export function stableUserUuid(userId: string): string {
  const trimmed = userId.trim();
  if (UUID_RE.test(trimmed)) return trimmed.toLowerCase();
  const namespace = Buffer.from(USER_NAMESPACE.replace(/-/g, ""), "hex");
  const hash = createHash("sha1").update(namespace).update(trimmed, "utf8").digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function issueSupabaseAccess(
  bearerToken: string | undefined,
  fallbackUserId: string,
): Promise<{
  accessToken: string;
  expiresAt: number;
  userKey: string;
  email: string | null;
}> {
  const secret = process.env.SUPABASE_JWT_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "The server is missing SUPABASE_JWT_SECRET. Add it in the host environment only. Never put it in the browser or in a VITE_ variable.",
    );
  }
  const sessionUser = await getSessionUser(bearerToken);
  const userId = sessionUser?.id || fallbackUserId;
  const email =
    sessionUser?.email ?? (userId === "dev-user" ? "dev@example.com" : null);
  const userKey = stableUserUuid(userId);
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_SECONDS;
  const issuer = process.env.VITE_SUPABASE_URL?.trim() || "supabase";
  const accessToken = await new SignJWT({
    role: "authenticated",
    aud: "authenticated",
    email,
    app_metadata: { provider: "better-auth", providers: ["better-auth"] },
    user_metadata: { email },
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(issuer)
    .setSubject(userKey)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(new TextEncoder().encode(secret));
  return { accessToken, expiresAt, userKey, email };
}
