import { logger } from "@hyperprofile/shared";

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface MailResult {
  sent: boolean;
  provider: string;
  id?: string;
  error?: string;
}

export async function sendEmail(opts: MailOptions): Promise<MailResult> {
  const { to, subject, html, text } = opts;

  // 1. Resend API (HTTP REST — zero SMTP port blocking)
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const from = process.env.EMAIL_FROM || "Hyperprofile <onboarding@resend.dev>";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          html,
          text: text || html.replace(/<[^>]+>/g, ""),
        }),
      });

      if (res.ok) {
        const json = (await res.json()) as { id?: string };
        logger.info("email sent via resend", { to, subject, id: json.id });
        return { sent: true, provider: "resend", ...(json.id ? { id: json.id } : {}) };
      } else {
        const errText = await res.text();
        logger.warn("resend api error", { status: res.status, err: errText });
      }
    } catch (err) {
      logger.error("resend network error", { err: String(err) });
    }
  }

  // 2. Fallback Logger (Development / Preview / Staging without configured mail provider)
  logger.info("auth otp email dispatched (local/preview delivery)", {
    to,
    subject,
  });

  return {
    sent: false,
    provider: "console",
  };
}

export async function sendOtpEmail(email: string, code: string): Promise<MailResult> {
  const subject = `Your Hyperprofile Verification Code: ${code}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; borderRadius: 16px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #0f172a; margin: 0 0 6px;">Creator Workspace</h2>
        <p style="color: #64748b; font-size: 14px; margin: 0;">Your one-time sign in code</p>
      </div>
      <div style="background: #f8fafc; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: 800; letter-spacing: 0.25em; color: #0284c7; font-family: monospace;">${code}</span>
      </div>
      <p style="color: #475569; font-size: 14px; line-height: 1.5; margin: 0 0 12px;">
        Enter this 6-digit code on the sign in page. This code will expire in <strong>10 minutes</strong>.
      </p>
      <p style="color: #94a3b8; font-size: 12px; margin: 0; border-top: 1px solid #f1f5f9; padding-top: 14px;">
        If you did not request this verification code, please ignore this email.
      </p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject,
    html,
    text: `Your Hyperprofile verification code is: ${code}. It expires in 10 minutes.`,
  });
}
