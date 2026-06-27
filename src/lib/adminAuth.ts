import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

export const adminCookieName = "ksigdillas_admin_session";
const sessionDurationSeconds = 60 * 60 * 8;

function getPasscode() {
  return process.env.ADMIN_PASSCODE;
}

function digest(value: string) {
  return createHmac("sha256", "ksigdillas-admin-passcode-v1")
    .update(value)
    .digest();
}

function safeEqual(left: string, right: string) {
  return timingSafeEqual(digest(left), digest(right));
}

function createSessionToken(passcode: string) {
  return createHmac("sha256", passcode)
    .update("ksigdillas-admin-session-v1")
    .digest("hex");
}

export function isAdminConfigured() {
  return Boolean(getPasscode());
}

export function verifyAdminPasscode(candidate: string) {
  const passcode = getPasscode();
  return Boolean(passcode && safeEqual(candidate, passcode));
}

export function isAdminRequest(request: NextRequest) {
  const passcode = getPasscode();
  const token = request.cookies.get(adminCookieName)?.value;
  return Boolean(passcode && token && safeEqual(token, createSessionToken(passcode)));
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
