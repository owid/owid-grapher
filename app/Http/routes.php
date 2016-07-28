<?php

/*
|--------------------------------------------------------------------------
| Application Routes
|--------------------------------------------------------------------------
|
| Here is where you can register all of the routes for an application.
| It's a breeze. Simply tell Laravel the URIs it should respond to
| and give it the controller to call when that URI is requested.
|
*/

Route::model( 'entities', 'Entity' );
Route::model( 'sources', 'Source' );
Route::model( 'datasets', 'Dataset' );
Route::model( 'variables', 'Variable' );
Route::model( 'values', 'DataValue' );
Route::model( 'charts', 'Chart' );
Route::model( 'chartTypes', 'ChartTypes' );
Route::model( 'categories', 'DatasetCategory' );
Route::model( 'subcategories', 'DatasetSubcategory' );
Route::model( 'tags', 'DatasetTag' );
Route::model( 'apiKeys', 'ApiKey' );
Route::model( 'logos', 'Logo' );

Route::group(['middleware' => ['basic', 'session', 'auth']], function()
{
	Route::resource( 'entities', 'EntitiesController' );
	Route::resource( 'sources', 'SourcesController' );
	Route::get('datasets/{dataset}.json', 'DatasetsController@showJson');
	Route::resource( 'datasets', 'DatasetsController' );
	Route::post('variables/{variable}/batchDestroy', [ 'as' => 'valuesBatchDestroy', 'uses' => 'VariablesController@batchDestroy' ]);
	Route::resource( 'variables', 'VariablesController' );
	Route::resource( 'values', 'ValuesController' );
	Route::post('charts/{id}/star', 'ChartsController@star');
	Route::post('charts/{id}/unstar', 'ChartsController@unstar');
	Route::resource( 'charts', 'ChartsController' );
	Route::resource( 'chartTypes', 'ChartTypesController' );
	Route::resource( 'categories', 'CategoriesController' );
	Route::resource( 'subcategories', 'SubcategoriesController' );
	Route::resource( 'tags', 'TagsController' );
	Route::resource( 'licenses', 'LicensesController' );
	Route::resource( 'apiKeys', 'ApiKeysController' );
	Route::resource( 'logos', 'LogosController' );

	//Route::resource( 'dataValues', 'DataValuesController' );
	Route::bind( 'entities', function($value, $route) {
		return App\Entity::whereId($value)->first();
	});
	Route::bind( 'sources', function($value, $route) {
		return App\Source::whereId($value)->first();
	});
	Route::bind( 'datasets', function($value, $route) {
		return App\Dataset::whereId($value)->first();
	});
	Route::bind( 'variables', function($value, $route) {
		return App\Variable::whereId($value)->first();
	});
	Route::bind( 'values', function($value, $route) {
		return App\DataValue::whereId($value)->first();
	});
	Route::bind( 'charts', function($value, $route) {
		return App\Chart::whereId($value)->first();
	});
	Route::bind( 'chartTypes', function($value, $route) {
		return App\ChartType::whereId($value)->first();
	});
	Route::bind( 'categories', function($value, $route) {
		return App\DatasetCategory::whereId($value)->first();
	});
	Route::bind( 'subcategories', function($value, $route) {
		return App\DatasetSubcategory::whereId($value)->first();
	});
	Route::bind( 'tags', function($value, $route) {
		return App\DatasetTag::whereId($value)->first();
	});
	Route::bind( 'licenses', function($value, $route) {
		return App\License::whereId($value)->first();
	});
	Route::bind( 'apiKeys', function($value, $route) {
		return App\ApiKey::whereId($value)->first();
	});
	Route::bind( 'logos', function($value, $route) {
		return App\Logo::whereId($value)->first();
	});

	Route::get( 'import', [ 'as' => 'import', 'uses' => 'ImportController@index' ] );
	Route::post( 'import/store', 'ImportController@store' );
	Route::post('import/variables', 'ImportController@variables');

	Route::get( 'entityIsoNames/validate', 'EntitiesController@validateISO' );
	
	//Route::get( 'logo', [ 'as' => 'logo', 'uses' => 'LogoController@index' ] );
	//Route::post('logo/upload', 'LogoController@upload');

	Route::post( 'inputfile/import', 'ImportController@inputfile' );
	Route::post( 'source/import', 'ImportController@source' );
	Route::post( 'dataset/import', 'ImportController@dataset' );
	Route::post( 'variable/import', 'ImportController@variable' );
	Route::post( 'entity/import', 'ImportController@entity' );
	
	Route::get( 'sourceTemplate', [ 'as' => 'sourceTemplate', 'uses' => 'SourceTemplateController@edit' ] );
	Route::patch( 'sourceTemplate', [ 'as' => 'sourceTemplate.update', 'uses' => 'SourceTemplateController@update' ] );
});

