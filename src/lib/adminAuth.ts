import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

export const adminCookieName = "ksigdillas_admin_session";
const sessionDurationSeconds = 60 * 60 * 8;
const passcodeComparisonSalt = "ksigdillas-admin-passcode-v1";

function getPasscode() {
  return process.env.ADMIN_PASSCODE;
}

function derivePasscode(value: string) {
  return scryptSync(value, passcodeComparisonSalt, 32);
}

function passcodesMatch(candidate: string, configured: string) {
  return timingSafeEqual(
    derivePasscode(candidate),
    derivePasscode(configured),
  );
}

function sessionTokensMatch(candidate: string, expected: string) {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  return (
    candidateBuffer.length === expectedBuffer.length &&
    timingSafeEqual(candidateBuffer, expectedBuffer)
  );
}

function createSessionToken(passcode: string) {
  return createHmac("sha256", passcode)
    .update("ksigdillas-admin-session-v1")
    .digest("hex");
}

export function isAdminConfigured() {
  return process.env.NODE_ENV !== "production" && process.env.EVENT_OPERATIONS_ENABLED !== "true" && Boolean(getPasscode());
}

export function verifyAdminPasscode(candidate: string) {
  const passcode = getPasscode();
  return Boolean(passcode && passcodesMatch(candidate, passcode));
}

export function isAdminRequest(request: NextRequest) {
  if (process.env.EVENT_OPERATIONS_ENABLED === "true" || process.env.NODE_ENV === "production") return false;
  if (request.method !== "GET" && request.headers.get("origin") !== new URL(request.url).origin) return false;
  const passcode = getPasscode();
  const token = request.cookies.get(adminCookieName)?.value;
  return Boolean(
    passcode &&
      token &&
      sessionTokensMatch(token, createSessionToken(passcode)),
  );
}

export function setAdminSession(response: NextResponse) {
  const passcode = getPasscode();
  if (!passcode) {
    throw new Error("Admin access is not configured.");
  }

  response.cookies.set(adminCookieName, createSessionToken(passcode), {
    httpOnly: true,
    maxAge: sessionDurationSeconds,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
}

export function clearAdminSession(response: NextResponse) {
  response.cookies.set(adminCookieName, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
}
