module.exports = {
  mode: 'development',
  entry: './src/assets/js/app.js',
  output: {
    path: `${__dirname}/dist`,
    filename: 'bundle.js',
  },
  module: {
    rules: [{
      test: /\.css$/,
      use: [
        'style-loader',
        'css-loader',
      ],
    },
    {
      test: /\.(woff|woff2)$/,
      loaders: [
        'url-loader',
      ],
    },
    {
      test: /\.(js)$/,
      exclude: /node_modules/,
      use: ['babel-loader', 'eslint-loader'],
    },
    ],
  },
  resolve: {
    extensions: ['*', '.js'],
  },
};
