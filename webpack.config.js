var path = require('path');

module.exports = {
    context: path.join(__dirname, "public/js"),
    entry: "./entry",
    output: {
        path: path.join(__dirname, "public/build"),
        filename: "bundle.js"
    },
    // Enable sourcemaps for debugging webpack's output.
    devtool: "source-map",    
  	resolve: {
        extensions: ["", ".js", ".jsx"],
        alias: {
            'react': 'preact-compat',
            'react-dom': 'preact-compat'
        },
        root: [
  	        path.join(__dirname, "public/js/libs"),
            path.join(__dirname, "node_modules"),
        ],
    }, 
    module: {
        loaders: [
            { 
                test: /\.jsx$/, 
                loader: "babel-loader",
                query: {
                    presets: ['es2015', 'stage-0', 'react'],
                    plugins: ["transform-decorators-legacy"],
                    cacheDirectory: true
                }
            },
        ],

        preLoaders: [
            // All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
            { test: /\.js$/, loader: "source-map-loader" }
        ]
    },
    devServer: {
        host: '0.0.0.0',
        port: 8080,
        contentBase: 'public',
        /*publicPath: '/grapher/',
        proxy: {
            "*": "http://127.0.0.1:8000/"
        }*/
    }    
};