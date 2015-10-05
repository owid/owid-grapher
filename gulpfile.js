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
    ], 'public/css/libs/front.css' );

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
    ], 'public/css/libs/admin.css' );

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
    ], 'public/css/admin.css' );

    browserify.init();
    //mix.browserify('app.js', null, 'assets/js');
    
    mix.browserify('app/ChartApp.js');
    mix.browserify('app/FormApp.js');
    mix.browserify('app/ImportApp.js');

});
