import webpack from "webpack"

const path = require("path")
const MiniCssExtractPlugin = require("mini-css-extract-plugin")

const configAdjuster = ({ config }: { config: webpack.Configuration }) => {
    // baseDir is necessary to make webpack.config.ts use the correct path both in TS as well as in
    // transpiled JS form
    let baseDir = path.resolve(__dirname, "..")
    baseDir =
        path.basename(baseDir) === "itsJustJavascript"
            ? path.resolve(baseDir, "..")
            : baseDir

    const javascriptDir = path.resolve(baseDir, "itsJustJavascript")

    config.module!.rules = config!.module!.rules!.concat([
        {
            test: /\.scss$/,
            use: [
                MiniCssExtractPlugin.loader,
                {
                    loader: "css-loader",
                    options: {
                        url: false,
                    },
                },
                "sass-loader",
            ],
        },
    ])
    config.plugins = config.plugins!.concat([
        new MiniCssExtractPlugin({ filename: "[name].css" }),
    ])

    config.resolve!.modules = ["node_modules", javascriptDir, baseDir] // baseDir is required for resolving *.scss files

    config.resolve!.fallback = { assert: false, fs: false, path: false }

    return config
}

export default configAdjuster
