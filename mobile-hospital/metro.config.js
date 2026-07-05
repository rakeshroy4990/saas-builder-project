// Load route modules on demand — sync mode eagerly imports every screen (BLE, Google Sign-In, etc.) at startup and can crash the app.
process.env.EXPO_ROUTER_IMPORT_MODE = 'lazy';

const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules')
];

module.exports = config;
