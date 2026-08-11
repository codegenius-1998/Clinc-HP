import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { d1Query } from "./d1";

export type UserRole = "admin" | "clinic_owner";

export type SessionUser = {
  userId: string;
  email: string;
  role: UserRole;
};

const SESSION_COOKIE = "session_token";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  const candidate = scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, "hex");
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  password_salt: string;
  role: UserRole;
};

/** Creates a new user account. Throws if the email is already registered. */
export async function createUser(email: string, password: string, role: UserRole): Promise<void> {
  const existing = await d1Query<UserRow>("SELECT id FROM users WHERE email = ?", [email]);
  if (existing.results.length > 0) {
    throw new Error("このメールアドレスは既に登録されています。");
  }
  const { hash, salt } = hashPassword(password);
  await d1Query(
    "INSERT INTO users (id, email, password_hash, password_salt, role) VALUES (?, ?, ?, ?, ?)",
    [randomUUID(), email, hash, salt, role]
  );
}

/** Verifies email/password against the given role and creates a session. Throws on any mismatch. */
export async function login(email: string, password: string, role: UserRole): Promise<void> {
  const result = await d1Query<UserRow>("SELECT * FROM users WHERE email = ? AND role = ?", [email, role]);
  const user = result.results[0];
  if (!user || !verifyPassword(password, user.password_hash, user.password_salt)) {
    throw new Error("メールアドレスまたはパスワードが正しくありません。");
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await d1Query("INSERT INTO sessions (token, user_id, role, expires_at) VALUES (?, ?, ?, ?)", [
    token,
    user.id,
    user.role,
    expiresAt,
  ]);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

/** Reads the current request's session cookie and returns the logged-in user, or null if absent/expired. */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const result = await d1Query<{ user_id: string; role: UserRole; email: string; expires_at: string }>(
    `SELECT sessions.user_id AS user_id, sessions.role AS role, sessions.expires_at AS expires_at, users.email AS email
     FROM sessions JOIN users ON users.id = sessions.user_id
     WHERE sessions.token = ?`,
    [token]
  );
  const session = result.results[0];
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await d1Query("DELETE FROM sessions WHERE token = ?", [token]);
    return null;
  }

  return { userId: session.user_id, email: session.email, role: session.role };
}

/** Deletes the current session (server-side + cookie). Safe to call even if not logged in. */
export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await d1Query("DELETE FROM sessions WHERE token = ?", [token]);
  }
  cookieStore.delete(SESSION_COOKIE);
}

/** Throws unless the current request is authenticated as an admin. Call at the top of every admin
 * Server Action — pages alone can't gate mutations, since actions are directly POST-able. */
export async function requireAdmin(): Promise<SessionUser> {
  const session = await getSession();
  if (session?.role !== "admin") {
    throw new Error("権限がありません。");
  }
  return session;
}

export type UserSummary = { id: string; email: string; role: UserRole; created_at: string };

export async function listUsers(): Promise<UserSummary[]> {
  return (await d1Query<UserSummary>("SELECT id, email, role, created_at FROM users ORDER BY created_at DESC")).results;
}

export async function deleteUser(id: string): Promise<void> {
  await d1Query("DELETE FROM users WHERE id = ?", [id]);
}
