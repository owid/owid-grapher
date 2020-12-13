import webpack from "webpack"

const path = require("path")
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin")
const MiniCssExtractPlugin = require("mini-css-extract-plugin")

const configAdjuster = ({ config }: { config: webpack.Configuration }) => {
    config.module!.rules = config.module!.rules.concat([
        {
            test: /\.scss$/,
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
    ])
    config.resolve!.plugins = [
        new TsconfigPathsPlugin({
            configFile: path.join(__dirname, "../tsconfig.client.json"),
        }),
    ]
    config.plugins = config.plugins!.concat([
        new MiniCssExtractPlugin({ filename: "[name].css" }),
    ])

    return config
}

export default configAdjuster
