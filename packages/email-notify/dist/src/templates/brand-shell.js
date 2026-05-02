"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveBrandLogoUrl = resolveBrandLogoUrl;
exports.withBrandShell = withBrandShell;
const DEFAULT_LOGO_URL = 'https://res.cloudinary.com/dbke33vfd/image/upload/c_fill,h_80,w_80/v1776158879/logo_oz0zzd.jpg';
function escapeHtml(raw) {
    return String(raw ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function resolveBrandLogoUrl(appBaseUrl) {
    const base = String(appBaseUrl ?? '').trim().replace(/\/+$/, '');
    if (base) {
        return `${base}/favicon.svg`;
    }
    return DEFAULT_LOGO_URL;
}
function withBrandShell(contentHtml, appBaseUrl) {
    const logoUrl = escapeHtml(resolveBrandLogoUrl(appBaseUrl));
    const body = String(contentHtml ?? '').trim();
    return `
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.55;max-width:640px;margin:0 auto">
      <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;border:1px solid #e5e7eb;border-radius:10px;background:#f8fafc;margin-bottom:16px">
        <img src="${logoUrl}" alt="Agastya Healthcare logo" width="40" height="40" style="width:40px;height:40px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb" />
        <div style="font-size:20px;font-weight:700;color:#0f766e">Agastya Healthcare</div>
      </div>
      <div style="padding:0 4px">${body}</div>
    </div>
  `.trim();
}
