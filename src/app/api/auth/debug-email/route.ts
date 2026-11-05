import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    hasSmtpHost: Boolean(process.env.SMTP_HOST),
    smtpHost: process.env.SMTP_HOST || null,
    hasSmtpUser: Boolean(process.env.SMTP_USER),
    hasSmtpPass: Boolean(process.env.SMTP_PASS),
    hasResendKey: Boolean(process.env.RESEND_API_KEY),
    emailFrom: process.env.EMAIL_FROM || null,
    nodeEnv: process.env.NODE_ENV,
  });
}
