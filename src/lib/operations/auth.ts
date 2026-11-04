import type { NextRequest } from "next/server";
import {
  digest,
  opaqueToken,
  passwordMatches,
  passwordMatchesAsync,
} from "./crypto";
import type { Role, State } from "./model";
import { loginInput } from "./validation";
import { audit, requireRole } from "./service";
import type { Store } from "./store";
export const staffCookie = "ksigdillas_staff";
export function enforceOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(process.env.APP_URL ?? request.url).origin)
    throw new Error("Request origin was rejected.");
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new Error("Cross-site request rejected.");
}
export function takeLimit(
  s: State,
  key: string,
  limit: number,
  now: Date,
  seconds = 60,
) {
  const found = s.attempts.find((a) => a.id === key);
  if (!found) {
    s.attempts.push({
      id: key,
      count: 1,
      resetsAt: new Date(now.getTime() + seconds * 1000).toISOString(),
    });
    return true;
  }
  if (Date.parse(found.resetsAt) <= now.getTime()) {
    found.count = 0;
    found.resetsAt = new Date(now.getTime() + seconds * 1000).toISOString();
  }
  found.count += 1;
  return found.count <= limit;
}
export function sessionUser(s: State, token: string | undefined, now: Date) {
  if (!token || token.length > 200) return null;
  const session = s.sessions.find(
    (x) =>
      x.id === digest(token) &&
      !x.revoked &&
      Date.parse(x.expiresAt) > now.getTime(),
  );
  return session
    ? (s.staff.find((u) => u.id === session.staffId && u.active) ?? null)
    : null;
}
export function login(s: State, raw: unknown, now: Date) {
  const input = loginInput.parse(raw);
  const allowed = takeLimit(
    s,
    `login:${digest(input.id.toLowerCase())}`,
    8,
    now,
    900,
  );
  if (!allowed) return null;
  // Uniform expensive comparison even for unknown usernames.
  const user = s.staff.find((u) => u.id === input.id.toLowerCase() && u.active);
  const valid = passwordMatches(
    input.password,
    user?.passwordHash ??
      "01234567890123456789012345678901:00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
  );
  if (!valid || !user) return null;
  return issueSession(s, user, now);
}
function issueSession(s: State, user: State["staff"][number], now: Date) {
  const token = opaqueToken();
  const expiresAt = new Date(now.getTime() + 8 * 3600000).toISOString();
  s.sessions.push({
    id: digest(token),
    staffId: user.id,
    expiresAt,
    revoked: false,
  });
  audit(s, user.id, "login", user.id, "Staff sign-in", now);
  return {
    token,
    expiresAt,
    user: { id: user.id, name: user.name, role: user.role },
  };
}
// Expensive password hashing runs outside the serialized database mutation.
export async function loginToStore(
  store: Store,
  raw: unknown,
  network: string,
  now: Date,
) {
  const input = loginInput.parse(raw);
  const reserved = await store.transaction((s) => {
    const allowed =
      takeLimit(s, "login-global", 60, now) &&
      takeLimit(s, `login-ip:${digest(network)}`, 12, now) &&
      takeLimit(s, `login:${digest(input.id.toLowerCase())}`, 8, now, 900);
    if (!allowed) return null;
    const user = s.staff.find(
      (u) => u.id === input.id.toLowerCase() && u.active,
    );
    return {
      id: user?.id,
      hash:
        user?.passwordHash ??
        "01234567890123456789012345678901:" + "00".repeat(64),
    };
  });
  if (!reserved) return null;
  const valid = await passwordMatchesAsync(input.password, reserved.hash);
  if (!valid || !reserved.id) return null;
  return store.transaction((s) => {
    const user = s.staff.find(
      (u) =>
        u.id === reserved.id && u.active && u.passwordHash === reserved.hash,
    );
    return user ? issueSession(s, user, now) : null;
  });
}
export function authorize(
  s: State,
  token: string | undefined,
  permission: "scan" | "score" | "organize",
  now: Date,
) {
  const user = sessionUser(s, token, now);
  if (!user) throw new Error("Please sign in to the staff desk.");
  requireRole(user.role as Role, permission);
  return user;
}
