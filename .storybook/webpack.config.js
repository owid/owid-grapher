const path = require("path")
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin")
const ExtractTextPlugin = require("extract-text-webpack-plugin")

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
            test: /\.scss$/,
            loader: ExtractTextPlugin.extract({
                fallback: "style-loader",
                use: [
                    "css-loader?modules&importLoaders=1&localIdentName=[local]",
                    "sass-loader"
                ]
            })
        }
    ])
    config.resolve.plugins = [
        new TsconfigPathsPlugin({
            configFile: path.join(__dirname, "../tsconfig.client.json")
        })
    ]
    config.resolve.extensions.push(".ts", ".tsx")
    config.plugins = config.plugins.concat([
        new ExtractTextPlugin("css/[name].css")
    ])
    return config
}
