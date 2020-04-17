const path = require("path")
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin")
const MiniCssExtractPlugin = require("mini-css-extract-plugin")

module.exports = ({ config, mode }) => {
    config.module.rules = config.module.rules.concat([
        {
            test: /\.(ts|tsx)$/,
            loader: require.resolve("ts-loader"),
            exclude: /serverSettings/,
            options: {
                transpileOnly: true,
                configFile: path.join(__dirname, "../tsconfig.client.json")
            }
        },
        {
            test: /\.s?css$/,
            use: [
                MiniCssExtractPlugin.loader,
                "css-loader",
                "postcss-loader",
                {
                    loader: "sass-loader",
                    options: {
                        outputStyle: "expanded" // Needed so autoprefixer comments are included
                    }
                }
            ]
        }
    ])
    config.resolve.plugins = [
        new TsconfigPathsPlugin({
            configFile: path.join(__dirname, "../tsconfig.client.json")
        })
    ]
    config.resolve.extensions.push(".ts", ".tsx")
    config.plugins = config.plugins.concat([
        new MiniCssExtractPlugin("css/[name].css")
    ])
    return config
}
