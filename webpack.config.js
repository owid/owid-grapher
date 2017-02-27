var path = require('path');
var webpack = require('webpack');
var ExtractTextPlugin = require("extract-text-webpack-plugin");
var ManifestPlugin = require('webpack-manifest-plugin');
var OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin');

const isProduction = process.argv.indexOf('-p') !== -1;

module.exports = {
    context: path.join(__dirname, "public/js"),
    entry: {        
        charts: "./charts.entry.js",
        admin: "./admin.entry.js"
    },
    output: {
        path: path.join(__dirname, "public/build"),
        filename: (isProduction ? "[name].bundle.[chunkhash].js" : "[name].bundle.js")
    },
  	resolve: {
        extensions: [".js", ".jsx", ".css"],
        alias: {
            'react': 'preact-compat',
            'react-dom': 'preact-compat'
        },
        modules: [
  	        path.join(__dirname, "public/js/libs"),
            path.join(__dirname, "public/css/libs"),
            path.join(__dirname, "node_modules"),
        ],
    }, 
    module: {
        rules: [
            { 
                test: /(preact-compat|\.jsx)/, // Preact-compat uses getters that don't work in IE11 for some reason
                loader: "babel-loader",
                options: {
                    presets: [['es2015', {modules: false}], 'stage-0', 'react'],
                    plugins: ["transform-decorators-legacy"],
                    cacheDirectory: true
                }
            },
            {
                test: /\.css$/,
                loader: ExtractTextPlugin.extract({ fallback: 'style-loader', use: 'css-loader' })                
            },
            {
                test: /\.(jpe?g|gif|png|eot|woff|ttf|svg|woff2)$/,
                loader: 'file-loader'
            }
        ],
    },

    // Enable sourcemaps for debugging webpack's output.
    devtool: (isProduction ? false : "eval-source-map"),

    plugins: (isProduction ? [
        // This plugin extracts css files required in the entry points
        // into a separate CSS bundle for download
        new ExtractTextPlugin('[name].bundle.[chunkhash].css'),

        // CSS optimization
        new OptimizeCssAssetsPlugin({
            assetNameRegExp: /\.bundle.*\.css$/,
            cssProcessorOptions: { discardComments: { removeAll: true } }
        }),

        // JS optimization
        new webpack.optimize.UglifyJsPlugin({
            compress: {
              warnings: false,
              screw_ie8: true,
              conditionals: true,
              unused: true,
              comparisons: true,
              sequences: true,
              dead_code: true,
              evaluate: true,
              if_return: true,
              join_vars: true,
            },
        }),

        // Output manifest so server can figure out the hashed
        // filenames
        new ManifestPlugin(),        
    ] : [
        new ExtractTextPlugin('[name].bundle.css'),
    ]),
    devServer: {
        host: '0.0.0.0',
        port: 8090,
        contentBase: 'public'
    },
};