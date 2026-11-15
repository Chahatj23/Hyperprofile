import nodemailer from "nodemailer";
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
  previewUrl?: string;
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

  // 2. Real SMTP (Gmail, Brevo, SendGrid, Mailgun, AWS SES, or custom SMTP)
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT) || 587;

  if (smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const from = process.env.SMTP_FROM || `"Hyperprofile" <${smtpUser}>`;
      const info = await transporter.sendMail({
        from,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]+>/g, ""),
      });

      logger.info("email sent via smtp", { to, subject, messageId: info.messageId });
      return { sent: true, provider: "smtp", id: info.messageId };
    } catch (err) {
      logger.error("smtp sending failed", { err: String(err) });
    }
  }

  // 3. Ethereal Email Test Mailbox (Provides instant live viewable inbox link)
  try {
    const testAccount = await nodemailer.createTestAccount();
    const testTransporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    const info = await testTransporter.sendMail({
      from: `"Hyperprofile" <${testAccount.user}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ""),
    });

    const testUrl = nodemailer.getTestMessageUrl(info);
    const previewUrl = typeof testUrl === "string" ? testUrl : undefined;
    logger.info("email sent via ethereal test account", { to, subject, previewUrl });

    return {
      sent: true,
      provider: "ethereal",
      id: info.messageId,
      ...(previewUrl ? { previewUrl } : {}),
    };
  } catch (err) {
    logger.debug("ethereal test mailer skipped or unavailable", { err: String(err) });
  }

  // 4. Fallback Logger (Development / Preview without internet SMTP access)
  logger.info("auth otp email generated (preview delivery)", {
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
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #0284c7 0%, #0066fe 100%); color: #ffffff; display: inline-grid; place-items: center; font-size: 24px; font-weight: 800; margin-bottom: 12px;">✦</div>
        <h2 style="color: #0f172a; margin: 0 0 6px; font-size: 20px;">Creator Workspace</h2>
        <p style="color: #64748b; font-size: 14px; margin: 0;">Your one-time sign in code</p>
      </div>
      <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 14px; padding: 22px; text-align: center; margin: 24px 0;">
        <div style="font-size: 11px; font-weight: 700; color: #0369a1; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;">6-DIGIT VERIFICATION CODE</div>
        <span style="font-size: 34px; font-weight: 800; letter-spacing: 0.25em; color: #0284c7; font-family: monospace;">${code}</span>
      </div>
      <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
        Enter this 6-digit code on the sign in page. This code will expire in <strong>10 minutes</strong>.
      </p>
      <p style="color: #94a3b8; font-size: 12px; margin: 0; border-top: 1px solid #f1f5f9; padding-top: 16px;">
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
