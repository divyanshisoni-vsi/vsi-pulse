import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendRecoveryEmail } from "@/lib/email";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
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
      const ip = getClientIp(req);

      // 1. IP rate limit: Max 10 requests / 15 minutes to prevent network abuse
      const ipLimit = await checkRateLimit(`otp-ip:${ip}`, 10, 900);
      if (!ipLimit.success) {
        return rateLimitResponse(
          `Too many OTP requests from your network. Please wait ${Math.ceil(ipLimit.retryAfterSeconds / 60)} minutes before trying again.`,
          ipLimit
        );
      }

      // 2. Email cooldown limit: Max 1 code request per 60 seconds (prevents accidental double clicks)
      const cooldownLimit = await checkRateLimit(`otp-cooldown:${normalizedEmail}`, 1, 60);
      if (!cooldownLimit.success) {
        return rateLimitResponse(
          `A verification code was already dispatched recently. Please wait ${cooldownLimit.retryAfterSeconds}s before requesting a new code.`,
          cooldownLimit
        );
      }

      // 3. Email quota limit: Max 3 OTP requests / 15 minutes per email (protects SMTP quota)
      const quotaLimit = await checkRateLimit(`otp-quota:${normalizedEmail}`, 3, 900);
      if (!quotaLimit.success) {
        return rateLimitResponse(
          `Security limit reached: maximum 3 recovery codes per 15 minutes. Please wait ${Math.ceil(quotaLimit.retryAfterSeconds / 60)} minutes.`,
          quotaLimit
        );
      }

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
      // Brute-force protection on code verification: Max 5 failed attempts / 15 minutes
      const verifyLimit = await checkRateLimit(`otp-verify:${normalizedEmail}`, 5, 900);
      if (!verifyLimit.success) {
        // Invalidate token immediately to prevent further attempts
        prisma.$executeRawUnsafe(
          `DELETE FROM password_reset_tokens WHERE email = $1`,
          normalizedEmail
        ).catch(console.error);

        return rateLimitResponse(
          "Too many failed verification attempts. For your security, this verification code has been invalidated. Please request a new code.",
          verifyLimit
        );
      }

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
          {
            error: `Invalid verification code. Please check your email (${verifyLimit.remaining} attempt${verifyLimit.remaining === 1 ? "" : "s"} remaining).`,
          },
          { status: 400 }
        );
      }

      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json(
          { error: "New password must be at least 6 characters long." },
          { status: 400 }
        );
      }

      // Fast hashing with 10 rounds
      const newHash = await bcrypt.hash(newPassword.trim(), 10);

      const updated = await prisma.user.update({
        where: { email: normalizedEmail },
        data: { passwordHash: newHash },
        select: { id: true },
      });

      // Invalidate used code & reset failed attempt counter asynchronously
      prisma.$transaction([
        prisma.$executeRawUnsafe(
          `DELETE FROM password_reset_tokens WHERE email = $1`,
          normalizedEmail
        ),
        prisma.$executeRawUnsafe(
          `DELETE FROM rate_limits WHERE key = $1`,
          `otp-verify:${normalizedEmail}`
        ),
      ]).catch((err) => console.error("Error clearing token:", err));

      // Record audit event asynchronously
      prisma.auditLog
        .create({
          data: {
            actorEmail: normalizedEmail,
            action: "Password Reset Completed",
            entityType: "user",
            entityId: updated.id,
            details: { message: "Account password successfully reset via email recovery code." },
          },
        })
        .catch((e) => console.error("Audit log error:", e));

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
