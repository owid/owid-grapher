import path from 'path'
import webpack from 'webpack'
import ExtractTextPlugin from 'extract-text-webpack-plugin'
import ManifestPlugin from 'webpack-manifest-plugin'
import OptimizeCssAssetsPlugin from 'optimize-css-assets-webpack-plugin'
import LodashModuleReplacementPlugin from 'lodash-webpack-plugin'
import ParallelUglifyPlugin from 'webpack-parallel-uglify-plugin'

const isProduction = process.argv.indexOf('-p') !== -1

export default {
    context: path.join(__dirname, "js"),
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
                test: /(preact-compat|\.jsx)/, // Preact-compat uses getters that don't work in IE11 for some reason
                loader: "babel-loader",
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
        // This plugin extracts css files required in the entry points
        // into a separate CSS bundle for download
        new ExtractTextPlugin('[name].bundle.[chunkhash].css'),

        new LodashModuleReplacementPlugin(),

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
        new LodashModuleReplacementPlugin(),
        new ExtractTextPlugin('[name].bundle.css'),
    ]),
    devServer: {
        host: '0.0.0.0',
        port: 8090,
        contentBase: 'public'
    },
}
