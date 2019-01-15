const path = require('path')
const ExtractTextPlugin = require('extract-text-webpack-plugin')

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production'

    return {
        context: __dirname,
        mode: isProduction ? "production" : "development",
        entry: {
            owid: "./js/owid.entry.ts",
        },
        output: {
            path: path.join(__dirname, "dist/webpack"),
            filename: "js/[name].js",
            libraryTarget: 'umd'
        },
        resolve: {
            extensions: [".ts", ".tsx", ".js", ".css", ".scss"],
            modules: [
                path.join(__dirname, "js/libs"),
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
                        transpileOnly: true
                    }
                },
                {
                    test: /\.css$/,
                    loader: ExtractTextPlugin.extract({
                        fallback: 'style-loader',
                        use: ['css-loader?modules&importLoaders=1&localIdentName=[local]'],
                    }),
                },
                {
                    test: /\.scss$/,
                    loader: ExtractTextPlugin.extract({ fallback: 'style-loader', use: ['css-loader?modules&importLoaders=1&localIdentName=[local]', 'sass-loader'] })
                },
                {
                    test: /\.(jpe?g|gif|png|eot|woff|ttf|svg|woff2)$/,
                    loader: 'url-loader',
                    options: {
                        limit: 10000,
                        useRelativePaths: true,
                        publicPath: '../'
                    }
                }
            ],
        },

        // Enable sourcemaps for debugging webpack's output.
        devtool: (isProduction ? false : "cheap-module-eval-source-map"),

        plugins: [
            // This plugin extracts css files required in the entry points
            // into a separate CSS bundle for download
            new ExtractTextPlugin('css/[name].css'),
        ],

        devServer: {
            host: 'localhost',
            port: 8095,
            contentBase: 'public',
            disableHostCheck: true,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
                "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization"
            }
        }
    }
}