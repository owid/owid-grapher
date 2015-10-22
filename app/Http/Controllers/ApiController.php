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

		return \Response::$outputFormat( $responseData, 200, [], null, 'data_el' );

	}

	public function variables() {

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

		return \Response::$outputFormat( $responseData, 200, [], null, 'variable' );

	}

	public function entities() {

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

		return \Response::$outputFormat( $responseData, 200, [], null, 'entity' );

	}

	/*public function entities( Request $request ) {

		$data = array();
		if( !Input::has( 'variableIds' ) ) {
			return [];
		}
		
		$variableIdsInput = Input::get( 'variableIds' );
		$variableIds = explode( ',', $variableIdsInput );

		//use query builder instead of eloquent
		$entitiesData = DB::table( 'data_values' )
			->select( 'entities.id', 'entities.name' )
			->join( 'entities', 'data_values.fk_ent_id', '=', 'entities.id' )
			->whereIn( 'data_values.fk_var_id', $variableIds )
			->groupBy( 'name' )
			->get();

		$data = $entitiesData;

		if( $request->ajax() ) {

			return ['success' => true, 'data' => $data ];

		} else {
			//not ajax request, just spit out whatever is in data
			return $data;
		}

	}*/


}
