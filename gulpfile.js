var elixir = require('laravel-elixir');

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
    // These assets are referred to in lib css urls and must be in the right relative place
    mix.copy('resources/assets/css/libs/font-awesome/fonts', 'public/build/fonts');
    mix.copy('/vendor/zofe/rapyd/public/assets/lib/bootstrap/dist/fonts', 'public/build/fonts');
    mix.copy('resources/assets/css/libs/chosen-sprite.png', 'public/build/css/');
    mix.copy('resources/assets/css/libs/chosen-sprite@2x.png', 'public/build/css/');
    mix.copy('resources/assets/js/data', 'public/build/js/data');
    mix.copy('resources/assets/js/libs/modernizr-2.8.3.min.js', 'public/build/js/');

    
    mix.sass([
        'range.scss',
        'main.scss',
        'chart.scss'
    ], 'resources/tmp/front-sass.css').styles([
        'libs/bootstrap.min.css',
        'libs/font-awesome/css/font-awesome.min.css',
        'libs/chosen.css',
        'libs/nv.d3.css',
        '../../tmp/front-sass.css'
    ], 'public/css/front.css');

    mix.sass([
        'admin/admin.scss',
        'admin/data.scss',
        'admin/import.scss',
        'admin/charts.scss',
        'range.scss',
        'chart.scss',
        'main.scss'
    ], 'resources/tmp/admin-sass.css').styles([
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
        '../../tmp/admin-sass.css',
    ], 'public/css/admin.css');
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
        'libs/colorbrewer.js',
        'libs/owd-colorbrewer.js',
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
        'libs/owd-colorbrewer.js',
        'libs/jquery.stickytabs.js',
        'libs/jquery.timeago.js'
    ], 'public/js/libs-admin.js' );

    mix.browserify('app/ChartApp.js');
    mix.browserify('app/FormApp.js');
    mix.browserify('app/ImportApp.js');

    mix.version([
        'css/front.css',
        'css/admin.css',
        'js/ChartApp.js',
        'js/FormApp.js',
        'js/ImportApp.js',
        'js/libs.js',
        'js/libs-admin.js'
    ]);

/*    mix.version( [
        'css/libs/front.css',
        'css/front.css',
        'css/libs/admin.css',
        'css/admin.css',
        'js/ChartApp.js',
        'js/FormApp.js',
        'js/ImportApp.js',
        'js/libs.js',
        'js/libs-admin.js'
    ]);*/
});
