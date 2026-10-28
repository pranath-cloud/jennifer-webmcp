import { NextRequest } from "next/server";

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

// In-memory store with auto-cleanup
const rateLimitStore = new Map<string, RateLimitRecord>();
const MAX_STORE_SIZE = 10000;

// Periodic cleanup of expired keys every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (now > record.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitConfig {
  limit?: number;        // Max allowed requests in the window (default: 10)
  windowMs?: number;     // Window duration in ms (default: 24 hours = 86400000ms)
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  clientIdentifier: string;
  headers: Record<string, string>;
}

export function extractClientIp(request: NextRequest): string {
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp && cfConnectingIp.trim().length > 0) return cfConnectingIp.trim();

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const primaryIp = forwardedFor.split(",")[0].trim();
    if (primaryIp) return primaryIp;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp && realIp.trim().length > 0) return realIp.trim();

  return "anonymous_ip";
}

export function getClientIdentifier(request: NextRequest, customSessionId?: string): string {
  if (customSessionId && customSessionId.trim().length > 0) {
    return `session_${customSessionId.trim()}`;
  }

  const sessionHeader = request.headers.get("x-client-session");
  if (sessionHeader && sessionHeader.trim().length > 0) {
    return `session_${sessionHeader.trim()}`;
  }

  const cookieHeader = request.headers.get("cookie") || "";
  const cookieMatch = cookieHeader.match(/jmcp_client_id=([^;]+)/);
  if (cookieMatch && cookieMatch[1]) {
    return `cookie_${cookieMatch[1].trim()}`;
  }

  const ip = extractClientIp(request);
  return `ip_${ip}`;
}

/**
 * Checks and updates rate limit with Dual-Layer Security (Session + IP Hard Cap)
 * Enforces strict 10-query maximum per 24 hours per client/IP to stop bot abuse & cost drain.
 */
export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig = {},
  customSessionId?: string
): RateLimitResult {
  const limit = config.limit ?? 10; // 10 searches / queries max
  const windowMs = config.windowMs ?? 24 * 60 * 60 * 1000; // 24-hour window
  const now = Date.now();

  const sessionKey = getClientIdentifier(request, customSessionId);
  const ipKey = `ip_${extractClientIp(request)}`;

  if (rateLimitStore.size > MAX_STORE_SIZE) {
    const oldestKey = rateLimitStore.keys().next().value;
    if (oldestKey) rateLimitStore.delete(oldestKey);
  }

  // Check and increment session record
  let sessionRecord = rateLimitStore.get(sessionKey);
  if (!sessionRecord || now > sessionRecord.resetTime) {
    sessionRecord = { count: 1, resetTime: now + windowMs };
    rateLimitStore.set(sessionKey, sessionRecord);
  } else {
    sessionRecord.count += 1;
  }

  // Check and increment IP record
  let ipRecord = rateLimitStore.get(ipKey);
  if (!ipRecord || now > ipRecord.resetTime) {
    ipRecord = { count: 1, resetTime: now + windowMs };
    rateLimitStore.set(ipKey, ipRecord);
  } else if (ipKey !== sessionKey) {
    ipRecord.count += 1;
  }

  const maxCount = Math.max(sessionRecord.count, ipRecord.count);
  const allowed = maxCount <= limit;
  const remaining = Math.max(0, limit - maxCount);
  const resetSeconds = Math.ceil((Math.max(sessionRecord.resetTime, ipRecord.resetTime) - now) / 1000);

  const headers: Record<string, string> = {
    "X-RateLimit-Limit": limit.toString(),
    "X-RateLimit-Remaining": remaining.toString(),
    "X-RateLimit-Reset": resetSeconds.toString(),
  };

  return {
    allowed,
    limit,
    remaining,
    resetTime: Math.max(sessionRecord.resetTime, ipRecord.resetTime),
    clientIdentifier: sessionKey,
    headers,
  };
}
