const path = require('path')
const webpack = require('webpack')
const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin')
const ExtractTextPlugin = require('extract-text-webpack-plugin')
const ManifestPlugin = require('webpack-manifest-plugin')
const ParallelUglifyPlugin = require('webpack-parallel-uglify-plugin')
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production'
    return {
        context: __dirname,
        entry: {
            charts: "./js/charts.entry.ts",
            admin: "./js/admin.entry.ts",
            oldadmin: "./js/oldadmin.entry.ts"
        },
        optimization: {
            splitChunks: {
                cacheGroups: {
                    commons: {
                        name: "commons",
                        chunks: "all",
                        minChunks: 2
                    }
                }
            },
            minimizer: [
                new UglifyJsPlugin({
                    uglifyOptions: {
                        compress: {
                            // https://github.com/developit/preact/issues/961
                            reduce_vars: false
                        }    
                    },
                })
            ]
        },
        output: {
            path: path.join(__dirname, "grapher_admin/static/build"),
            filename: (isProduction ? "[name].bundle.[chunkhash].js" : "[name].js")
        },
          resolve: {
            extensions: [".ts", ".tsx", ".js", ".css"],
            alias: {
                'react': 'preact-compat',
                'react-dom': 'preact-compat',
            },
            modules: [
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
                        transpileOnly: true,
                        configFile: path.join(__dirname, "tsconfig.client.json")
                    }
                },
                {
                    test: /\.css$/,
                    loader: ExtractTextPlugin.extract({ fallback: 'style-loader', use: ['css-loader?modules&importLoaders=1&localIdentName=[local]', 'postcss-loader'] })
                },
                {
                    test: /\.scss$/,
                    loader: ExtractTextPlugin.extract({ fallback: 'style-loader', use: ['css-loader?modules&importLoaders=1&localIdentName=[local]', 'sass-loader'] })
                },
                {
                    test: /\.(jpe?g|gif|png|eot|woff|ttf|svg|woff2)$/,
                    loader: 'url-loader?limit=10000'
                }
            ],
        },
        plugins: [
            // This plugin extracts css files required in the entry points
            // into a separate CSS bundle for download
            new ExtractTextPlugin(isProduction ? '[name].bundle.[chunkhash].css' : '[name].css'),
            new ManifestPlugin(),
        ],
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
}
