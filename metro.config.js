// Metro configuration for Expo React Native mobile build
// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Enable asset extensions for local GGUF models, audio recordings and SQLite files
config.resolver.assetExts.push('gguf', 'bin', 'wav', 'm4a', 'db', 'sqlite');

module.exports = config;
