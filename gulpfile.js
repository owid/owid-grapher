var elixir = require('laravel-elixir');
var browserify = require('laravel-elixir-browserify');

/*
 |--------------------------------------------------------------------------
 | Elixir Asset Management
 |--------------------------------------------------------------------------
 |
 | Elixir provides a clean, fluent API for defining some basic Gulp tasks
 | for your Laravel application. By default, we are compiling the Less
 | file for our application, as well as publishing vendor resources.
 |
 */

elixir(function(mix) {

    mix.styles( [
        'libs/bootstrap.min.css',
        'libs/font-awesome/css/font-awesome.min.css',
        'libs/chosen.css',
        'libs/nv.d3.css'
    ], 'public/build/css/libs/front.css' );

    /*mix.styles( [
        'main.css',
        'chart.css'
    ], 'public/css/front.css' );*/
    
    mix.sass( [
        'range.scss',
        'main.scss',
        'chart.scss'
    ], 'public/css/front.css' );

    mix.styles( [
        'libs/bootstrap.min.css',
        'libs/font-awesome/css/font-awesome.min.css',
        'libs/AdminLTE.min.css',
        'libs/datepicker3.css',
        'libs/_all-skins.min.css',
        'libs/ion.rangeSlider.css',
        'libs/ion.rangeSlider.skinFlat.css',
        'libs/bootstrap3-wysihtml5.min.css',
        'libs/chosen.css',
        'libs/nv.d3.css',
    ], 'public/build/css/libs/admin.css' );

    /*mix.styles( [
        'admin/admin.css',
        'admin/data.css',
        'admin/import.css',
        'admin/charts.css',
        'chart.css',
        'main.css'
    ], 'public/css/admin.css' );*/

    mix.sass([
        'admin/admin.scss',
        'admin/data.scss',
        'admin/import.scss',
        'admin/charts.scss',
        'range.scss',
        'chart.scss',
        'main.scss'
    ], 'public/build/css/admin.css' );

    /** 
    *   SCRIPTS
    **/

    //front-end lib scripts
    mix.scripts([
        'libs/jquery-1.11.3.min.js',
        'libs/html5csv.js',
        'libs/d3.js',
        'libs/nv.d3.js',
        'libs/saveSvgAsPng.js',
        'libs/topojson.js',
        'libs/datamaps.js',
        'libs/underscore.js',
        'libs/backbone.js',
        'libs/bootstrap.min.js',
        'libs/chosen.jquery.js',
        'libs/colorbrewer.js'
    ], 'public/js/libs.js' );

    //back-end lib scripts
    mix.scripts([
        'libs/jquery-1.11.3.min.js',
        'libs/html5csv.js',
        'libs/d3.js',
        'libs/nv.d3.js',
        'libs/topojson.js',
        'libs/datamaps.js',
        'libs/saveSvgAsPng.js',
        'libs/underscore.js',
        'libs/backbone.js',
        'libs/bootstrap.min.js',
        'libs/bootstrap-datepicker.js',
        'libs/admin-lte-app.min.js',
        'libs/ion.rangeSlider.min.js',
        'libs/chosen.jquery.js',
        'libs/jquery.nestable.js',
        'libs/bootstrap3-wysihtml5.all.min.js',
        'libs/colorbrewer.js',
        'admin.js'
    ], 'public/js/libs-admin.js' );

    browserify.init();
    
    mix.browserify('app/ChartApp.js');
    mix.browserify('app/FormApp.js');
    mix.browserify('app/ImportApp.js');

    mix.version( [
        'css/libs/front.css',
        'css/front.css',
        'css/libs/admin.css',
        'css/admin.css',
        'js/ChartApp.js',
        'js/FormApp.js',
        'js/ImportApp.js',
        'js/libs.js',
        'js/libs-admin.js'
    ]);

    //mix.copy( 'resources/assets/css/libs/font-awesome/fonts/*', 'public/build/css/fonts/font-awesome/' );

});
