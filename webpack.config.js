var path = require('path');

module.exports = {
    context: __dirname + "/public/js",
    entry: "./entry",
    output: {
        path: __dirname + "/public/js",
        filename: "bundle.js"
    },
	resolve: {
	    root: [
	    	__dirname + "/public/js/libs"
	    ]
	}, 
    module: {
        loaders: [
            {
              test: /\.jsx$/,
        	  loader: 'babel-loader'
     	    }
    	]
  	}	
};