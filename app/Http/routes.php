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
Route::model( 'variables', 'Variable' );
Route::model( 'charts', 'Chart' );

//Route::get('/', 'WelcomeController@index');
Route::get('/', 'HomeController@index');
Route::get('/home', 'HomeController@index');

Route::controllers([
	'auth' => 'Auth\AuthController',
	'password' => 'Auth\PasswordController',
]);

Route::get('/logout', [ 'as' => 'logout', 'uses' => 'Auth\AuthController@getLogout' ] );

Route::group(['middleware' => 'auth'], function()
{
	Route::resource( 'entities', 'EntitiesController' );
	Route::resource( 'variables', 'VariablesController' );
	Route::resource( 'charts', 'ChartsController' );
	//Route::resource( 'dataValues', 'DataValuesController' );
	Route::bind( 'entities', function($value, $route) {
		return App\Entity::whereId($value)->first();
	});
	Route::bind( 'variables', function($value, $route) {
		return App\Variable::whereId($value)->first();
	});
	Route::bind( 'charts', function($value, $route) {
		return App\Chart::whereId($value)->first();
	});

	Route::get( 'import', [ 'as' => 'import', 'uses' => 'ImportController@index' ] );
	Route::post( 'import/store', 'ImportController@store' );

	Route::get( 'view', 'ViewController@index' );
	Route::get( 'view/{id}', [ 'as' => 'view', 'uses' => 'ViewController@show' ] );

});

