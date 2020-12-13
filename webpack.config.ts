import webpack from "webpack"
import path from "path"

const MiniCssExtractPlugin = require("mini-css-extract-plugin")
const ManifestPlugin = require("webpack-manifest-plugin")
const MomentLocalesPlugin = require("moment-locales-webpack-plugin")

const TerserJSPlugin = require("terser-webpack-plugin")
const OptimizeCSSAssetsPlugin = require("optimize-css-assets-webpack-plugin")

const config: webpack.ConfigurationFactory = (env, argv) => {
    const isProduction = argv.mode === "production"
    const javascriptDir = path.resolve(__dirname, "itsJustJavascript")
    return {
        context: javascriptDir,
        entry: {
            admin: "./adminSiteClient/admin.entry.js",
            owid: "./site/owid.entry.js",
        },
        optimization: {
            splitChunks: {
                cacheGroups: {
                    commons: {
                        name: "commons",
                        chunks: "all",
                        minChunks: 2,
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
            modules: ["node_modules", javascriptDir, __dirname], // __dirname is required for resolving *.scss files
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
                        "postcss-loader",
                        {
                            loader: "sass-loader",
                            options: {
                                sassOptions: {
                                    outputStyle: "expanded", // Needed so autoprefixer comments are included
                                },
                            },
                        },
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
        devtool: "source-map",
        plugins: [
            // This plugin extracts css files required in the entry points
            // into a separate CSS bundle for download
            new MiniCssExtractPlugin({ filename: "[name].css" }),

            // Writes manifest.json which production code reads to know paths to asset files
            new ManifestPlugin(),

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
