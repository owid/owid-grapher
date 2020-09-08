const path = require("path")
const MiniCssExtractPlugin = require("mini-css-extract-plugin")
const ManifestPlugin = require("webpack-manifest-plugin")
const MomentLocalesPlugin = require("moment-locales-webpack-plugin")
const Dotenv = require("dotenv-webpack")

const TerserJSPlugin = require("terser-webpack-plugin")
const OptimizeCSSAssetsPlugin = require("optimize-css-assets-webpack-plugin")

module.exports = (env, argv) => {
    const isProduction = argv.mode === "production"
    return {
        cache: { type: "filesystem" },
        mode: isProduction ? "production" : "development",
        context: __dirname,
        entry: {
            admin: "./adminSite/client/admin.entry.ts",
            owid: "./site/client/owid.entry.ts",
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
            path: path.join(__dirname, "dist/webpack"),
            filename: "js/[name].js",
            //filename: (isProduction ? "js/[name].bundle.[hash].js" : "js/[name].js")
        },
        resolve: {
            extensions: [".ts", ".tsx", ".js", ".css"],
            modules: ["node_modules", __dirname],
            alias: { path: false }, // TODO this is apparently caused by `filenamify`, which is a dependency of `netlify-cli`. Why does Webpack care about it?
        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    loader: "ts-loader",
                    exclude: /serverSettings/,
                    options: {
                        transpileOnly: true,
                        configFile: path.join(
                            __dirname,
                            "tsconfig.client.json"
                        ),
                    },
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
        plugins: [
            // This plugin extracts css files required in the entry points
            // into a separate CSS bundle for download
            new MiniCssExtractPlugin({ filename: "css/[name].css" }),

            // Writes manifest.json which production code reads to know paths to asset files
            new ManifestPlugin(),

            // Remove all moment locales except for "en"
            // This way of doing so is recommended by Moment itself: https://momentjs.com/docs/#/use-it/webpack/
            new MomentLocalesPlugin(),

            // This plugin loads settings from .env so we can import them
            // Note that this means the settings become part of the client-side JS at webpack build time, not at server run time
            new Dotenv(),
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
