import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendRecoveryEmail } from "@/lib/email";
import bcrypt from "bcryptjs";

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

    // Step 1: Request verification code and send real email
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

      // Generate 6-digit secure numeric code
      const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      const codeHash = await bcrypt.hash(generatedCode, 10);

      // Clean up previous tokens and persist to Postgres in a single atomic transaction
      try {
        await prisma.$transaction([
          prisma.$executeRawUnsafe(
            `DELETE FROM password_reset_tokens WHERE email = $1`,
            normalizedEmail
          ),
          prisma.$executeRawUnsafe(
            `INSERT INTO password_reset_tokens (email, code_hash, expires_at) VALUES ($1, $2, $3)`,
            normalizedEmail,
            codeHash,
            expiresAt
          ),
        ]);
      } catch (dbErr) {
        console.error("DB error saving reset token:", dbErr);
        return NextResponse.json(
          { error: "Failed to initialize password reset. Please try again." },
          { status: 500 }
        );
      }

      // Send real email via Google SMTP (fast delivery)
      let mailResult: any;
      try {
        mailResult = await sendRecoveryEmail({ to: normalizedEmail, code: generatedCode });
      } catch (mailErr: any) {
        console.error("Failed to send email:", mailErr);
        return NextResponse.json(
          { error: mailErr?.message || "Failed to dispatch email. Please check email provider configuration." },
          { status: 500 }
        );
      }

      // Record audit log asynchronously without blocking HTTP response
      prisma.auditLog
        .create({
          data: {
            actorEmail: normalizedEmail,
            action: "Password Reset Code Emailed",
            entityType: "user",
            entityId: user.id,
            details: {
              info: "6-digit recovery code dispatched to inbox",
              expiresIn: "15 minutes",
              messageId: mailResult?.messageId,
            },
          },
        })
        .catch((e) => console.error("Audit log error:", e));

      // NEVER send code in the response!
      return NextResponse.json({
        success: true,
        message: `A 6-digit verification code has been dispatched to ${normalizedEmail}.`,
        provider: mailResult?.provider,
        messageId: mailResult?.messageId,
        buildVersion: "v1.2-smtp-enforced",
      });
    }

    // Step 2: Verify code entered from email and reset password
    if (action === "verify-reset") {
      const tokens: any[] = await prisma.$queryRawUnsafe(
        `SELECT * FROM password_reset_tokens WHERE email = $1 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`,
        normalizedEmail
      );

      if (!tokens || tokens.length === 0) {
        return NextResponse.json(
          { error: "Verification code has expired or was not requested. Please request a new code." },
          { status: 400 }
        );
      }

      const isMatch = await bcrypt.compare((code || "").trim(), tokens[0].code_hash);
      if (!isMatch) {
        return NextResponse.json(
          { error: "Invalid verification code. Please check the code in your email and try again." },
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

      // Invalidate used code
      try {
        await prisma.$executeRawUnsafe(
          `DELETE FROM password_reset_tokens WHERE email = $1`,
          normalizedEmail
        );
      } catch (dbErr) {
        console.error("Error clearing token:", dbErr);
      }

      // Record audit event
      try {
        await prisma.auditLog.create({
          data: {
            actorEmail: normalizedEmail,
            action: "Password Reset Completed",
            entityType: "user",
            entityId: updated.id,
            details: { message: "Account password successfully reset via email recovery code." },
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
