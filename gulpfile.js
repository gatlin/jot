var gulp = require('gulp');
var ts = require('gulp-typescript');
var tsProject = ts.createProject('tsconfig.json');
var webpack = require('webpack');
var gulpWebpack = require('gulp-webpack');

gulp.task('default', function() {
    return tsProject.src()
        .pipe(tsProject())
        .js
        .pipe(gulp.dest('jot'));
});

gulp.task('bundle', ['default'], function() {
    gulp.src('./jot/index.js')
        .pipe(gulpWebpack({
            output: {
                filename: 'jot_browser.js',
                libraryTarget: 'var',
                library: 'jot'
            },
            plugins: [
                new webpack.optimize.UglifyJsPlugin()
            ]
        }))
        .pipe(gulp.dest('./'));
});
