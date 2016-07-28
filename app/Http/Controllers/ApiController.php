<?php namespace App\Http\Controllers;

use DB;
use Input;
use App\Chart;
use App\Variable;
use App\Source;
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
		return "<a href='http://docs.ourworldindataorg.apiary.io/' target='_blank'>Please see documentation on how to use API</a>";
	}

	public function data() {

		$this->logRequestToGa();
		
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
				'entities.id as entityId',
				'entities.name as entityName' )
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

		//store into cache - there is no cache 
		if( !empty( $key ) ) {
			$minutes = 60*24;
			Cache::put( $key, $responseData, $minutes );
		}

		return \Response::$outputFormat( $responseData, 200, [], null, 'data_el' );

	}

	public function variables() {

		$this->logRequestToGa();

		$key = 'api-variables-';
		if( Cache::has( $key ) ) {
			return Cache::get( $key );
		}

		$variables = DB::table( 'variables' )
			->select( 
				'variables.id as id', 
				'variables.name as name', 
				'variables.unit as unit', 
				'variables.description as description', 
				'datasets.name as dataset', 
				'sources.name as source',
				'variable_types.name as type' )
			->leftJoin( 'datasets', 'variables.fk_dst_id', '=', 'datasets.id' )
			->leftJoin( 'sources', 'variables.fk_dsr_id', '=', 'sources.id' )
			->leftJoin( 'variable_types', 'variables.fk_var_type_id', '=', 'variable_types.id' )
			->orderBy( 'id' )
			->get();

		$outputFormat = ( Input::has( 'format' ) && Input::get( 'format' ) === 'xml' )? 'xml': 'json';
		$responseData = [ 'success' => 'true', 'data' => $variables ];

		//store into cache - there is no cache 
		if( !empty( $key ) ) {
			$minutes = 60*24;
			Cache::put( $key, $responseData, $minutes );
		}

		return \Response::$outputFormat( $responseData, 200, [], null, 'variable' );

	}

	public function entities() {

		$this->logRequestToGa();

		$key = 'api-entities-';
		if( Cache::has( $key ) ) {
			return Cache::get( $key );
		}

		$entities = DB::table( 'entities' )
			->select( 
				'entities.id as id', 
				'entities.code as code', 
				'entities.name as name', 
				'entity_types.name as type' )
			->orderBy( 'id' )
			->get();

		$outputFormat = ( Input::has( 'format' ) && Input::get( 'format' ) === 'xml' )? 'xml': 'json';
		$responseData = [ 'success' => 'true', 'data' => $entities ];

		//store into cache - there is no cache 
		if( !empty( $key ) ) {
			$minutes = 60*24;
			Cache::put( $key, $responseData, $minutes );
		}

		return \Response::$outputFormat( $responseData, 200, [], null, 'entity' );

	}

}
