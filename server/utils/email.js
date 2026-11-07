import crypto from "node:crypto";

const testMailbox = new Map();

export function generateVerificationOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

export function getOtpSecret() {
  return (
    process.env.OTP_SECRET ||
    process.env.JWT_SECRET ||
    "gdgoc-community-otp-internal-server-secret-key-psit"
  );
}

/**
 * Server-secret HMAC calculation for low-entropy 6-digit OTP codes.
 * Binds the HMAC to both the server secret and the normalized recipient email,
 * preventing offline rainbow-table / precomputation attacks.
 */
export function hashVerificationToken(email, token) {
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  const normalizedToken = String(token ?? "").trim();
  return crypto
    .createHmac("sha256", getOtpSecret())
    .update(`${normalizedEmail}:${normalizedToken}`)
    .digest("hex");
}

export async function sendVerificationEmail({ email, code }) {
  const normalizedEmail = String(email).trim().toLowerCase();

  // Test / In-memory mailbox for local and automated testing
  testMailbox.set(normalizedEmail, {
    code,
    sentAt: new Date(),
  });

  // Only log debug info in non-production, and do NOT expose full raw tokens in production
  if (process.env.NODE_ENV !== "production") {
    // Helpful for manual testing in development without exposing in production
    if (process.env.NODE_ENV === "development" && process.env.DEBUG_EMAILS === "true") {
      console.log(`[DEV-MAIL] Verification OTP for ${normalizedEmail}: ${code}`);
    }
  }

  // If a production SMTP or transactional email provider is configured in environment:
  // (e.g. SMTP_HOST / RESEND_API_KEY / SENDGRID_API_KEY)
  // This adapter handles real delivery without hardcoding secrets.
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "GDGoC PSIT <noreply@psit.ac.in>",
          to: [normalizedEmail],
          subject: "Your GDGoC PSIT Verification Code",
          text: `Welcome to GDGoC PSIT!\n\nYour 6-digit verification code is: ${code}\n\nThis code expires in 10 minutes. If you did not request this, please ignore this email.`,
          html: `<div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 3px solid #0a0a0a; background-color: #fdfaf2;">
            <h2 style="margin-top: 0; color: #0a0a0a; font-size: 24px;">Welcome to GDGoC PSIT!</h2>
            <p style="color: #222; font-size: 15px; line-height: 1.5;">Thank you for registering. Use the 6-digit verification code below to verify your email address and activate your account:</p>
            <div style="margin: 24px 0; padding: 16px; background-color: #fadb39; border: 2px solid #0a0a0a; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 6px; font-family: monospace;">
              ${code}
            </div>
            <p style="color: #666; font-size: 13px;">This code will expire in 10 minutes. If you did not request this account, you can safely ignore this email.</p>
          </div>`,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("[EMAIL-DELIVERY-ERROR]", res.status, errorData);
      }
    } catch (err) {
      console.error("[EMAIL-DELIVERY-ERROR]", err.message);
    }
  }

  return true;
}

export function getTestMailbox(email) {
  return testMailbox.get(String(email).trim().toLowerCase());
}

export function getLatestTestOtp(email) {
  return getTestMailbox(email)?.code;
}

export function getLatestTestResetToken(email) {
  return getTestMailbox(email)?.resetToken;
}

export function getLatestTestResetUrl(email) {
  return getTestMailbox(email)?.resetUrl;
}

export async function sendPasswordResetEmail({ email, resetUrl, token }) {
  const normalizedEmail = String(email).trim().toLowerCase();

  // Test / In-memory mailbox for local and automated testing
  testMailbox.set(normalizedEmail, {
    resetToken: token,
    resetUrl,
    sentAt: new Date(),
  });

  if (process.env.NODE_ENV !== "production") {
    if (process.env.NODE_ENV === "development" && process.env.DEBUG_EMAILS === "true") {
      console.log(`[DEV-MAIL] Password reset link for ${normalizedEmail}: ${resetUrl}`);
    }
  }

  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "GDGoC PSIT <noreply@psit.ac.in>",
          to: [normalizedEmail],
          subject: "Reset your GDGoC PSIT password",
          text: `Hello,\n\nWe received a request to reset your password for your GDGoC PSIT account.\n\nClick the link below to set a new password:\n${resetUrl}\n\nThis link expires in 15 minutes. If you did not request a password reset, you can safely ignore this email.\n\nGDGoC PSIT Team`,
          html: `<div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 3px solid #0a0a0a; background-color: #fdfaf2;">
            <h2 style="margin-top: 0; color: #0a0a0a; font-size: 24px;">Password Reset Request</h2>
            <p style="color: #222; font-size: 15px; line-height: 1.5;">We received a request to reset the password for your GDGoC PSIT account. Click the button below to choose a new password:</p>
            <div style="margin: 28px 0; text-align: center;">
              <a href="${resetUrl}" style="display: inline-block; padding: 14px 28px; background-color: #fadb39; color: #0a0a0a; border: 3px solid #0a0a0a; font-weight: bold; text-decoration: none; font-size: 16px; box-shadow: 4px 4px 0 #0a0a0a;">
                Reset Password →
              </a>
            </div>
            <p style="color: #666; font-size: 13px; line-height: 1.4;">This link expires in 15 minutes. If you did not request this password reset, no action is needed — your account remains secure.</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
            <p style="color: #888; font-size: 12px; word-break: break-all;">If the button above does not work, copy and paste this URL into your browser:<br/>${resetUrl}</p>
          </div>`,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("[EMAIL-DELIVERY-ERROR]", res.status, errorData);
      }
    } catch (err) {
      console.error("[EMAIL-DELIVERY-ERROR]", err.message);
    }
  }

  return true;
}

export function clearTestMailbox() {
  testMailbox.clear();
}
