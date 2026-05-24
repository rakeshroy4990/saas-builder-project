/**
 * Validates google-services.json for native Google Sign-In (Firebase config plugin path).
 * Used from app.config.js at build time — prints warnings, does not throw.
 */

function oauthProjectNumber(clientId) {
  const match = String(clientId ?? '').match(/^(\d+)-/);
  return match?.[1] ?? '';
}

/**
 * @param {unknown} json parsed google-services.json
 * @param {{ webClientId?: string; androidClientId?: string; expectedPackage?: string }} expected
 * @returns {string[]} human-readable issues (empty = OK for plugin path)
 */
function validateGoogleServicesJson(json, expected = {}) {
  const issues = [];

  const android = json?.client?.[0];
  const pkg = android?.client_info?.android_client_info?.package_name ?? '';
  const oauthClients = android?.oauth_client ?? [];
  const firebaseProjectNumber = String(json?.project_info?.project_number ?? '');

  const expectedPackage = expected.expectedPackage ?? 'com.agastya.healthcare';
  if (pkg !== expectedPackage) {
    issues.push(`package_name is "${pkg}" but app expects "${expectedPackage}"`);
  }

  if (oauthClients.length === 0) {
    issues.push(
      'oauth_client is empty — in Firebase: add SHA-1 to the Android app, enable Google under Authentication → Sign-in method, then re-download google-services.json'
    );
  }

  const webProject = oauthProjectNumber(expected.webClientId);
  const androidProject = oauthProjectNumber(expected.androidClientId);
  const oauthProject = webProject || androidProject;

  if (oauthProject && firebaseProjectNumber && oauthProject !== firebaseProjectNumber) {
    issues.push(
      `Firebase project_number ${firebaseProjectNumber} does not match OAuth client project ${oauthProject} — use google-services.json from the same GCP project as app.json client IDs, or update EXPO_PUBLIC_* client IDs to match Firebase`
    );
  }

  const hasWebClient = oauthClients.some((c) => c.client_type === 3);
  if (oauthClients.length > 0 && !hasWebClient) {
    issues.push('oauth_client has no Web client (client_type 3) — enable Google Sign-In in Firebase and re-download');
  }

  return issues;
}

/**
 * @param {string} filePath
 * @param {{ webClientId?: string; androidClientId?: string; expectedPackage?: string }} expected
 * @returns {string[]}
 */
function validateGoogleServices(filePath, expected = {}) {
  const fs = require('fs');

  if (!fs.existsSync(filePath)) {
    return ['file not found'];
  }

  try {
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return validateGoogleServicesJson(json, expected);
  } catch {
    return ['invalid JSON'];
  }
}

module.exports = { validateGoogleServices, validateGoogleServicesJson, oauthProjectNumber };
