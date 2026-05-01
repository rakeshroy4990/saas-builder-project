import { WelcomeRegistrationPayload } from '../types';
import { withBrandShell } from './brand-shell';

export function buildWelcomeRegistrationEmail(
  payload: WelcomeRegistrationPayload,
  appBaseUrl: string
) {
  const dashboardUrl = `${String(appBaseUrl ?? '').replace(/\/+$/, '')}/page/hospital/home`;
  const contentHtml = `
    <h2>Welcome to Agastya Healthcare</h2>
    <p>Hi ${payload.userName},</p>
    <p>Thank you for registering with Agastya Healthcare. Your account is now active.</p>
    <p>You can sign in anytime to book appointments, manage visits, and access your health updates.</p>
    <p>
      <a href="${dashboardUrl}" style="background:#0f766e;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">
        Open Portal
      </a>
    </p>
    <p>If you did not create this account, please contact support immediately.</p>
  `;

  return {
    subject: 'Welcome to Agastya Healthcare',
    html: withBrandShell(contentHtml, appBaseUrl),
    text: `Welcome to Agastya Healthcare, ${payload.userName}. Open portal: ${dashboardUrl}`,
  };
}
