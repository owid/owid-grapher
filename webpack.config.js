var path = require('path');

module.exports = {
    context: path.join(__dirname, "public/js"),
    entry: "./entry",
    output: {
        path: path.join(__dirname, "public/js"),
        filename: "bundle.js"
    },
    // Enable sourcemaps for debugging webpack's output.
    devtool: "source-map",    
  	resolve: {
        extensions: ["", ".js", ".jsx"],
        root: [
  	       path.join(__dirname, "public/js/libs")
        ],
    }, 
    module: {
        loaders: [
            { 
                test: /\.jsx$/, 
                loader: "babel-loader",
                query: {
                    presets: ['es2015'],
                    cacheDirectory: true
                }
            },
        ],

        preLoaders: [
            // All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
            { test: /\.js$/, loader: "source-map-loader" }
        ]
    }
};