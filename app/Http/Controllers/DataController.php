<?php namespace App\Http\Controllers;

use DB;
use Input;
use App\Variable;

use App\Http\Requests;
use App\Http\Controllers\Controller;

use Illuminate\Http\Request;

class DataController extends Controller {

	/**
	 * Display a listing of the resource.
	 *
	 * @return Response
	 */
	public function index() {
		return "Controller for data";
	}

	public function dimensions( Request $request ) {

		$data = array();
		$dataByVariable = array();
		$dataByEntity = array();

		if( !Input::has( 'dimensions' ) ) {
			return false;
		}

		$dimensionsInput = Input::get( 'dimensions' );
		$dimensions = json_decode( $dimensionsInput );

		//find out how many variables we have 
		$groupByEntity = ( count( $dimensions ) > 1 )? false: true;

		foreach( $dimensions as $dimension ) {
			
			$id = $dimension->variableId;
			$property = $dimension->property;

			//use query builder instead of eloquent
			$variableData = DB::table( 'data_values' )
				->join( 'entities', 'data_values.fk_ent_id', '=', 'entities.id' )
				->join( 'times', 'data_values.fk_time_id', '=', 'times.id' )
				//->join( 'variables', 'data_values.fk_var_id', '=', 'variables.id' )
				->where( 'data_values.fk_var_id', $id )
				->get();

			if( $groupByEntity ) {
				
				$dataByEntity = array();

				//group variable data by entities
				foreach( $variableData as $datum ) {

					$entityId = $datum->fk_ent_id;
					
					//do we have already object for that entity
					if( !array_key_exists($entityId, $dataByEntity) ) {
						$dataByEntity[ $entityId ] = array( 
							"id" => intval($entityId),
							"key" => $datum->name,
							"values" => []
						);
					}

					$dataByEntity[ $entityId ][ "values" ][] = array( "x" => floatval($datum->label), "y" => floatval($datum->value) );

					//more complicated case for scatter plot and else
					//do we have already array for that value
					/*if( !array_key_exists( $i, $dataByEntity[ $entityId ][ "values" ] ) ) {
						$dataByEntity[ $entityId ][ "values" ][ $i ] = [ "x" => floatval($datum->label), "y" => floatval($datum->value) ];
					}
					$i++;*/
					/*$values = $data[ $entityId ][ "values" ][ $i ];
					$values[ $property ] = $datum->value;
					$data[ $entityId ][ "values" ][ $i ] = $values;*/

				}

			} else {

				//multivariables
				$dataByVariable[ "id-".$id ] = array( 
					"id" => $id,
					"key" => $dimension->variableId,
					"values" => []
				);

				foreach( $variableData as $datum ) {
					$dataByVariable[ "id-".$id ][ "values" ][] = array( "x" => floatval($datum->label), "y" => floatval($datum->value) );
				}

			}

		}

		if( $groupByEntity ) {
			//convert to array
			foreach( $dataByEntity as $entityData ) {
				$data[] = $entityData;
			}
		} else {
			//convert to array
			foreach( $dataByVariable as $varData ) {
				$data[] = $varData;
			}
		}
	
		if( $request->ajax() ) {

			return ['success' => true, 'data' => $data ];

		} else {
			//not ajax request, just spit out whatever is in data
			return $data;
		}

	}

	public function entities( Request $request ) {


		$data = array();
		if( !Input::has( 'variableIds' ) ) {
			return false;
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

	}

	public function times( Request $request ) {

		$data = array();
		if( !Input::has( 'variableIds' ) ) {
			return false;
		}

		$variableIdsInput = Input::get( 'variableIds' );
		$variableIds = explode( ',', $variableIdsInput );

		//use query builder instead of eloquent
		$timesData = DB::table( 'data_values' )
			->select( 'times.id', 'times.time', 'times.label' )
			->join( 'times', 'data_values.fk_time_id', '=', 'times.id' )
			->whereIn( 'data_values.fk_var_id', $variableIds )
			->groupBy( 'time' )
			->get();

		$data = $timesData;

		if( $request->ajax() ) {

			return ['success' => true, 'data' => $data ];

		} else {
			//not ajax request, just spit out whatever is in data
			return $data;
		}

	}

}
