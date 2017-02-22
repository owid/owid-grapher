var path = require('path');
var ExtractTextPlugin = require("extract-text-webpack-plugin");

module.exports = {
    context: path.join(__dirname, "public/js"),
    entry: {        
        charts: "./charts.entry.js",
        admin: "./admin.entry.js"
    },
    output: {
        path: path.join(__dirname, "public/build"),
        filename: "[name].bundle.js"
    },
  	resolve: {
        extensions: [".js", ".jsx", ".css"],
        alias: {
            'react': 'preact-compat',
            'react-dom': 'preact-compat'
        },
        modules: [
  	        path.join(__dirname, "public/js/libs"),
            path.join(__dirname, "public/css/libs"),
            path.join(__dirname, "node_modules"),
        ],
    }, 
    module: {
        rules: [
            { 
                test: /(preact-compat|\.jsx)/, // Preact-compat uses getters that don't work in IE11 for some reason
                loader: "babel-loader",
                options: {
                    presets: [['es2015', {modules: false}], 'stage-0', 'react'],
                    plugins: ["transform-decorators-legacy"],
                    cacheDirectory: true
                }
            },
            {
                test: /\.css$/,
                loader: ExtractTextPlugin.extract({ fallback: 'style-loader', use: 'css-loader' })                
            },
            {
                test: /\.(jpe?g|gif|png|eot|woff|ttf|svg|woff2)$/,
                loader: 'file-loader'
            }
        ],
    },
    plugins: [
       new ExtractTextPlugin('[name].bundle.css')
    ],
    devServer: {
        host: '0.0.0.0',
        port: 8080,
        contentBase: 'public',
        /*publicPath: '/grapher/',
        proxy: {
            "*": "http://127.0.0.1:8000/"
        }*/
    },
    // Enable sourcemaps for debugging webpack's output.
    devtool: "source-map"
};