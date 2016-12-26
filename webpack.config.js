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
        extensions: ["", ".ts", ".tsx", ".js"],
        root: [
  	       path.join(__dirname, "public/js/libs")
        ],
    }, 
    module: {
        loaders: [
            // All files with a '.ts' or '.tsx' extension will be handled by 'awesome-typescript-loader'.
            { test: /\.tsx?$/, loader: "awesome-typescript-loader" },
        ],

        preLoaders: [
            // All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
            { test: /\.js$/, loader: "source-map-loader" }
        ]
    }
};