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
		
		if( !Input::has( 'dimensions' ) ) {
			return false;
		}

		$dimensionsInput = Input::get( 'dimensions' );
		$dimensions = json_decode( $dimensionsInput );

		foreach( $dimensions as $dimension ) {
			
			$id = $dimension->variableId;
			$property = $dimension->property;

			//use query builder instead of eloquent
			$variableData = DB::table( 'data_values' )
				->join( 'entities', 'data_values.fk_ent_id', '=', 'entities.id' )
				->join( 'times', 'data_values.fk_time_id', '=', 'times.id' )
				->where( 'data_values.fk_var_id', $id )
				->get();

			//group variable data by entities
			foreach( $variableData as $i=>$datum ) {

				$entityId = $datum->fk_ent_id;
				
				//do we have already object for that entity
				if( !array_key_exists($entityId, $data) ) {
					$data[ $entityId ] = array( 
						"id" => $entityId,
						"key" => $datum->name,
						"values" => []
					);
				}

				//do we have already array for that value
				if( !array_key_exists( $i, $data[ $entityId ][ "values" ] ) ) {
					$data[ $entityId ][ "values" ][ $i ] = [];
				}
				$values = $data[ $entityId ][ "values" ][ $i ];
				$values[ $property ] = $datum->value;
				$data[ $entityId ][ "values" ][ $i ] = $values; 

			}

		}

		//sanity check, need to have all property values
		foreach( $data as $entityId=>$entityData ) {

			if( !empty($entityData) && !empty($entityData->values) ) {
				foreach( $entityData->values as &$value ) {

					if( !array_key_exists("x",$value) ) {
						$value["x"] = 0;
					}				
					if( !array_key_exists("y",$value) ) {
						$value["y"] = 0;
					}
					
				}	
			}
			
			
		}

				
		if( $request->ajax() ) {

			return ['success' => true, 'data' => $data ];

		} else {
			//not ajax request, just spit out whatever is in data
			return $data;
		}

	}

}
