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
                    // We split up the bundle in order to improve our cache hit rate on Netlify's
                    // CDN. The algorithm Netlify uses is unclear, but a >1MB file is likely to be
                    // dropped from their cache often, leading to slow loading times while the CDN
                    // fetches the file from origin.
                    //
                    // We do not split up the CSS because it can arrive out of order, and order of
                    // definition matters in CSS.
                    //
                    // -@danielgavrilov, 2021-08-31
                    css: {
                        test: (module) => module.type?.startsWith("css"),
                        name: "commons-css", // needs to be unique
                        chunks: "all",
                        minChunks: 2,
                    },
                    js: {
                        test: (module) => !module.type?.startsWith("css"),
                        name: "commons-js", // needs to be unique
                        chunks: "all",
                        minChunks: 2,
                        maxSize: isProduction ? 1024 * 1024 : undefined, // in bytes
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
