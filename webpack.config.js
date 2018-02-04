var path = require('path');
var webpack = require('webpack');

var config = {
    entry: {
        'index': './jot/index.js'
    },

    output: {
        filename: 'jot_browser.js',
        libraryTarget: 'var',
        library: 'jot'
    },

    resolve: {
        extensions: ['.js']
    },

    plugins: [
        new webpack.optimize.UglifyJsPlugin()
    ]
};

module.exports = config;
