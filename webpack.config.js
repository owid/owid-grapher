const path = require('path')
const webpack = require('webpack')
const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin')
const ExtractTextPlugin = require('extract-text-webpack-plugin')
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const ManifestPlugin = require('webpack-manifest-plugin')
const ParallelUglifyPlugin = require('webpack-parallel-uglify-plugin')

const isProduction = process.argv.indexOf('-p') !== -1

module.exports = {
    context: __dirname,
    entry: {
        charts: "./js/charts.entry.ts",
        admin: "./js/admin.entry.ts"
    },
    output: {
        path: path.join(__dirname, "public/build"),
        filename: (isProduction ? "[name].bundle.[chunkhash].js" : "[name].js")
    },
  	resolve: {
        extensions: [".ts", ".tsx", ".js", ".css"],
        alias: {
            'react': 'preact-compat',
            'react-dom': 'preact-compat',
        },
        modules: [
  	        path.join(__dirname, "js/libs"),
            path.join(__dirname, "css/libs"),
            path.join(__dirname, "node_modules"),
        ],
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: "ts-loader",
                options: {
                    transpileOnly: true
                }
            },
            {
                test: /\.css$/,
                loader: ExtractTextPlugin.extract({ fallback: 'style-loader', use: ['css-loader?modules&importLoaders=1&localIdentName=[local]', 'postcss-loader'] })
            },
            {
                test: /\.(jpe?g|gif|png|eot|woff|ttf|svg|woff2)$/,
                loader: 'url-loader?limit=10000'
            }
        ],
    },

    // Enable sourcemaps for debugging webpack's output.
    devtool: (isProduction ? false : "cheap-module-eval-source-map"),

    plugins: (isProduction ? [
        new webpack.optimize.CommonsChunkPlugin({
            name: "charts"
        }),

        // This plugin extracts css files required in the entry points
        // into a separate CSS bundle for download
        new ExtractTextPlugin('[name].bundle.[chunkhash].css'),

        // CSS optimization
        new OptimizeCssAssetsPlugin({
            assetNameRegExp: /\.bundle.*\.css$/,
            cssProcessorOptions: { discardComments: { removeAll: true } }
        }),

        // JS optimization
        new ParallelUglifyPlugin({
            cachePath: path.join(__dirname, 'tmp'),
            uglifyJS: {
                compress: {
                  warnings: false,
                  screw_ie8: true,
                  conditionals: true,
                  unused: false,
                  comparisons: true,
                  sequences: true,
                  dead_code: true,
                  evaluate: true,
                  if_return: true,
                  join_vars: true
                },
            }
        }),

        // Output manifest so server can figure out the hashed
        // filenames
        new ManifestPlugin(),
    ] : [
        new webpack.optimize.CommonsChunkPlugin({
            name: "charts"
        }),

        new ForkTsCheckerWebpackPlugin(),

        new ExtractTextPlugin('[name].css')
    ]),
    devServer: {
        host: 'localhost',
        port: 8090,
        contentBase: 'public',
        disableHostCheck: true,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization"
        }
    },
}
