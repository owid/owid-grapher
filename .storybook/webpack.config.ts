import path from "path"
import TsconfigPathsPlugin from "tsconfig-paths-webpack-plugin"
import MiniCssExtractPlugin from "mini-css-extract-plugin"

module.exports = ({ config }: { config: any }) => {
    config.module.rules = config.module.rules.concat([
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
    ])
    config.resolve.plugins = [
        new TsconfigPathsPlugin({
            configFile: path.join(__dirname, "../tsconfig.client.json"),
        }),
    ]
    config.plugins = config.plugins.concat([
        new MiniCssExtractPlugin({ filename: "css/[name].css" }),
    ])

    return config
}
