import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetInSeconds: number;
  retryAfterSeconds: number;
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "127.0.0.1";
}

/**
 * Checks and increments an atomic rate limit in PostgreSQL.
 * @param key Unique key for this limit (e.g. `forgot-pwd:ip:1.2.3.4` or `otp:user@example.com`)
 * @param limit Maximum allowed requests in the window
 * @param windowSeconds Window length in seconds (e.g. 60 for 1 minute, 900 for 15 minutes)
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  try {
    const rows: Array<{ count: number; reset_at: Date }> =
      await prisma.$queryRawUnsafe(
        `
        INSERT INTO rate_limits (key, count, reset_at)
        VALUES ($1, 1, NOW() + INTERVAL '1 second' * $2)
        ON CONFLICT (key) DO UPDATE
        SET count = CASE
          WHEN rate_limits.reset_at < NOW() THEN 1
          ELSE rate_limits.count + 1
        END,
        reset_at = CASE
          WHEN rate_limits.reset_at < NOW() THEN NOW() + INTERVAL '1 second' * $2
          ELSE rate_limits.reset_at
        END
        RETURNING count, reset_at;
      `,
        key,
        windowSeconds
      );

    const record = rows[0];
    const currentCount = Number(record.count);
    const resetTime = new Date(record.reset_at).getTime();
    const now = Date.now();
    const resetInSeconds = Math.max(1, Math.ceil((resetTime - now) / 1000));
    const success = currentCount <= limit;
    const remaining = Math.max(0, limit - currentCount);

    return {
      success,
      limit,
      remaining,
      resetInSeconds,
      retryAfterSeconds: success ? 0 : resetInSeconds,
    };
  } catch (err) {
    console.error("Rate limiter check error:", err);
    // Fail-open on transient database error so legitimate users aren't locked out
    return {
      success: true,
      limit,
      remaining: 1,
      resetInSeconds: windowSeconds,
      retryAfterSeconds: 0,
    };
  }
}

/**
 * Convenience helper to return a standard 429 Too Many Requests response.
 */
export function rateLimitResponse(
  message: string,
  result: RateLimitResult
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      retryAfterSeconds: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(result.resetInSeconds),
      },
    }
  );
}
