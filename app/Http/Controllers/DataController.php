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

		//set_time_limit( 600 ); 
		//ini_set('memory_limit', '256M');
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

		//store the longest variable, will be used as main one
		$dimensionsByKey = [];
		$minDataLength = false;
		$mainDimId = false;
		$otherDimIds = [];

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
			//insert data into existing variable
			$dimension->data = $variableData;

			//is shortes variable?
			$dataLen = count( $variableData );
			if( $dataLen > $minDataLength || !$minDataLength ) {
				$minDataLength = $dataLen;
				$mainDimId = $id;
			}
			
		}


		/**
		 * 2) assign data to entities
		 **/

		foreach( $dimensions as $dimension ) {

			$id = $dimension->variableId;
			$property = $dimension->property;
			$variableData = $dimension->data;

			//store in array for step 3
			$dimensionsByKey[ $id ] = $dimension;
			if( $id != $mainDimId ) {
				$otherDimIds[] = $id;
			}

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
					
					//is it first property being saved for given property
					if( !array_key_exists( $property, $dataByEntity[ $entityId ][ "values" ] ) ) {
						$dataByEntity[ $entityId ][ "values" ][ $property ] = [];
					}
					//store value
					$dataByEntity[ $entityId ][ "values" ][ $property ][ floatval( $datum->date ) ] = floatval( $datum->value );
					
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


		/**
		 * 3) prepare array with the longest as main dataset 
		 **/

		$normalizedData = [];

		$mainDimension = $dimensionsByKey[ $mainDimId ];
	
		//loop through all countries
		foreach( $dataByEntity as $entityData ) {

			$arr = array(
				"id" => $entityData[ "id" ],
				"key" => $entityData[ "key" ],
				"values" => []
			);

			//main values
			$mainValues = $entityData[ "values" ][ $mainDimension->property ];
			$i = 0;
			foreach( $mainValues as $time=>$mainValue ) {

				//array where we store data for all properties for given time 
				$timeArr = [];

				//flag whether for given time, there's enough relevant data
				$hasData = true;

				//take value from 
				$timeArr[ $mainDimension->property ] = $mainValue;
				
				//insert other properties for given main property
				foreach( $otherDimIds as $otherDimId ) {

					$otherDimension = $dimensionsByKey[ $otherDimId ];

					$value = false;
					//retrieve value
					//has property any values at all?
					if( !empty( $entityData[ "values" ][ $otherDimension->property ] ) ) {
						
						//has property for given time
						if( array_key_exists( $time, $entityData[ "values" ][ $otherDimension->property ] ) ) {
							
							$value = $entityData[ "values" ][ $otherDimension->property ][ $time ];
						
						} else {
							
							//no it doesn't, look around
							$lookAroundLen = 3;
							$currLook = $lookAroundLen;
							$direction = "past";
							$origTime = $time;
							$currTime = $time;
							
							while( $currLook > -1 ) {

								if( $direction == "past" ) {
									$currTime--;
								} else {
									$currTime++;
								}
								//break if found value
								if( array_key_exists( $currTime, $entityData[ "values" ][ $otherDimension->property ] ) ) {
									$value = $entityData[ "values" ][ $otherDimension->property ][ $currTime ]; 
									break;
								}
								//value not found this round
								if( $currLook > 0 ) {
									$currLook--;
								} else {
									if( $direction == "past" ) {
										//finished searching into 
										$direction = "future";	
										$lookAroundLen = $currLook;
									} else {
										//no value found in both cycles, do nothing and let while loop exit on its own
									}
								}
								
							}

						}

					} 

					if( !$value ) {
						$hasData = false;
						$value = 0;
					}
					$timeArr[ $otherDimension->property ] = $value;
					
				}

				//if is linechart, has only one dimension
				if( $isLineChart ) {
					$timeArr[ "x" ] = $time;
				}

				//if is valid array, insert
				if( $hasData ) {
					$arr[ "values" ][ $i ] = $timeArr;
					$i++;
				} 
				
			}

			$normalizedData[ $entityData[ "id" ] ] = $arr;
			
		}


		if( $groupByEntity ) {
			//convert to array
			foreach( $normalizedData as $entityData ) {
				//TODO better check for this?
				if( $entityData[ "values" ] ) {
					$data[] = $entityData;
				}
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

	public function getRelatedKey( $buffer = 4, $dir = "up" ) {

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
