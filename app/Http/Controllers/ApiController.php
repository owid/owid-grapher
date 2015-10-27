<?php namespace App\Http\Controllers;

use DB;
use Input;
use App\Chart;
use App\Variable;
use App\TimeType;
use App\Datasource;
use App\License;
use App\EntityIsoName;

use App\Http\Requests;
use App\Http\Controllers\Controller;

use Illuminate\Http\Request;

use Cache;

class ApiController extends Controller {

	/**
	 * Display a listing of the resource.
	 *
	 * @return Response
	 */
	public function index() {
		return "Controller for API";
	}

	public function data() {

		$key = 'api-data-' . Input::get( 'variables' );
		if( Input::has( 'entities' ) ) {
			$key = '-entities-' . Input::get( 'entities' );
		}
		if( Input::has( 'from' ) ) {
			$key = '-from-' . Input::get( 'from' );
		}
		if( Input::has( 'to' ) ) {
			$key = '-to-' . Input::get( 'to' );
		}

		if( Cache::has( $key ) ) {
			return Cache::get( $key );
		}

		//params
		$variableIdsInput = Input::get( 'variables' );
		$variableIds = explode( ',', $variableIdsInput );
		
		$query = DB::table( 'data_values' )
			->select( 
				'data_values.id as id', 
				'data_values.value as value', 
				'variables.name as variable', 
				'times.startDate as from',
				'times.endDate as to',
				'entities.id as entityId' )
			->leftJoin( 'variables', 'data_values.fk_var_id', '=', 'variables.id' )
			->leftJoin( 'entities', 'data_values.fk_ent_id', '=', 'entities.id' )
			->leftJoin( 'times', 'data_values.fk_time_id', '=', 'times.id' )
			->whereIn( 'data_values.fk_var_id', $variableIds );

		if( Input::has( 'entities' ) ) {
			$entitiesIdsInput = Input::get( 'entities' );
			$entitiesIds = explode( ',', $entitiesIdsInput );
			$query = $query->whereIn( 'data_values.fk_ent_id', $entitiesIds );
		}
		if( Input::has( 'from' ) ) {
			$query = $query->where( 'times.startDate', '>=', Input::get( 'from' ) );
		}
		if( Input::has( 'to' ) ) {
			$query = $query->where( 'times.endDate', '<=', Input::get( 'to' ) );
		}

		$data = $query->get();

		$outputFormat = ( Input::has( 'format' ) && Input::get( 'format' ) === 'xml' )? 'xml': 'json';
		$responseData = [ 'success' => 'true', 'data' => $data ];

		$this->logRequestToGa();

		//store into cache - there is no cache 
		if( !empty( $key ) ) {
			$minutes = 60*24;
			Cache::put( $key, $responseData, $minutes );
		}

		return \Response::$outputFormat( $responseData, 200, [], null, 'data_el' );

	}

	public function variables() {

		$key = 'api-variables-';

		$variables = DB::table( 'variables' )
			->select( 
				'variables.id as id', 
				'variables.name as name', 
				'variables.unit as unit', 
				'variables.description as description', 
				'datasets.name as dataset', 
				'datasources.name as datasource',
				'variable_types.name as type' )
			->leftJoin( 'datasets', 'variables.fk_dst_id', '=', 'datasets.id' )
			->leftJoin( 'datasources', 'variables.fk_dsr_id', '=', 'datasources.id' )
			->leftJoin( 'variable_types', 'variables.fk_var_type_id', '=', 'variable_types.id' )
			->orderBy( 'id' )
			->get();

		$outputFormat = ( Input::has( 'format' ) && Input::get( 'format' ) === 'xml' )? 'xml': 'json';
		$responseData = [ 'success' => 'true', 'data' => $variables ];

		$this->logRequestToGa();

		//store into cache - there is no cache 
		if( !empty( $key ) ) {
			$minutes = 60*24;
			Cache::put( $key, $responseData, $minutes );
		}

		return \Response::$outputFormat( $responseData, 200, [], null, 'variable' );

	}

	public function entities() {

		$key = 'api-entities-';

		$entities = DB::table( 'entities' )
			->select( 
				'entities.id as id', 
				'entities.code as code', 
				'entities.name as name', 
				'entity_types.name as type' )
			->leftJoin( 'entity_types', 'entities.fk_ent_t_id', '=', 'entity_types.id' )
			->orderBy( 'id' )
			->get();

		$outputFormat = ( Input::has( 'format' ) && Input::get( 'format' ) === 'xml' )? 'xml': 'json';
		$responseData = [ 'success' => 'true', 'data' => $entities ];

		$this->logRequestToGa();

		//store into cache - there is no cache 
		if( !empty( $key ) ) {
			$minutes = 60*24;
			Cache::put( $key, $responseData, $minutes );
		}

		return \Response::$outputFormat( $responseData, 200, [], null, 'entity' );

	}

	public function logRequestToGa() {

		//this is disabled as not working in php 5.4
		return;

		//api key
		$clientId = Input::get( 'api_key' );
		
		//ga
		$gamp = \GAMP::setClientId( $clientId );

		$fullUrl = \Request::fullUrl();
		$root = \Request::root();
		$url = str_replace( $root,'', $fullUrl ); 
		
		$gamp->setDocumentPath( $url );
		$gamp->sendPageview();

	} 

}
