module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Worklets plugin must stay last — Reanimated 4 relies on it running after
    // every other transform.
    plugins: ['react-native-worklets/plugin'],
  };
};
