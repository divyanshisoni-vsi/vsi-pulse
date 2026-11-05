import nodemailer from "nodemailer";

export async function sendRecoveryEmail({
  to,
  code,
}: {
  to: string;
  code: string;
}) {
  const subject = "VSI Pulse: Your 6-Digit Password Recovery Code";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${subject}</title>
      </head>
      <body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px; background-color: #0f172a; text-align: center;">
              <div style="font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #94a3b8; text-transform: uppercase;">VIRTUAL SOLUTIONS INDIA</div>
              <div style="font-size: 24px; font-weight: 800; color: #ffffff; margin-top: 4px; letter-spacing: -0.5px;">
                VSI <span style="color: #60a5fa;">Pulse</span>
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 32px 24px;">
              <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0;">Account Password Recovery</h2>
              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
                A password reset request was initiated for your official VSI account (<strong>${to}</strong>). Enter the verification code below on the recovery page to set your new password:
              </p>

              <!-- 6-Digit Code Box -->
              <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; text-align: center; margin: 0 0 24px 0;">
                <div style="font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: #1e40af; text-transform: uppercase; margin-bottom: 6px;">
                  Your Verification Code
                </div>
                <div style="font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #0f172a; font-family: monospace;">
                  ${code}
                </div>
                <div style="font-size: 12px; color: #3b82f6; margin-top: 6px;">
                  Valid for 15 minutes only
                </div>
              </div>

              <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin: 0 0 16px 0;">
                If you did not request a password recovery, please ignore this email or alert your system administrator immediately.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
              This is an automated system notification from VSI Pulse Security.<br/>
              &copy; ${new Date().getFullYear()} Virtual Solutions India. All rights reserved.
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  // Google Workspace SMTP (info@virtualsolutionsindia.com)
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error(
      "Missing Google SMTP settings on server! Please add SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in your Vercel Project Environment Variables."
    );
  }

  const port = Number(process.env.SMTP_PORT) || 587;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_USER;
  const info = await transporter.sendMail({
    from: `"VSI Pulse Security" <${fromEmail}>`,
    to,
    subject,
    html,
  });

  console.log(`[Google SMTP] Email dispatched to ${to}. MessageId: ${info.messageId}`);
  return { success: true, provider: "smtp", messageId: info.messageId };
}
