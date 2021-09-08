import webpack from "webpack"
import path from "path"

const MiniCssExtractPlugin = require("mini-css-extract-plugin")
const ManifestPlugin = require("webpack-manifest-plugin")
const MomentLocalesPlugin = require("moment-locales-webpack-plugin")

const TerserJSPlugin = require("terser-webpack-plugin")
const OptimizeCSSAssetsPlugin = require("optimize-css-assets-webpack-plugin")
const DotenvWebpackPlugin = require("dotenv-webpack")

const config: webpack.ConfigurationFactory = async (env, argv) => {
    const isProduction = argv.mode === "production"

    // baseDir is necessary to make webpack.config.ts use the correct path both in TS as well as in
    // transpiled JS form
    const baseDir =
        path.basename(__dirname) === "itsJustJavascript"
            ? path.resolve(__dirname, "..")
            : __dirname

    const javascriptDir = path.resolve(baseDir, "itsJustJavascript")
    return {
        context: javascriptDir,
        entry: {
            admin: "./adminSiteClient/admin.entry.js",
            owid: "./site/owid.entry.js",
        },
        optimization: {
            splitChunks: {
                cacheGroups: {
                    // The bundle created through this cache group contains all the dependencies
                    // that are _both_ used by owid.entry.js and admin.entry.js.
                    vendors: {
                        test: (module) =>
                            !module.type?.startsWith("css") && // no need to split CSS, since there's very little vendor css anyway
                            /[\\/]node_modules[\\/]/.test(module.resource),
                        name: "vendors",
                        chunks: "all",
                        minChunks: 2,
                        priority: 1, // needs to be higher than for "commons"
                    },
                    // The bundle created through this cache group contains all the code
                    // that is _both_ used by owid.entry.js and admin.entry.js.
                    commons: {
                        name: "commons",
                        chunks: "all",
                        minChunks: 2,
                        priority: 0,
                    },
                },
            },
            minimize: isProduction,
            minimizer: [new TerserJSPlugin(), new OptimizeCSSAssetsPlugin()],
        },
        output: {
            path: path.join(javascriptDir, "webpack"),
            filename: "[name].js",
        },
        resolve: {
            extensions: [".js", ".css"],
            modules: ["node_modules", javascriptDir, baseDir], // baseDir is required for resolving *.scss files
        },
        node: {
            // This is needed so Webpack ignores "dotenv" imports in bundled code
            fs: "empty",
        },
        module: {
            rules: [
                {
                    test: /\.js$/,
                    enforce: "pre",
                    use: ["source-map-loader"],
                    exclude: /node_modules/,
                },
                {
                    test: /\.s?css$/,
                    use: [
                        MiniCssExtractPlugin.loader,
                        "css-loader?url=false",
                        "sass-loader",
                    ],
                },
                {
                    test: /\.(jpe?g|gif|png|eot|woff|ttf|svg|woff2)$/,
                    loader: "url-loader",
                    options: {
                        limit: 10000,
                        useRelativePaths: true,
                        publicPath: "../",
                    },
                },
            ],
        },
        devtool: "source-map", // add source maps in both production and dev
        plugins: [
            // This plugin extracts css files required in the entry points
            // into a separate CSS bundle for download
            new MiniCssExtractPlugin({ filename: "[name].css" }),

            // Writes manifest.json which production code reads to know paths to asset files
            new ManifestPlugin(),

            // Provide client-side settings from .env
            new DotenvWebpackPlugin(),

            // Ensure serverSettings.ts and clientSettingsReader.ts never end up in a webpack build by accident
            new webpack.IgnorePlugin(
                /settings\/(serverSettings|clientSettingsReader)/
            ),

            // Remove all moment locales except for "en"
            // This way of doing so is recommended by Moment itself: https://momentjs.com/docs/#/use-it/webpack/
            new MomentLocalesPlugin(),
        ],
        devServer: {
            host: "localhost",
            port: 8090,
            contentBase: "public",
            disableHostCheck: true,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods":
                    "GET, POST, PUT, DELETE, PATCH, OPTIONS",
                "Access-Control-Allow-Headers":
                    "X-Requested-With, content-type, Authorization",
            },
        },
    }
}

export default config
