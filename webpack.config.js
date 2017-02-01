var path = require('path');

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
    // Enable sourcemaps for debugging webpack's output.
    devtool: "source-map",    
  	resolve: {
        extensions: [".js", ".jsx"],
        alias: {
            'react': 'preact-compat',
            'react-dom': 'preact-compat'
        },
        modules: [
  	        path.join(__dirname, "public/js/libs"),
            path.join(__dirname, "node_modules"),
        ],
    }, 
    module: {
        rules: [
            { 
                test: /\.jsx$/, 
                loader: "babel-loader",
                options: {
                    presets: [['es2015', {modules: false}], 'stage-0', 'react'],
                    plugins: ["transform-decorators-legacy"],
                    cacheDirectory: true
                }
            },
        ],
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