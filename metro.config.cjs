// Metro configuration for Expo React Native mobile build
// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');
const getJsPolyfills = require('@react-native/js-polyfills');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Enable asset extensions for local GGUF models, audio recordings and SQLite files
config.resolver.assetExts.push('gguf', 'bin', 'wav', 'm4a', 'db', 'sqlite');

config.serializer = config.serializer || {};
config.serializer.getPolyfills = () => getJsPolyfills();

module.exports = config;
