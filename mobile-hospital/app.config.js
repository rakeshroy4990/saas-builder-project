/**
 * Dynamic Expo config — merges with app.json via the `config` argument (required by expo-doctor).
 * @param {import('@expo/config').ConfigContext} param0
 */
const fs = require('fs');
const path = require('path');

const { validateGoogleServices } = require('./scripts/validateGoogleServices.js');

function googleSchemeFromClientId(clientId) {
  const trimmed = String(clientId ?? '').trim();
  if (!trimmed) return null;
  const prefix = trimmed.replace(/\.apps\.googleusercontent\.com$/i, '');
  return prefix ? `com.googleusercontent.apps.${prefix}` : null;
}

module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE ?? '';
  const useDevClient = profile === 'development';
  const extra = config.extra ?? {};
  const baseScheme = config.scheme ?? 'mobilehospital';
  const googleSchemes = [
    googleSchemeFromClientId(extra.googleAndroidClientId),
    googleSchemeFromClientId(extra.googleIosClientId)
  ].filter(Boolean);
  const scheme = [...new Set([baseScheme, ...googleSchemes])];

  const plugins = (config.plugins ?? []).filter((entry) => {
    const name = typeof entry === 'string' ? entry : entry[0];
    return name !== 'expo-dev-client' && name !== 'expo-build-properties';
  });

  plugins.push([
    'expo-build-properties',
    {
      android: {
        buildArchs: ['arm64-v8a', 'armeabi-v7a'],
        softwareKeyboardLayoutMode: 'resize'
      }
    }
  ]);
  plugins.push('expo-localization');

  if (useDevClient) {
    plugins.unshift('expo-dev-client');
  }

  const iosUrlScheme =
    googleSchemeFromClientId(extra.googleIosClientId) ??
    googleSchemeFromClientId(extra.googleAndroidClientId) ??
    googleSchemeFromClientId(extra.googleOAuthClientId);

  const googleServicesFile = './google-services.json';
  const googleServicesPath = path.join(__dirname, googleServicesFile);
  const googleServicesExists = fs.existsSync(googleServicesPath);
  const googleServicesIssues = googleServicesExists
    ? validateGoogleServices(googleServicesPath, {
        webClientId: extra.googleOAuthClientId,
        androidClientId: extra.googleAndroidClientId,
        expectedPackage: config.android?.package ?? 'com.agastya.healthcare'
      })
    : [];

  /** Firebase plugin only when oauth_client entries are present (otherwise use Console + iosUrlScheme). */
  const useFirebaseGooglePlugin = googleServicesExists && googleServicesIssues.length === 0;

  if (googleServicesExists && !useFirebaseGooglePlugin) {
    console.warn(
      '[app.config] google-services.json found but not used for Google Sign-In plugin:\n' +
        googleServicesIssues.map((line) => `  - ${line}`).join('\n') +
        '\nFalling back to Google Cloud Console OAuth clients (iosUrlScheme). Fix the file or remove it.'
    );
  }

  if (useFirebaseGooglePlugin) {
    plugins.push('@react-native-google-signin/google-signin');
  } else if (iosUrlScheme) {
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme }]);
  }

  // Drop googleServicesFile from app.json when the file is invalid — an empty oauth_client
  // entry bundled into the APK often causes DEVELOPER_ERROR even with Console OAuth clients.
  const { googleServicesFile: _ignored, ...androidBase } = config.android ?? {};

  const apiBaseUrl = String(
    process.env.EXPO_PUBLIC_API_URL ?? process.env.EXPO_PUBLIC_API_BASE_URL ?? extra.apiBaseUrl ?? ''
  ).trim();

  /** @type {import('@expo/config').ExpoConfig} */
  return {
    ...config,
    scheme,
    extra: {
      ...extra,
      ...(apiBaseUrl ? { apiBaseUrl } : {})
    },
    android: {
      ...androidBase,
      ...(useFirebaseGooglePlugin ? { googleServicesFile } : {})
    },
    plugins
  };
};
