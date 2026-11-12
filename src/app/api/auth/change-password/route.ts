import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in first." },
        { status: 401 }
      );
    }

    const email = session.user.email.toLowerCase().trim();

    // Rate limit: Max 5 password change attempts per 15 minutes per user
    const limit = await checkRateLimit(`change-pwd:${email}`, 5, 900);
    if (!limit.success) {
      return rateLimitResponse(
        `Too many password change attempts. For security, please wait ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`,
        limit
      );
    }

    const body = await req.json();
    const { currentPassword, newPassword } = body;

    if (typeof currentPassword !== "string" || typeof newPassword !== "string" || !currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Both current password and new password are required." },
        { status: 400 }
      );
    }

    if (newPassword.trim().length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 non-space characters long." },
        { status: 400 }
      );
    }

    if (newPassword === currentPassword) {
      return NextResponse.json(
        { error: "New password must be different from your current password." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User account not found." },
        { status: 404 }
      );
    }

    // Fast verify current password
    const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      return NextResponse.json(
        {
          error: `Current password does not match our records (${limit.remaining} attempt${limit.remaining === 1 ? "" : "s"} remaining).`,
        },
        { status: 400 }
      );
    }

    // High performance hashing (10 rounds = ~60ms vs 12 rounds = ~400ms)
    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { email },
      data: { passwordHash: newHash },
    });

    // Reset rate limit key and record audit log before returning (serverless-safe)
    await Promise.allSettled([
      prisma.$executeRawUnsafe(
        `DELETE FROM rate_limits WHERE key = $1`,
        `change-pwd:${email}`
      ),
      prisma.auditLog.create({
        data: {
          actorEmail: email,
          action: "Password Changed",
          entityType: "user",
          entityId: user.id,
          details: { message: "User successfully updated account password." },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (err: any) {
    console.error("POST /api/auth/change-password error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
