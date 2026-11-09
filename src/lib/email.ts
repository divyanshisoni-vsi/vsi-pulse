import nodemailer from "nodemailer";

// Cached pooled transporter across serverless invocations for fast warm delivery
let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error(
      "Missing Google SMTP settings on server! Please add SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in your Vercel Project Environment Variables."
    );
  }

  // Use port 465 for direct TLS (faster than STARTTLS handshake on 587)
  const port = Number(process.env.SMTP_PORT) || 465;
  const secure = port === 465;

  cachedTransporter = nodemailer.createTransport({
    pool: true,
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    maxConnections: 3,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5,
  });

  return cachedTransporter;
}

export async function sendRecoveryEmail({
  to,
  code,
}: {
  to: string;
  code: string;
}) {
  const subject = "VSI Pulse: Your 6-Digit Password Recovery Code";

  const plainText = `VSI Pulse Account Password Recovery\n\n` +
    `A password reset request was initiated for your official VSI account (${to}).\n\n` +
    `Your 6-Digit Verification Code: ${code}\n\n` +
    `This code is valid for 15 minutes only.\n` +
    `If you did not request this recovery, please ignore this message.\n\n` +
    `---\nVirtual Solutions India - VSI Pulse Security`;

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

  const transporter = getTransporter();
  const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_USER;

  const info = await transporter.sendMail({
    from: `"VSI Pulse Security" <${fromEmail}>`,
    to,
    subject,
    text: plainText,
    html,
    priority: "high",
    headers: {
      "X-Priority": "1",
      "Importance": "high",
      "X-MSMail-Priority": "High",
    },
  });

  console.log(`[Google SMTP Fast Delivery] Dispatched to ${to}. ID: ${info.messageId}`);
  return { success: true, provider: "smtp", messageId: info.messageId };
}

export async function sendWelcomeEmail({
  to,
  name,
  password,
  role,
  team,
}: {
  to: string;
  name: string;
  password: string;
  role?: string;
  team?: string;
}) {
  const subject = "Welcome to VSI Pulse — Your Account Credentials";
  const loginUrl =
    process.env.NEXTAUTH_URL
      ? `${process.env.NEXTAUTH_URL}/login`
      : "https://vsi-pulse.vercel.app/login";

  const plainText =
    `Welcome to VSI Pulse\n\n` +
    `Hello ${name},\n\n` +
    `Your official account on VSI Pulse (Virtual Solutions India) has been created.\n\n` +
    `Your Login Credentials:\n` +
    `• Portal URL: ${loginUrl}\n` +
    `• Registered Email: ${to}\n` +
    `• Initial Password: ${password}\n` +
    `• Department: ${team || "Operations"}\n` +
    `• Designation: ${role || "Team Member"}\n\n` +
    `Next Steps:\n` +
    `1. Visit ${loginUrl} and sign in with your email and initial password.\n` +
    `2. Change your password immediately by clicking the 'Password' button in the top header.\n` +
    `3. You can now log your daily activities and track your monthly targets.\n\n` +
    `---\nVirtual Solutions India - VSI Pulse Operations`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${subject}</title>
      </head>
      <body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
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
              <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0;">Welcome to VSI Pulse, ${name}!</h2>
              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
                Your official employee account has been created on <strong>VSI Pulse</strong>, our internal platform for performance tracking, daily activity reporting, and attendance management.
              </p>

              <!-- Credentials Box -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #2563eb; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
                <div style="font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: #2563eb; text-transform: uppercase; margin-bottom: 12px;">
                  Your Login Credentials
                </div>

                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px;">
                  <tr>
                    <td style="padding: 6px 0; color: #64748b; width: 140px; font-weight: 600;">Registered Email:</td>
                    <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${to}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Initial Password:</td>
                    <td style="padding: 6px 0;">
                      <code style="background-color: #e2e8f0; color: #0f172a; padding: 3px 8px; border-radius: 4px; font-size: 14px; font-weight: 800; font-family: monospace;">${password}</code>
                    </td>
                  </tr>
                  ${
                    team
                      ? `
                  <tr>
                    <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Department:</td>
                    <td style="padding: 6px 0; color: #0f172a;">${team}</td>
                  </tr>
                  `
                      : ""
                  }
                  ${
                    role
                      ? `
                  <tr>
                    <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Designation:</td>
                    <td style="padding: 6px 0; color: #0f172a;">${role}</td>
                  </tr>
                  `
                      : ""
                  }
                </table>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 28px 0;">
                <a href="${loginUrl}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 8px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);">
                  Log In to VSI Pulse &rarr;
                </a>
              </div>

              <!-- Next steps notice -->
              <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 14px 16px; margin: 0 0 20px 0;">
                <div style="font-size: 12px; font-weight: 700; color: #92400e; margin-bottom: 4px;">
                  Security Recommendation:
                </div>
                <div style="font-size: 12px; line-height: 1.5; color: #b45309;">
                  For security, please log in and change your password immediately by clicking the <strong>Password</strong> button with the key icon in the top header.
                </div>
              </div>

              <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin: 0;">
                If you have any questions or require access permissions, please reach out to operations at <a href="mailto:info@virtualsolutionsindia.com" style="color: #2563eb; text-decoration: none;">info@virtualsolutionsindia.com</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
              This is an automated system notification from Virtual Solutions India.<br/>
              &copy; ${new Date().getFullYear()} Virtual Solutions India. All rights reserved.
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const transporter = getTransporter();
  const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_USER;

  const info = await transporter.sendMail({
    from: `"VSI Pulse Operations" <${fromEmail}>`,
    to,
    subject,
    text: plainText,
    html,
    priority: "high",
    headers: {
      "X-Priority": "1",
      "Importance": "high",
      "X-MSMail-Priority": "High",
    },
  });

  console.log(`[Google SMTP] Welcome email dispatched to ${to}. ID: ${info.messageId}`);
  return { success: true, provider: "smtp", messageId: info.messageId };
}
