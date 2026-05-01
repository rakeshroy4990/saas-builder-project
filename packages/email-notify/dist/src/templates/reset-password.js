"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildResetPasswordEmail = buildResetPasswordEmail;
const brand_shell_1 = require("./brand-shell");
function buildResetPasswordEmail(payload, appBaseUrl) {
    const resetUrl = `${appBaseUrl}/reset-password?token=${payload.token}`;
    const contentHtml = `
    <h2>Reset Your Password</h2>
    <p>Hi ${payload.userName},</p>
    <p>We received a request to reset your password. Click the button below within 1 hour:</p>
    <a href="${resetUrl}" style="background:#4F46E5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">
      Reset Password
    </a>
    <p>If you didn't request this, ignore this email.</p>
    <hr />
    <small>Link expires in 1 hour. Do not share this link.</small>
  `;
    const html = (0, brand_shell_1.withBrandShell)(contentHtml, appBaseUrl);
    const text = `Reset your password: ${resetUrl}\nExpires in 1 hour.`;
    return {
        subject: 'Reset Your Password',
        html,
        text,
    };
}
