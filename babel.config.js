module.exports = function configureBabel(api) {
  api.cache(true);
  return {
    presets: [require.resolve("expo/node_modules/babel-preset-expo")],
    plugins: [require("./lib/babel-plugin-localize-jsx.cjs")],
  };
};
