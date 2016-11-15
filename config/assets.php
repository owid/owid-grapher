<?php

/*
|---------------------------------------------------------------------------
| Here are SOME of the available configuration options with suitable values.
| Uncomment and customize those you want to override or remove them to
| use their default values. For a FULL list of options please visit
| https://github.com/Stolz/Assets/blob/master/API.md#assets
|---------------------------------------------------------------------------
*/

return [

	// Configuration for the default group. Feel free to add more groups.
	// Each group can have different settings.
	'default' => [

		/**
		 * Regex to match against a filename/url to determine if it is an asset.
		 *
		 * @var string
		 */
		//'asset_regex' => '/.\.(css|js)$/i',

		/**
		 * Regex to match against a filename/url to determine if it is a CSS asset.
		 *
		 * @var string
		 */
		//'css_regex' => '/.\.css$/i',

		/**
		 * Regex to match against a filename/url to determine if it is a JavaScript asset.
		 *
		 * @var string
		 */
		//'js_regex' => '/.\.js$/i',

		/**
		 * Regex to match against a filename/url to determine if it should not be minified by pipeline.
		 *
		 * @var string
		 */
		//'no_minification_regex' => '/.[-.]min\.(css|js)$/i',

		/**
		 * Absolute path to the public directory of your App (WEBROOT).
		 * Required if you enable the pipeline.
		 * No trailing slash!.
		 *
		 * @var string
		 */
		'public_dir' => (function_exists('public_path')) ? public_path() : '/var/www/html',

		/**
		 * Directory for local CSS assets.
		 * Relative to your public directory ('public_dir').
		 * No trailing slash!.
		 *
		 * @var string
		 */
		'css_dir' => 'css',

		/**
		 * Directory for local JavaScript assets.
		 * Relative to your public directory ('public_dir').
		 * No trailing slash!.
		 *
		 * @var string
		 */
		'js_dir' => 'js',

		/**
		 * Directory for local package assets.
		 * Relative to your public directory ('public_dir').
		 * No trailing slash!.
		 *
		 * @var string
		 */
		//'packages_dir' => 'packages',

		/**
		 * Enable assets pipeline (concatenation and minification).
		 * Use a string that evaluates to `true` to provide the salt of the pipeline hash.
		 * Use 'auto' to automatically calculated the salt from your assets last modification time.
		 *
		 * @var bool|string
		 */
		'pipeline' => env('APP_ENV', 'production') == 'production' ? 'auto' : false,

		/**
		 * Directory for storing pipelined assets.
		 * Relative to your assets directories ('css_dir' and 'js_dir').
		 * No trailing slash!.
		 *
		 * @var string
		 */
		//'pipeline_dir' => 'min',

		/**
		 * Enable pipelined assets compression with Gzip.
		 * Use only if your webserver supports Gzip HTTP_ACCEPT_ENCODING.
		 * Set to true to use the default compression level.
		 * Set an integer between 0 (no compression) and 9 (maximum compression) to choose compression level.
		 *
		 * @var bool|integer
		 */
		'pipeline_gzip' => env('APP_ENV', 'production') == 'production',

		/**
		 * Closure used by the pipeline to fetch assets.
		 *
		 * Useful when file_get_contents() function is not available in your PHP
		 * instalation or when you want to apply any kind of preprocessing to
		 * your assets before they get pipelined.
		 *
		 * The closure will receive as the only parameter a string with the path/URL of the asset and
		 * it should return the content of the asset file as a string.
		 *
		 * @var Closure
		 */
		//'fetch_command' => function ($asset) {return preprocess(file_get_contents($asset));},

		/**
		 * Available collections.
		 * Each collection is an array of assets.
		 * Collections may also contain other collections.
		 *
		 * @var array
		 */
		'collections' => array(
			/* Chart collection: assets needed for rendering charts, whether in the admin editor
			 * or when displayed in the public viewer for users. */
			'chart-css' => [		
		        'libs/bootstrap.css',
		        'libs/font-awesome.css',
		        'libs/bootstrap-chosen.css',
		        'libs/nv.d3.css',

		        'chart.css'
		    ],

		    'chart-js' => [
		    	'libs/modernizr-custom.js',
		        'libs/jquery-1.11.3.js',
		        'libs/papaparse.js',
		        'libs/d3.js',
		        'libs/nv.d3.js',
		        'libs/d3.v4.js',
		        'libs/d3.labeler.js',
		        'libs/saveSvgAsPng.js',
		        'libs/topojson.js',
		        'libs/datamaps.js',
		        'libs/underscore.js',
		        'libs/underscore.string.js',
		        'libs/backbone.js',
		        'libs/bootstrap.min.js',
		        'libs/chosen.jquery.js',
		        'libs/colorbrewer.js',
		        'libs/jquery.lazyloadxt.extra.js',
		        'libs/async.js',
		        'libs/js.cookie.js',

		        'owid.js',
		        'app/owid.colorbrewer.js',

		        'app/constants.js',
		        'app/App.Utils.js',
		        'app/App.Models.ChartModel.js',
		        'app/App.Models.MapModel.js',
		        'app/owid.models.mapdata.js',
		        'app/App.Models.VariableData.js',
		        'app/App.Models.ChartData.js',
		        'app/App.Models.Colors.js',
		        'app/App.Views.Chart.Header.js',
		        'app/App.Views.Chart.Footer.js',
		        'app/owid.view.tabSelector.js',
		        'app/owid.view.tooltip.js',
		        'app/owid.view.scaleSelectors.js',
		        'app/owid.view.scatter.js',
		        'app/App.Views.Chart.Legend.js',
		        'app/App.Views.Chart.ChartTab.js',
		        'app/App.Views.Chart.DataTab.js',
		        'app/App.Views.Chart.SourcesTab.js',

		        'app/owid.data.world.js',
		        'app/App.Views.Chart.Map.MapControls.js',
		        'app/App.Views.Chart.Map.PlayPauseControl.js',
		        'app/App.Views.Chart.Map.TimelineControl.js',
		        'app/App.Views.Chart.Map.ButtonsControl.js',
		        'app/App.Views.Chart.Map.TimelineControls.js',
		        'app/App.Views.Chart.Map.Projections.js',
		        'app/App.Views.Chart.Map.Legend.js',
		        'app/App.Views.Chart.MapTab.js',

		        'app/App.Views.ChartURL.js',
		        'app/App.Views.Export.js',
		        'app/App.Views.DebugHelper.js',
		        'app/App.Views.ChartView.js',		        
		        'app/ChartApp.js'		    
			],

			'chart' => [
				'chart-css',
				'chart-js'
			],

			/* Admin collection: assets used everywhere in the authed part of the site. */
			'admin-css' => [
				'chart-css',

		        'libs/AdminLTE.min.css',
		        'libs/datepicker3.css',
		        'libs/_all-skins.min.css',
		        'libs/ion.rangeSlider.css',
		        'libs/ion.rangeSlider.skinFlat.css',
		        'libs/bootstrap3-wysihtml5.css',

		        'admin.css',
		    ],

		    'admin-js' => [
		    	'chart-js',

		        'libs/bootstrap-datepicker.js',
		        'libs/admin-lte-app.min.js',
		        'libs/ion.rangeSlider.min.js',
		        'libs/jquery.nestable.js',
		        'libs/bootstrap3-wysihtml5.all.min.js',
		        'libs/jquery.stickytabs.js',
		        'libs/jquery.timeago.js',
		      
		        'admin.js',

	            'app/App.Models.ChartVariableModel.js',
	            'app/App.Models.EntityModel.js',

	            'app/App.Collections.SearchDataCollection.js',
	            'app/App.Collections.AvailableEntitiesCollection.js',

	            'app/App.Views.UI.SelectVarPopup.js',
	            'app/App.Views.UI.SettingsVarPopup.js',
	            'app/App.Views.UI.ColorPicker.js',

	            'app/App.Views.Form.BasicTabView.js',
	            'app/App.Views.Form.ChartTypeSectionView.js',
	            'app/App.Views.Form.AddDataSectionView.js',
	            'app/App.Views.Form.EntitiesSectionView.js',
	            'app/App.Views.Form.TimeSectionView.js',            
	            'app/App.Views.Form.DataTabView.js',
	            'app/App.Views.Form.AxisTabView.js',
	            'app/App.Views.Form.StylingTabView.js',
	            'app/App.Views.Form.ExportTabView.js',
	            'app/App.Views.Form.MapColorSection.js',
	            'app/App.Views.Form.MapTabView.js',
	            'app/App.Views.Form.SaveButtons.js',
	            'app/App.Views.FormView.js',
	            'app/App.Views.Form.js',

	            'app/FormApp.js'		        
			],

			/* Importer collection: assets specific to the importer part of the admin. */
			'importer' => [
				'libs/jszip.js',
				'libs/xlsx.js',
		        'libs/papaparse.js',
		        'libs/moments.min.js',
		        'app/App.Utils.js',
		        'app/App.Models.ChartModel.js',        
		        'app/App.Models.Import.DatasetModel.js',
		        'app/App.Models.Importer.js',
		        'app/App.Views.UI.ImportProgressPopup.js',
		        'app/App.Views.Import.SourceSelector.js',
		        'app/App.Views.Import.ChooseDatasetSection.js',
		        'app/App.Views.Import.VariablesSection.js',
		        'app/App.Views.Import.CategorySection.js',
		        'app/App.Views.ImportView.js',
		        'app/App.Views.Import.js',
		        'app/ImportApp.js'
			],

			'admin' => [
				'admin-css',
				'admin-js',
				'importer'
			],

		),

		/**
		 * Preload assets.
		 * Here you may set which assets (CSS files, JavaScript files or collections)
		 * should be loaded by default even if you don't explicitly add them on run time.
		 *
		 * @var array
		 */
		//'autoload' => array('jquery-cdn'),

	], // End of default group
];