Route::group(['middleware' => ['basic', 'session']], function() {
	Route::get('/', 'HomeController@index');

	Route::get('login', 'Auth\AuthController@getLogin');
	Route::post('login', 'Auth\AuthController@postLogin')->name('login');
	Route::get('logout', 'Auth\AuthController@logout')->name('logout');

    Route::controllers([
        'auth' => 'Auth\AuthController',
        'password' => 'Auth\PasswordController',
    ]);
});

Route::group(['middleware' => ['basic']], function () {
	//api routes
	Route::group( [ 'prefix' => 'v1', 'before' => 'auth.api_key' ], function() {
		Route::get( '/data', 'ApiController@data' );
		Route::get( '/variables', 'ApiController@variables' );
		Route::get( '/entities', 'ApiController@entities' );
	} );
	Route::get( 'api', 'ApiController@index' );

	Route::get( 'view', 'ViewController@index' );
	Route::get( 'view/{id}', [ 'as' => 'view', 'uses' => 'ViewController@show' ] );
	Route::get( 'testall', 'ViewController@testall' );

	Route::get('data', 'DataController@index');
	Route::get('data/variables/{ids}', 'DataController@variables');
	Route::get('data/exportCSV', 'DataController@exportCSV');
	Route::get('data/config/{id}', 'ChartsController@config');
	Route::get('data/dimensions', [ 'as' => 'dimensions', 'uses' => 'DataController@dimensions' ]);	
	Route::post('data/exportToSvg', [ 'as' => 'exportToSvg', 'uses' => 'DataController@exportToSvg' ]);
	Route::get('data/entities', 'DataController@entities');
	Route::get('data/search', 'DataController@search');
	Route::get('data/times', 'DataController@times');

	Route::get('latest', 'ViewController@latest');
	Route::any('{all}.csv', ['uses' => 'ViewController@exportCSV'])->where('all', '(?!_debugbar).*');
	Route::any('{all}.svg', ['uses' => 'ViewController@exportSVG'])->where('all', '(?!_debugbar).*');	
	Route::any('{all}.png', ['uses' => 'ViewController@exportPNG'])->where('all', '(?!_debugbar).*');
	Route::any('{all}.export', ['uses' => 'ViewController@show'])->where('all', '(?!_debugbar).*');
	Route::any('{all}', ['uses' => 'ViewController@show'])->where('all', '(?!_debugbar).*');
});


Response::macro( 'xml', function($vars, $status = 200, array $header = [], $xml = null, $elName = 'el' ) {
	if( is_null( $xml ) ) {
		$xml = new SimpleXMLElement( '<?xml version="1.0" encoding="UTF-8"?><response/>' );
	}
	foreach( $vars as $key => $value) {
		if( is_array( $value ) ) {
			Response::xml( $value, $status, $header, $xml->addChild( $key ), $elName );
		} else if( is_object( $value ) ) {
			$key = $elName;
			Response::xml( $value, $status, $header, $xml->addChild( $key ), $elName );
		} else {
			$xml->addChild( $key, htmlspecialchars( $value ) );
		}
	}
	if( empty( $header ) ) {
		$header[ 'Content-Type' ] = 'application/xml';
	}
	return Response::make( $xml->asXML(), $status, $header );
} );


/*use App\Chart;
Route::get( '/temp', function() {

	$charts = Chart::all();
	foreach($charts as $chart) {
		$config = json_decode($chart->config);
		echo $chart->id. ': '. $config->{'chart-description'};
		echo '<br />';
	}
	
});*/
