// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite runs on web through wa-sqlite, whose WASM binary Metro won't
// resolve unless .wasm is a known asset extension.
config.resolver.assetExts.push('wasm');

module.exports = config;
