const webpack = require('webpack');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.resolve = {
        ...webpackConfig.resolve,
        fallback: {
          ...webpackConfig.resolve?.fallback,
          crypto: require.resolve("crypto-browserify"),
          buffer: require.resolve("buffer/"),
          stream: require.resolve("stream-browserify"),
          path: require.resolve("path-browserify"),
          process: require.resolve("process/browser"),
          vm: require.resolve("vm-browserify"),
        },
      };

      webpackConfig.plugins = [
        ...webpackConfig.plugins,
        new webpack.ProvidePlugin({
          process: 'process/browser',
          Buffer: ['buffer', 'Buffer'],
        }),
      ];

      return webpackConfig;
    },
  },
};
