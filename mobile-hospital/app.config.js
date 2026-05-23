/**
 * Dynamic Expo config — merges with app.json via the `config` argument (required by expo-doctor).
 * @param {import('@expo/config').ConfigContext} param0
 */
module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE ?? '';
  const useDevClient = profile === 'development';

  const plugins = (config.plugins ?? []).filter((entry) => {
    const name = typeof entry === 'string' ? entry : entry[0];
    return name !== 'expo-dev-client' && name !== 'expo-build-properties';
  });

  plugins.push([
    'expo-build-properties',
    {
      android: {
        buildArchs: ['arm64-v8a', 'armeabi-v7a']
      }
    }
  ]);

  if (useDevClient) {
    plugins.unshift('expo-dev-client');
  }

  /** @type {import('@expo/config').ExpoConfig} */
  return {
    ...config,
    plugins
  };
};
