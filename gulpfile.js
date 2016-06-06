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
    mix.copy('vendor/zofe/rapyd/public/assets/lib/bootstrap/dist/fonts', 'public/build/fonts');
    mix.copy('resources/assets/css/libs/chosen-sprite.png', 'public/build/css/');
    mix.copy('resources/assets/css/img', 'public/build/img');
    mix.copy('resources/assets/css/libs/chosen-sprite@2x.png', 'public/build/css/');
    mix.copy('resources/assets/js/data', 'public/build/js/data');

    mix.sass([
        'bootstrap/scss/bootstrap.scss'
    ], 'resources/tmp/bootstrap.css');
    
    mix.sass([
        'range.scss',
        'main.scss',
        'chart.scss'
    ], 'resources/tmp/front-sass.css').styles([
        '../../tmp/bootstrap.css',
        'libs/font-awesome/css/font-awesome.min.css',
        'libs/bootstrap-chosen.css',
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
        '../../tmp/bootstrap.css',
        'libs/font-awesome/css/font-awesome.min.css',
        'libs/AdminLTE.min.css',
        'libs/datepicker3.css',
        'libs/_all-skins.min.css',
        'libs/ion.rangeSlider.css',
        'libs/ion.rangeSlider.skinFlat.css',
        'libs/bootstrap3-wysihtml5.min.css',
        'libs/bootstrap-chosen.css',
        'libs/nv.d3.css',
        '../../tmp/admin-sass.css',
    ], 'public/css/admin.css');
    /** 
    *   SCRIPTS
    **/

    //front-end lib scripts
    mix.scripts([
        'libs/jquery-1.11.3.min.js',
        'libs/papaparse.js',
        'libs/d3.js',
        'libs/nv.d3.js',
        'libs/topojson.js',
        'libs/datamaps.js',
        'libs/underscore.js',
        'libs/underscore.string.js',
        'libs/backbone.js',
        'libs/bootstrap.min.js',
        'libs/chosen.jquery.js',
        'libs/colorbrewer.js',
        'libs/jquery.lazyloadxt.extra.js',
        'libs/async.min.js',
        'owd-colorbrewer.js',
        'owid.js',
    ], 'public/js/libs.js' );

    //back-end lib scripts
    mix.scripts([
        'libs/jquery-1.11.3.min.js',
        'libs/d3.js',
        'libs/nv.d3.js',
        'libs/topojson.js',
        'libs/datamaps.js',
        'libs/underscore.js',
        'libs/underscore.string.js',
        'libs/backbone.js',
        'libs/bootstrap.min.js',
        'libs/bootstrap-datepicker.js',
        'libs/admin-lte-app.min.js',
        'libs/ion.rangeSlider.min.js',
        'libs/chosen.jquery.js',
        'libs/jquery.nestable.js',
        'libs/bootstrap3-wysihtml5.all.min.js',
        'libs/colorbrewer.js',
        'libs/jquery.stickytabs.js',
        'libs/jquery.timeago.js',
        'libs/async.min.js',
        'owd-colorbrewer.js',
        'owid.js',
        'admin.js',
    ], 'public/js/libs-admin.js' );

    var chartScripts = [
        'app/constants.js',
        'app/App.Utils.js',
        'app/App.Models.ChartModel.js',
        'app/App.Models.ChartDataModel.js',
        'app/App.Views.Chart.Header.js',
        'app/App.Views.Chart.Footer.js',
        'app/App.Views.Chart.ScaleSelectors.js',
        'app/App.Views.Chart.Legend.js',
        'app/App.Views.Chart.ChartTab.js',
        'app/App.Views.Chart.DataTab.js',
        'app/App.Views.Chart.SourcesTab.js',

        'app/App.Views.Chart.Map.MapControls.js',
        'app/App.Views.Chart.Map.PlayPauseControl.js',
        'app/App.Views.Chart.Map.TimelineControl.js',
        'app/App.Views.Chart.Map.ButtonsControl.js',
        'app/App.Views.Chart.Map.TimelineControls.js',
        'app/App.Views.Chart.Map.Projections.js',
        'app/App.Views.Chart.Map.Legend.js',
        'app/App.Views.Chart.MapTab.js',

        'app/App.Views.ChartURL.js',
        'app/App.Views.ChartView.js',
    ];

    mix.scripts(
        chartScripts.concat(['app/ChartApp.js']),
        'public/js/ChartApp.js'
    );

    mix.scripts(
        chartScripts.concat([
            'app/App.Models.ChartVariableModel.js',
            'app/App.Models.ChartDimensionsModel.js',
            'app/App.Models.EntityModel.js',

            'app/App.Collections.ChartVariablesCollection.js',
            'app/App.Collections.SearchDataCollection.js',
            'app/App.Collections.AvailableEntitiesCollection.js',

            'app/App.Views.UI.SelectVarPopup.js',
            'app/App.Views.UI.SettingsVarPopup.js',
            'app/App.Views.UI.ColorPicker.js',

            'app/App.Views.Form.BasicTabView.js',
            'app/App.Views.Form.ChartTypeSectionView.js',
            'app/App.Views.Form.AddDataSectionView.js',
            'app/App.Views.Form.DimensionsSectionView.js',
            'app/App.Views.Form.SelectedCountriesSectionView.js',
            'app/App.Views.Form.EntitiesSectionView.js',
            'app/App.Views.Form.TimeSectionView.js',            
            'app/App.Views.Form.DataTabView.js',
            'app/App.Views.Form.AxisTabView.js',
            'app/App.Views.Form.DescriptionTabView.js',
            'app/App.Views.Form.StylingTabView.js',
            'app/App.Views.Form.ExportTabView.js',
            'app/App.Views.Form.MapColorSchemeView.js',
            'app/App.Views.Form.MapTabView.js',
            'app/App.Views.FormView.js',
            'app/App.Views.Form.js',

            'app/FormApp.js'
        ]),
        'public/js/FormApp.js'
    );

    mix.scripts([
        'libs/papaparse.js',
        'libs/moments.min.js',
        'app/App.Utils.js',
        'app/App.Models.ChartModel.js',        
        'app/App.Models.Importer.js',
        'app/App.Views.UI.ImportProgressPopup.js',
        'app/App.Views.ImportView.js',
        'app/App.Views.Import.js',
        'app/ImportApp.js'
    ], 'public/js/ImportApp.js');

    mix.version([
        'css/front.css',
        'css/admin.css',
        'js/ChartApp.js',
        'js/FormApp.js',
        'js/ImportApp.js',
        'js/libs.js',
        'js/libs-admin.js'
    ]);
});
