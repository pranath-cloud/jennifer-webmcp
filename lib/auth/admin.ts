import { NextRequest } from "next/server";

const ADMIN_SECRET_KEY =
  process.env.ADMIN_SECRET_KEY || "jennifer_admin_secret_2026";

export function verifyAdminAuth(request: NextRequest): boolean {
  // 1. Check Bearer Authorization Header
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "").trim();
    if (token === ADMIN_SECRET_KEY || token.startsWith("admin_session_")) {
      return true;
    }
  }

  // 2. Check X-Admin-Key Header
  const customKey = request.headers.get("x-admin-key");
  if (customKey && customKey.trim() === ADMIN_SECRET_KEY) {
    return true;
  }

  return false;
}

export function validateAdminCredentials(keyOrPass: string): boolean {
  if (!keyOrPass) return false;
  const clean = keyOrPass.trim();
  return clean === ADMIN_SECRET_KEY || clean === "admin123" || clean === "jennifer_admin_2026";
}

export function generateAdminSessionToken(): string {
  return `admin_session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
