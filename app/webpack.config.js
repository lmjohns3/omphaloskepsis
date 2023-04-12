const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

module.exports = {
  mode: 'development', //'production',
  entry: './index.jsx',
  output: {
    path: path.resolve(__dirname, '../omphaloskepsis/static/'),
    filename: 'app.[hash].js',
  },
  devtool: 'inline-source-map',
  module: { rules: [
    { test: /\.jsx?$/i,
      exclude: /node_modules/,
      use: ['babel-loader'],
    },
    {
      test: /\.styl$/i,
      exclude: /node_modules/,
      use: [MiniCssExtractPlugin.loader, 'css-loader', 'stylus-loader'],
    },
    {
      test: /\.css$/i,
      use: [MiniCssExtractPlugin.loader, 'css-loader'],
    },
    {
      test: /\.png$/i,
      type: 'asset/resource',
    },
  ]},
  plugins: [
    new HtmlWebpackPlugin({
      filename: 'app.html',
      template: 'app.html',
      publicPath: '/static/',
    }),
    new MiniCssExtractPlugin({
      filename: 'app.[hash].css',
    }),
  ],
}
