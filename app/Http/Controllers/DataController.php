<?php namespace App\Http\Controllers;

use DB;
use Input;
use App\Variable;
use App\TimeType;
use App\Datasource;
use App\License;

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

		set_time_limit( 600 ); 
		ini_set('memory_limit', '256M');
		$data = array();
		
		//extra array for storing values for export
		$times = array();
		$datasourcesIdsArr = array();

		if( !Input::has( 'dimensions' ) ) {
			return "";
		}

		$dimensionsInput = Input::get( 'dimensions' );
		$dimensions = json_decode( $dimensionsInput );

		$chartType = Input::get( 'chartType' );
		//there's special setting for linechart
		$isLineChart = ( $chartType == "1" )? true: false;

		//filtering by entities?
		$selectedCountriesIds = Input::get( "selectedCountries" );

		//filtering by time?
		$chartTime = Input::get( "chartTime" );

		//find out how many variables we have 
		$groupByEntity = (!$isLineChart || count( $dimensions ) == 1)? true: false;

		$timeType = '';

		if( $groupByEntity ) {
			$entities = array();
			$dataByEntity = array();
			$dataByEntityTime = array();
		} else {
			$variables = array();
			$dataByVariable = array();
			$dataByVariableTime = array();
		}

		/**
		 * 1) get data into variable
		 **/

		$variablesData = [];
		foreach( $dimensions as $dimension ) {

			$id = $dimension->variableId;
			//use query builder instead of eloquent
			$variableQuery = DB::table( 'data_values' )
				->join( 'entities', 'data_values.fk_ent_id', '=', 'entities.id' )
				->join( 'times', 'data_values.fk_time_id', '=', 'times.id' )
				->where( 'data_values.fk_var_id', $id );

			//are we filtering based on entity selection?
			if( !empty( $selectedCountriesIds ) && count( $selectedCountriesIds ) > 0 ) {
				$variableQuery->whereIn( 'data_values.fk_ent_id', $selectedCountriesIds );
			}
			//are we filtering based on time selection?
			if( !empty( $chartTime ) && count( $chartTime ) > 1 ) {
				$minTime = $chartTime[0];
				$maxTime = $chartTime[1];
				$variableQuery->where( 'times.date', '>=', $minTime );
				$variableQuery->where( 'times.date', '<=', $maxTime );
			}	

			$variableData = $variableQuery->get();
			$variablesData[ $id ] = $variableData;
		
		}

		


		foreach( $dimensions as $dimension ) {
			
			$id = $dimension->variableId;
			$property = $dimension->property;
			
			//use query builder instead of eloquent
			/*$variableQuery = DB::table( 'data_values' )
				->join( 'entities', 'data_values.fk_ent_id', '=', 'entities.id' )
				->join( 'times', 'data_values.fk_time_id', '=', 'times.id' )
				->where( 'data_values.fk_var_id', $id );

			//are we filtering based on entity selection?
			if( !empty( $selectedCountriesIds ) && count( $selectedCountriesIds ) > 0 ) {
				$variableQuery->whereIn( 'data_values.fk_ent_id', $selectedCountriesIds );
			}
			//are we filtering based on time selection?
			if( !empty( $chartTime ) && count( $chartTime ) > 1 ) {
				$minTime = $chartTime[0];
				$maxTime = $chartTime[1];
				$variableQuery->where( 'times.date', '>=', $minTime );
				$variableQuery->where( 'times.date', '<=', $maxTime );
			}	

			$variableData = $variableQuery->get();*/

			$variableData = $variablesData[ $id ];
			
			//selectedCountries
			if( $groupByEntity ) {
			
				//group variable data by entities
				$i = 0;
				$oldEntityId = -1;
				foreach( $variableData as $datum ) {

					$entityId = $datum->fk_ent_id;
					//check if new entity and we need to reset cycle
					if( $oldEntityId != $entityId ) {
						$i = 0;
					}
					$oldEntityId = $entityId;
					
					//do we have already object for that entity
					if( !array_key_exists($entityId, $dataByEntity) ) {
						$dataByEntity[ $entityId ] = array( 
							"id" => intval($entityId),
							"key" => $datum->name,
							"values" => []
						);
					}

					//$dataByEntity[ $entityId ][ "values" ][] = array( "x" => floatval($datum->date), "y" => floatval($datum->value) );
					
					//is it first property being saved for given property
					if( !array_key_exists( $i, $dataByEntity[ $entityId ][ "values" ] ) ) {
						$dataByEntity[ $entityId ][ "values" ][ $i ] = [];// "x" => floatval($datum->label), "y" => floatval($datum->value) ];
					}
					//store value
					$dataByEntity[ $entityId ][ "values" ][ $i ][ $property ] = floatval( $datum->value );
					//if is linechart, store time into x axis
					if( $isLineChart ) {
						$dataByEntity[ $entityId ][ "values" ][ $i ][ "x" ] = floatval( $datum->date );
					}
					$i++;

					//store time type if not stored
					if( empty( $timeType ) ) {
						$timeType = TimeType::find( $datum->fk_ttype_id )->name; 
					}

					//store for the need of export 
					if( !array_key_exists($entityId, $dataByEntityTime) ) {
						$dataByEntityTime[ $entityId ] = [];
						$entities[ $entityId ] = $datum->name; 
					}
					$dataByEntityTime[ $entityId ][ $datum->label ] = $datum->value;
					$times[ $datum->label ] = true;
					$datasourcesIdsArr[ $datum->fk_dsr_id ] = true;

				}

			} else {

				//multivariables
				$dataByVariable[ "id-".$id ] = array( 
					"id" => $id,
					"key" => $dimension->variableId,
					"values" => []
				);

				foreach( $variableData as $datum ) {
					$dataByVariable[ "id-".$id ][ "values" ][] = array( "x" => floatval($datum->date), "y" => floatval($datum->value) );
					$times[$datum->label] = true;
					$datasourcesIdsArr[ $datum->fk_dsr_id ] = true;

					//store time type if not stored
					if( empty( $timeType ) ) {
						$timeType = TimeType::find( $datum->fk_ttype_id )->name; 
					}

					//store for the need of export 
					if( !array_key_exists($dimension->variableId, $dataByVariableTime) ) {
						$dataByVariableTime[ $dimension->variableId ] = [];
						$variables[ $dimension->variableId ] = $datum->fk_var_id; 
					}
					$dataByVariableTime[ $dimension->variableId ][ $datum->label ] = $datum->value;

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

		//get all necessary info for datasources
		$datasourcesIds = array_keys( $datasourcesIdsArr );
		$datasources = Datasource::findMany( $datasourcesIds );

		//process data to csv friendly format
		$timeKeys = array_keys( $times );
		//sort timeKeys by time
		usort( $timeKeys, function ($a, $b) { if ( $a==$b ) return 0; else return ($a > $b) ? 1 : -1; });
		
		//get all the licence information
		$license = License::find( 1 )->first();

		//construct first row
		$firstRow = $timeKeys;
		array_unshift( $firstRow, "Times" ); 

		$exportData = [ $firstRow ];

		if( $groupByEntity ) {

			foreach( $dataByEntityTime as $entityId=>$entityData ) {
				//first insert name
				$entityName = ( array_key_exists($entityId, $entities) )? $entities[$entityId]: "";
				$rowData = [ $entityName ];
				//then insert times
				foreach( $timeKeys as $time ) {
					//does value exist for given time and entity?
					if( !array_key_exists($time, $entityData) ) {
						//insert blank value
						$rowData[] = ""; 
					} else {
						//value exists
						$rowData[] = $entityData[$time];
					} 
				}
				$exportData[] = $rowData;
			}

		} else {

			foreach( $dataByVariableTime as $variableId=>$variableData ) {
				//first insert name
				$variableName = ( array_key_exists($variableId, $variables) )? $variables[$variableId]: "";
				$rowData = [ $variableName ];
				//then insert times
				foreach( $timeKeys as $time ) {
					//does value exist for given time and entity?
					if( !array_key_exists($time, $variableData) ) {
						$rowData[] = "x"; 
					} else {
						//value exists
						$rowData[] = $variableData[$time];
					} 
				}
				$exportData[] = $rowData;
			}

		}

		if( $request->ajax() ) {

			return [ 'success' => true, 'data' => $data, 'datasources' => $datasources, 'timeType' => $timeType, 'exportData' => $exportData, 'license' => $license ];

		} else {

			if( Input::has( 'export' ) && Input::get( 'export' ) == 'csv' ) {
				
				//http://localhost:8888/oxford/our-world-in-data-chart-builder/public/data/dimensions?dimensions=%5B%7B%22variableId%22%3A%221%22%2C%22property%22%3A%22y%22%2C%22name%22%3A%22Y+axis%22%7D%5D
				//return $data;
				return $this->downloadCsv( $exportData );
			
			} else {

				//not ajax request, nor csv export, just spit out whatever is in data
				return $data;

			}

		}

	}

	public function downloadCsv( $data ) {

		$fileName = 'data-' .date('Y-m-d H:i:s'). '.csv';
		$headers = [
			'Cache-Control'	=>	'must-revalidate, post-check=0, pre-check=0',
			'Content-type' => 'text/csv',
			'Content-Disposition' => 'attachment; filename=' .$fileName,
			'Expires' => '0',
			'Pragma' => 'public'
		];

		$csv = \League\Csv\Writer::createFromFileObject(new \SplTempFileObject());
		foreach($data as $datum) {
            $csv->insertOne($datum);
        }
        $csv->output( $fileName );
        //have to die out, for laravel not to append non-sense
		die();
	
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
			->select( 'times.id', 'times.date', 'times.label' )
			->join( 'times', 'data_values.fk_time_id', '=', 'times.id' )
			->whereIn( 'data_values.fk_var_id', $variableIds )
			->groupBy( 'date' )
			->get();

		$data = $timesData;

		if( $request->ajax() ) {

			return ['success' => true, 'data' => $data ];

		} else {
			//not ajax request, just spit out whatever is in data
			return $data;
		}

	}

	public function exportToSvg( Request $request ) {
		
		$svg = 'Export to svg failed';
		if( Input::has( 'export-svg' ) ) {
			$svg = $request->input( 'export-svg' );
		} 
		$type = 'image/svg+xml';
		return response( $svg )->header('Content-Type',$type);
	}


}
