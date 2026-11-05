import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// Global in-memory store for verification codes (15-minute expiration)
const resetCodeStore = new Map<string, { code: string; expiresAt: number }>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, email, code, newPassword } = body;

    const normalizedEmail = (email || "").toLowerCase().trim();

    if (!normalizedEmail) {
      return NextResponse.json(
        { error: "Email address is required." },
        { status: 400 }
      );
    }

    if (!normalizedEmail.endsWith("@virtualsolutionsindia.com")) {
      return NextResponse.json(
        { error: "Access restricted: Only official @virtualsolutionsindia.com emails are eligible." },
        { status: 400 }
      );
    }

    // Step 1: Request verification code
    if (action === "request-code") {
      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (!user) {
        return NextResponse.json(
          { error: "No user account found with this official email address." },
          { status: 404 }
        );
      }

      if (user.status !== "active") {
        return NextResponse.json(
          { error: "This user account is currently marked as inactive." },
          { status: 403 }
        );
      }

      // Generate 6-digit OTP code
      const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

      resetCodeStore.set(normalizedEmail, { code: generatedCode, expiresAt });

      // Record audit log for security visibility
      try {
        await prisma.auditLog.create({
          data: {
            actorEmail: normalizedEmail,
            action: "Password Reset Requested",
            entityType: "user",
            entityId: user.id,
            details: {
              info: "Recovery verification code requested",
              expiresIn: "15 minutes",
            },
          },
        });
      } catch (e) {
        console.error("Audit log error:", e);
      }

      return NextResponse.json({
        success: true,
        message: "Security verification code generated.",
        code: generatedCode, // Displayed on screen for instant verification
      });
    }

    // Step 2: Verify code and set new password
    if (action === "verify-reset") {
      const stored = resetCodeStore.get(normalizedEmail);

      if (!stored || Date.now() > stored.expiresAt) {
        return NextResponse.json(
          { error: "Verification code has expired or was not requested. Please request a new code." },
          { status: 400 }
        );
      }

      if (stored.code !== (code || "").trim()) {
        return NextResponse.json(
          { error: "Invalid verification code. Please check and try again." },
          { status: 400 }
        );
      }

      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json(
          { error: "New password must be at least 6 characters long." },
          { status: 400 }
        );
      }

      const newHash = await bcrypt.hash(newPassword.trim(), 12);

      const updated = await prisma.user.update({
        where: { email: normalizedEmail },
        data: { passwordHash: newHash },
      });

      // Clear used code
      resetCodeStore.delete(normalizedEmail);

      // Record audit event
      try {
        await prisma.auditLog.create({
          data: {
            actorEmail: normalizedEmail,
            action: "Password Reset Completed",
            entityType: "user",
            entityId: updated.id,
            details: { message: "Account password successfully reset via verification code." },
          },
        });
      } catch (e) {
        console.error("Audit log error:", e);
      }

      return NextResponse.json({
        success: true,
        message: "Your password has been successfully reset! You can now log in.",
      });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (err: any) {
    console.error("POST /api/auth/forgot-password error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error." },
      { status: 500 }
    );
  }
}
