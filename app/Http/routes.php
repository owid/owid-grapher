<?php

use App\ApiKey;

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
Route::model( 'datasources', 'Datasource' );
Route::model( 'datasets', 'Dataset' );
Route::model( 'variables', 'Variable' );
Route::model( 'values', 'DataValue' );
Route::model( 'charts', 'Chart' );
Route::model( 'chartTypes', 'ChartTypes' );
Route::model( 'categories', 'DatasetCategory' );
Route::model( 'subcategories', 'DatasetSubcategory' );
Route::model( 'tags', 'DatasetTag' );
Route::model( 'apiKeys', 'ApiKey' );

//Route::get('/', 'WelcomeController@index');
Route::get('/', 'HomeController@index');
Route::get('/home', 'HomeController@index');

Route::controllers([
	'auth' => 'Auth\AuthController',
	'password' => 'Auth\PasswordController',
]);

//api routes
Route::group( [ 'prefix' => 'api/v1', 'before' => 'auth.api_key' ], function() {
	Route::get( '/data', 'ApiController@data' );
	Route::get( '/variables', 'ApiController@variables' );
	Route::get( '/entities', 'ApiController@entities' );
} );
Route::get( 'api', 'ApiController@index' );

Route::filter( 'auth.api_key', function( $route, $request ) {

	$apiKey = ( Input::has( 'api_key' ) )? Input::get( 'api_key' ): '';

	$errorMessage = '';
	if( empty( $apiKey ) ) {

		$errorMessage = 'All API calls have to be made with an api_key paramater.';
	
	} else {

		$validKeys = ApiKey::where( 'value', $apiKey )->get();
		if( $validKeys->isEmpty() ) {
			$errorMessage = 'Invalid API key.';
		}

	}

	if( !empty( $errorMessage ) ) {
		
		$response = Response::json([
			'error' => true,
			'message' => $errorMessage,
			'code' => 401],
			401
		);

		$response->header('Content-Type', 'application/json');
		return $response;
	}

} );



Route::get('/logout', [ 'as' => 'logout', 'uses' => 'Auth\AuthController@getLogout' ] );

Route::group(['middleware' => 'auth'], function()
{
	Route::resource( 'entities', 'EntitiesController' );
	Route::resource( 'datasources', 'DatasourcesController' );
	Route::resource( 'datasets', 'DatasetsController' );
	Route::delete( 'variables/batchDestroy', ['as' => 'valuesBatchDestroy' ,'uses' => 'VariablesController@batchDestroy'] );
	Route::resource( 'variables', 'VariablesController' );
	Route::resource( 'values', 'ValuesController' );
	Route::resource( 'charts', 'ChartsController' );
	Route::resource( 'chartTypes', 'ChartTypesController' );
	Route::resource( 'categories', 'CategoriesController' );
	Route::resource( 'subcategories', 'SubcategoriesController' );
	Route::resource( 'tags', 'TagsController' );
	Route::resource( 'licenses', 'LicensesController' );
	Route::resource( 'apiKeys', 'ApiKeysController' );

	//Route::resource( 'dataValues', 'DataValuesController' );
	Route::bind( 'entities', function($value, $route) {
		return App\Entity::whereId($value)->first();
	});
	Route::bind( 'datasources', function($value, $route) {
		return App\Datasource::whereId($value)->first();
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

	Route::get( 'import', [ 'as' => 'import', 'uses' => 'ImportController@index' ] );
	Route::post( 'import/store', 'ImportController@store' );

	Route::get( 'entityIsoNames/validateData', 'EntityIsoNamesController@validateData' );
	
	Route::get( 'logo', [ 'as' => 'logo', 'uses' => 'LogoController@index' ] );
	Route::post('logo/upload', 'LogoController@upload');

	Route::post( 'inputfile/import', 'ImportController@inputfile' );
	Route::post( 'datasource/import', 'ImportController@datasource' );
	Route::post( 'dataset/import', 'ImportController@dataset' );
	Route::post( 'variable/import', 'ImportController@variable' );
	Route::post( 'entity/import', 'ImportController@entity' );

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

Route::get( 'view', 'ViewController@index' );
Route::get( 'view/{id}', [ 'as' => 'view', 'uses' => 'ViewController@show' ] );

Route::get( 'data', 'DataController@index' );
Route::get( 'data/config/{id}', 'ChartsController@config' );
Route::get( 'data/dimensions', [ 'as' => 'dimensions', 'uses' => 'DataController@dimensions' ] );
Route::post( 'data/exportToSvg', [ 'as' => 'exportToSvg', 'uses' => 'DataController@exportToSvg' ] );
Route::get( 'data/entities', 'DataController@entities' );
Route::get( 'data/search', 'DataController@search' );
Route::get( 'data/times', 'DataController@times' );
Route::get( 'data/matchIsoName', 'DataController@matchIsoName' );
