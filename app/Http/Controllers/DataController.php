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
use Debugbar;

class DataController extends Controller {

	/**
	 * Display a listing of the resource.
	 *
	 * @return Response
	 */
	public function index() {
		return "Controller for data";
	}

	public function variables($var_ids_str, Request $request) {
		$var_ids = array_map("floatval", explode("+", $var_ids_str));

		$response = [];
		$response['variables'] = [];

		// First we make a query to get the general variable info
		// name, sources, etc. Mainly used by the sources tab
		$variableQuery = DB::table('variables')
			->whereIn('variables.id', $var_ids)
			->join('datasets', 'variables.fk_dst_id', '=', 'datasets.id')
			->join('datasources', 'variables.fk_dsr_id', '=', 'datasources.id')
			->select('variables.id as var_id', 'variables.name as var_name',
					 'variables.description as var_desc', 'variables.unit as var_unit',
					 'variables.created_at',
					 'datasources.name as source_name', 'datasources.description as source_desc',
					 'datasources.link as source_link', 'datasets.name as dataset_name');

		foreach ($variableQuery->get() as $result) {
			$source = [];
			$source['name'] = $result->source_name;
			$source['description'] = $result->source_desc;
			$source['link'] = $result->source_link;

			$var = [];
			$var['id'] = $result->var_id;
			$var['name'] = $result->var_name;
			$var['dataset_name'] = $result->dataset_name;
			$var['created_at'] = $result->created_at;
			$var['description'] = $result->var_desc;
			$var['unit'] = $result->var_unit;
			$var['source'] = $source;
			$var['entities'] = [];
			$var['years'] = [];
			$var['values'] = [];
			$response['variables'][$result->var_id] = $var;
		}

		// Now we pull out all the actual data
		$dataQuery = DB::table('data_values')
			->whereIn('data_values.fk_var_id', $var_ids)
			->select('data_values.value as value', 'times.label as year',
					 'data_values.fk_var_id as var_id', 
					 'entities.id as entity_id', 'entities.name as entity_name')
			->join('entities', 'data_values.fk_ent_id', '=', 'entities.id')
			->join('times', 'data_values.fk_time_id', '=', 'times.id')
			->orderBy('times.date');

		$response['entityKey'] = [];

		foreach ($dataQuery->get() as $result) {
			$var = &$response['variables'][$result->var_id];
			$response['entityKey'][floatval($result->entity_id)] = $result->entity_name;
			$var['entities'][] = floatval($result->entity_id);
			$var['values'][] = $result->value;
			$var['years'][] = floatval($result->year);
		}

		// Add license info
		$response['license'] = License::find(1)->first();
		return $response;
	}

	public function dimensions( Request $request ) {

		set_time_limit( 10 );
		ini_set('memory_limit', '256M');

		//check we have everything we should have
		if( !Input::has( 'dimensions' ) ) {
			//we don't have necessary info, bail out
			return [ 'success' => false ];
		}

		//filtering by entities?
		$selectedCountriesIds = Input::get( "selectedCountries" );
		$selectedCountriesIdsString = ( !empty( $selectedCountriesIds ) && count( $selectedCountriesIds ) > 0 )? implode( ",", $selectedCountriesIds ) : "";
		//filtering by time?
		$chartTime = Input::get( "chartTime" );

		if( Input::has( 'chartId' ) ) {
			//caching - construct key with selected countries as well
			$key = 'chart-dimensions-' . Input::get( 'chartId' ). '-countries-' .$selectedCountriesIdsString;
			//if there's something in cache and not exporting
			if( Cache::has( $key ) && !Input::has( 'export' ) && ( Input::has( 'cache' ) && Input::get( 'cache' ) === "true" ) ) {
				//return Cache::get( $key );
			}
		}

		$data = array();

		//extra array for storing values for export
		$times = array();
		$datasourcesIdsArr = array();

		$dimensionsInput = Input::get( 'dimensions' );
		$dimensions = json_decode( $dimensionsInput );

		//isn't it just empty object
		if( empty( $dimensions ) ) {
			return [ 'success' => false ];
		}

		$chartType = Input::get( 'chartType' );

		//there's special setting for linechart
		$isLineChart = ( $chartType == "1" || $chartType == "4" || $chartType == "5" || $chartType == "6" )? true: false;

		//find out how many variables we have 
		$groupByEntity = ( Input::get( 'groupByVariables' ) == 'false' )? true: false;
		
		//special case for linechart with multiple variables 
		$multiVariantByEntity = false;
		if( $groupByEntity && $isLineChart && count( $dimensions ) > 1 ) {
			//make sure they're all
			foreach( $dimensions as $dimension ) {
				if( $dimension->property !== "y" ) {
					$multiVariantByEntity = false;
					break;
				}
				$multiVariantByEntity = true;
			}
		}

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
		//for edge cases for legend, we need to store entityname
		$entityName = "";

		//categorical data
		$categoricalData = array();
		$categoricalData[ "color" ] = array();
		$categoricalData[ "shape" ] = array();
		$categoricalDimensions = array();

		foreach( $dimensions as $dimension ) {

			$id = $dimension->variableId;

			//use query builder instead of eloquent
			$variableQuery = DB::table( 'data_values' )
				->select( 'data_values.*', 'times.*', 'entities.name as name', 'variables.name as variable_name' )
				->join( 'entities', 'data_values.fk_ent_id', '=', 'entities.id' )
				->join( 'variables', 'data_values.fk_var_id', '=', 'variables.id' )
				->join( 'times', 'data_values.fk_time_id', '=', 'times.id' )
				->where( 'data_values.fk_var_id', $id );

			//are we filtering based on entity selection?
			if( !empty( $selectedCountriesIds ) && count( $selectedCountriesIds ) > 0 ) {
				$variableQuery->whereIn( 'data_values.fk_ent_id', $selectedCountriesIds );
			}
			//are we filtering based on time selection?
			if( !empty( $chartTime ) && count( $chartTime ) > 1 ) {
				//exclude categorical properties from time filtering
				if( $dimension->property !== "color" && $dimension->property !== "shape" ) {
					$minTime = $chartTime[0];
					$maxTime = $chartTime[1];
					$variableQuery->where( 'times.startDate', '>=', $minTime );
					//$variableQuery->where( 'times.date', '>=', $minTime );
					$variableQuery->where( 'times.endDate', '<=', $maxTime );
					//$variableQuery->where( 'times.date', '<=', $maxTime );
				}
			}	

			$variableData = $variableQuery->get();
			Debugbar::info($variableData);
			
			//insert data into existing variable
			$dimension->data = $variableData;

			//is shortes variable? cannot be color/shape variable
			$dataLen = count( $variableData );
			if( ( $dataLen > $minDataLength || !$minDataLength ) && 
				( $dimension->property != "color" && $dimension->property != "shape" ) ) {
				$minDataLength = $dataLen;
				$mainDimId = $id;
			}
			
			//is categorical data
			if( $dimension->property === "color" || $dimension->property === "shape" ) {
				//store it for later processing
				$categoricalDimensions[] = $dimension;
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
				//$i = 0;
				$oldEntityId = -1;
				foreach( $variableData as $datum ) {

					//$entityId = $datum->fk_ent_id;
					$entityId = ( !$multiVariantByEntity )? $datum->fk_ent_id: $datum->fk_ent_id . "-" .$datum->fk_var_id;
					
					//check if new entity and we need to reset cycle
					if( $oldEntityId != $entityId ) {
						//$i = 0;
					}
					$oldEntityId = $entityId;
					
					//do we have already object for that entity
					if( !array_key_exists($entityId, $dataByEntity) ) {
						$key = ( !$multiVariantByEntity )? $datum->name: $datum->name . " - " . $datum->variable_name;
						$dataByEntity[ $entityId ] = array( 
							"id" => $entityId,
							//"id" => intval($entityId),
							"key" => $key,
							//store entity name for legend purposes
							"entity" => $datum->name,
							"values" => []
						);
					}
					
					//is it first property being saved for given property
					if( !array_key_exists( $property, $dataByEntity[ $entityId ][ "values" ] ) ) {
						$dataByEntity[ $entityId ][ "values" ][ $property ] = [];
					}
					//store value, if range time type - store as startYear-endYear?
					$timeId = ( $datum->fk_ttype_id != 6 )? floatval( $datum->label ): floatval( $datum->startDate ) . "-" . floatval( $datum->endDate );
					$dataByEntity[ $entityId ][ "values" ][ $property ][ $timeId ] = ( $property != "color" && $property != "shape" && $property != "map" )? floatval( $datum->value ): $datum->value;
					
					//need to store dimension variablename, dimensions are returned
					if( !array_key_exists( "variableName", $dimension ) ) {
						$dimension->variableName = $datum->variable_name;
					}

					//if is linechart, store time into x axis
					/*if( $isLineChart ) {
						$dataByEntity[ $entityId ][ "values" ][ $i ][ "x" ] = floatval( $datum->date );
					}
					$i++;*/

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
					$times[floatval($datum->label)] = true;
					$datasourcesIdsArr[ $datum->fk_dsr_id ] = true;

				}

			} else {

				//multivariables

				//get variable names
				$variable = Variable::find( $dimension->variableId );

				$key = ( !empty( $variable ) && isset( $variable->name ) )? $variable->name: "";
				//could have display name
				if( !empty( $dimension ) && !empty( $dimension->displayName ) ) {
					$key = $dimension->displayName;
				}

				$dataByVariable[ "id-".$id ] = array( 
					"id" => $id,
					"key" => $key,
					"values" => []
				);

				//store variable name to dimension info (useful for stack bar chart)
				$dimensionsByKey[ $id ]->variableName = $key;
				
				foreach( $variableData as $datum ) {
					
					//store entity name for legend purposes
					$entityName = $datum->name;

					$dataByVariable[ "id-".$id ][ "values" ][] = array( "x" => floatval($datum->label), "y" => floatval($datum->value) );
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
		 * 3) prepare array for different chart types
		 **/

		//$normalizedData = [];
		$mainDimension = $dimensionsByKey[ $mainDimId ];

		if( $groupByEntity ) {
			$normalizedData = Chart::formatDataForChartType( $chartType, $dataByEntity, $dimensionsByKey, $times, false, $mainDimension, $otherDimIds );
		} else {
			//grouping by variable, for linechart, we already have what we need
			if( $chartType !== '1' && $chartType !== '2' ) {
				$dataByVariable = Chart::formatDataForChartType( $chartType, $dataByVariableTime, $dimensionsByKey, $times, true, $mainDimension, $otherDimIds, $entityName );
			}
		}
		
		if( $chartType == '9999' ) {
			
			//if getting dimensions for map, don't need info bellow, just send of the data
			$data = [];
			foreach( $normalizedData as $entityData ) {
				$data[] = $entityData;
			}

			//add dimension name
			$variableName = Variable::find( $mainDimId )->name;
			$result = [ 'success' => true, 'data' => $data, 'variableName' => $variableName ];
			
			return $result;
		}

		
		if( $groupByEntity ) {
			//convert to array
			foreach( $normalizedData as $entityData ) {
				
				//TODO better check for this?
				if( $entityData[ 'values' ] ) {
						
					//here we add any possible categorical data
					foreach( $categoricalDimensions as $catDimension ) {
						$entityId = $entityData[ 'id' ];

						//is there data for specific property
						if( array_key_exists( 'values', $dataByEntity[ $entityId ] ) && array_key_exists( $catDimension->property, $dataByEntity[ $entityId ][ 'values' ] ) ) {
							
							//get value - http://stackoverflow.com/questions/1028668/get-first-key-in-a-possibly-associative-array
							$value = reset( $dataByEntity[ $entityId ][ 'values' ][ $catDimension->property ] );
							$catValue = Chart::getValueForCategory( $catDimension->property, $categoricalData, $value );

							//color is assinged to whole entity, shape is assigned to individual data entries
							if( $catDimension->property === "color" ) {
								$entityData[ $catDimension->property ] = $catValue;
							} else if( $catDimension->property === "shape" ) {
								foreach( $entityData[ "values" ] as &$entityValue ) {
									$entityValue[ $catDimension->property ] = $catValue;
								}
							}

						}
					}

					$data[] = $entityData;
				
				}
				
			}
		} else {
			//convert to array
			foreach( $dataByVariable as $varData ) {
				$data[] = $varData;
			}
		}

		/**
		 *	4) fetch all the other necessary data
		 **/

		//get all necessary info for datasources
		$datasources = array();
		$prevDimension = "";
		
		$sourcesByNameDim = array();

		foreach( $dimensions as $dimension ) {
			$datasource = new \stdClass();
			//special dimension header for linechart
			$dsr = Variable::getSource( $dimension->variableId )->first();
			if( $isLineChart ) {
				$dimension = false;
			}

			$currDimension = ( !empty( $dimension ) && isset( $dimension->name ) )? $dimension->name: "undefined";
			$datasource->description = ( !empty($dsr) )? $this->createSourceDescription( $dimension, $dsr, $currDimension === $prevDimension ): '';
			$datasource->name = ( !empty($dsr) && !empty($dsr->name) )? $dsr->name: '';
			$datasource->link = ( !empty($dsr) && !empty($dsr->name) )? $dsr->link: '';
			
			//make sure we don't repeat for the same name and dimension
			$nameDimKey = $currDimension ."-". $datasource->name;
			if( !isset( $sourcesByNameDim[ $nameDimKey ] ) ) {
				$datasources[] = $datasource;
				$sourcesByNameDim[ $nameDimKey ] = true;
			}
			
			//store curr dimension so we don't have to repeat title for next if it's same
			$prevDimension = ( !empty( $dimension ) && isset( $dimension->name ) )? $dimension->name: "";
		
		}

		/*$datasourcesIds = array_keys( $datasourcesIdsArr );
		$datasourcesSources = Variable::getSources( $datasourcesIds )->get();//Datasource::findMany( $datasourcesIds );
		$datasources = array();

		//format datasources info (create generated tables)
		foreach( $datasourcesSources as $datasourceSource ) {
			$datasource = new \stdClass();
			$dimension = $this->findDimensionForVarId( $dimensions, $datasourceSource->var_id );
			//special dimension header for linechart
			if( $isLineChart ) {
				$dimension = false;
			}
			$datasource->description = $this->createSourceDescription( $dimension, $datasourceSource );
			$datasource->name = $datasourceSource->name;
			$datasource->link = $datasourceSource->link;
			//$datasource->description = $datasourceSource->description;
			$datasources[] = $datasource;
		}*/

		//process data to csv friendly format
		$timeKeys = array_keys( $times );
		//sort timeKeys by time
		//AMMEND HERE - what is intervals
		usort( $timeKeys, function ($a, $b) { if ( $a==$b ) return 0; else return ($a > $b) ? 1 : -1; });
		
		//get all the licence information
		$license = License::find( 1 )->first();


		$result = [ 'success' => true, 'data' => $data, 'dimensions' => $dimensions, 'datasources' => $datasources, 'timeType' => $timeType, 'license' => $license ];
		
		//store into cache
		if( !empty( $key ) ) {
			$minutes = 60*24;
			Cache::put( $key, $result, $minutes );
		}
		
		return $result;


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

	}

	public function times( Request $request ) {

		$data = array();
		if( !Input::has( 'variableIds' ) ) {
			return [];
		}

		$variableIdsInput = Input::get( 'variableIds' );
		$variableIds = explode( ',', $variableIdsInput );

		//use query builder instead of eloquent
		$timesData = DB::table( 'data_values' )
			->select( 'times.id', 'times.date', 'times.startDate', 'times.endDate', 'times.label', 'times.fk_ttype_id' )
			->join( 'times', 'data_values.fk_time_id', '=', 'times.id' )
			->whereIn( 'data_values.fk_var_id', $variableIds )
			->groupBy( 'date' )
			->get();

		//go through times data and make sure it's not interval data
		foreach( $timesData as $timeData ) {

		}

		$data = $timesData;

		if( $request->ajax() ) {

			return ['success' => true, 'data' => $data ];

		} else {
			//not ajax request, just spit out whatever is in data
			return $data;
		}

	}

	public function search( Request $request ) {

		$data = array();
		
		if( Input::has( 's' ) ) {
			$search = Input::get( 's' );
			$variablesData = DB::table( 'variables' )
				->select( 'variables.id', 'variables.name', 'datasets.fk_dst_cat_id', 'datasets.fk_dst_subcat_id' )
					->leftJoin( 'datasets', 'variables.fk_dst_id', '=' ,'datasets.id' )
					->leftJoin( 'dataset_categories', 'datasets.fk_dst_cat_id', '=' ,'dataset_categories.id' )
					->leftJoin( 'dataset_subcategories', 'datasets.fk_dst_subcat_id', '=' ,'dataset_subcategories.id' )
					->leftJoin( 'link_datasets_tags', 'link_datasets_tags.fk_dst_id', '=' ,'datasets.id' )
					->leftJoin( 'dataset_tags', 'link_datasets_tags.fk_dst_tags_id', '=' ,'dataset_tags.id' )
				->where( 'variables.name', 'LIKE', '%' .$search. '%' )
					->orWhere( 'dataset_categories.name', 'LIKE', '%' .$search. '%' )
					->orWhere( 'dataset_subcategories.name', 'LIKE', '%' .$search. '%' )
					->orWhere( 'datasets.description', 'LIKE', '%' .$search. '%' )
					->orWhere( 'datasets.name', 'LIKE', '%' .$search. '%' )
					->orWhere( 'dataset_tags.name', 'LIKE', '%' .$search. '%' )
				->get();
			$data = $variablesData;
		}

		if( $request->ajax() ) {

			return ['success' => true, 'data' => $data ];

		} else {
			//not ajax request, just spit out whatever is in data
			return $data;
		}

	}

	public function getValue( $dimension, $time, $values ) {

		$value;
		//do we have value for exact time
		if( array_key_exists( $time, $values ) ) {
			
			if( $dimension->mode === "latest" && isset( $dimension->maximumAge ) ) {
				//for latest, we ahave to check the latest avaiable data is not too old
				$nowTime = date( "Y" );
				$oldestAllowedTime = $nowTime - $dimension->maximumAge;
				if( $time < $oldestAllowedTime ) {
					//latest available time is too old, bail
					return;
				}
			} 

			$value = $values[ $time ];
			
		} else {
			//no we don't, try to around in recent years
			if( $dimension->mode !== "latest" ) {
				$value = $this->lookAround( $dimension, $time, $values );
			}
		}

		return $value;

	}

	public function lookAround( $dimension, $time, $values ) {

		$defaultTolerance = 5;
		$lookAroundLen = $defaultTolerance;

		//find out if we'll be looking in past and future (case for specific year with tolerance ), or only past (case for latest date with maximum age)
		$direction = ( isset( $dimension->mode ) && $dimension->mode == "latest" )? "past": "both";
		//set look around len depending on mode
		if( isset( $dimension->mode ) ) {
			if( $dimension->mode === "latest" && isset( $dimension->maximumAge ) ) {
				//for latest, set check latest time if it's within allowed age and set tolerance to zero
				//$lookAroundLen = $dimension->maximumAge;
				$lookAroundLen = 0;//$dimension->maximumAge;
				$nowTime = date( "Y" );
				$oldestAllowedTime = $nowTime - $dimension->maximumAge;
				return false;
				if( $time < $oldestAllowedTime ) {
					//latest available time is too old, bail
					return false;
				}
			}
			if( ( $dimension->mode === "specific" || $dimension->mode === "closest" ) && isset( $dimension->tolerance ) ) {
				$lookAroundLen = $dimension->tolerance;
			}
		} 
		$currLen = 0;
		$currLook = $lookAroundLen;
		
		$origTime = $time;
		$currTime = $time;

		while( $currLen < $lookAroundLen ) {

			//increase gap
			$currLen++;
			
			//try going forward first
			$currTime = $origTime + $currLen;
			//break if found value
			if( array_key_exists( $currTime, $values ) ) {
				$value = $values[ $currTime ]; 
				return $value;
			}

			//nothing forward, trying going backward
			$currTime = $origTime - $currLen;
			//break if found value
			if( array_key_exists( $currTime, $values ) ) {
				$value = $values[ $currTime ]; 
				return $value;
			}

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

	public function createSourceDescription( $dimension, $datasource, $omitHeader = false ) {

		$displayName = ( !empty($dimension->displayName) )? $dimension->displayName: $datasource->var_name;

		$html = "";
		$html .= "<div class='datasource-wrapper'>";
			if( !$omitHeader ) {
				$html .= ( !empty( $dimension ) && isset( $dimension->name ) )? "<h2>Data for " .$dimension->name. ": </h2>": "<h2>Data: </h2>";
			}
			$html .= "<div class='datasource-header'>";
				$html .= "<h3><span class='datasource-property'>Dataset name:</span>" .$datasource->dataset_name. "</h3>";
				$html .= "<h4><span class='datasource-property'>Variable name:</span>" .$datasource->var_name. "</h4>";
			$html .= "</div>";
			$html .= "<table>";
				$html .= "<tr><td><span class='datasource-property'>Full name</span></td><td>" .$datasource->var_name. "</td></tr>";
				$html .= "<tr><td><span class='datasource-property'>Display name</span></td><td>" .$displayName. "</td></tr>";
				$html .= "<tr><td><span class='datasource-property'>Definition</span></td><td>" .$datasource->var_desc. "</td></tr>";
				$html .= "<tr><td><span class='datasource-property'>Unit</span></td><td>" .$datasource->var_unit. "</td></tr>";
				$t = strtotime( $datasource->var_created );
				$date = date('d/m/y',$t);
				$html .= "<tr><td><span class='datasource-property'>Uploaded</span></td><td>" .$date. "</td></tr>";
			$html .= "</table>";
			$html .= $datasource->description;
		$html .= "</div>";
		return $html;
	}

	public function findDimensionForVarId( $dimensions, $varId ) {

		foreach( $dimensions as $dimension ) {
			if( !empty( $dimension ) && isset( $dimension ) ) {
				if( $dimension->variableId == $varId ) {
					return $dimension;
				}
			}
		}

		return false;
	}

	public function matchIsoName() {
		$name = Input::get( "name" );
		$entityIsoName = EntityIsoName::match( $name )->first();
		$success = ( $entityIsoName && $entityIsoName->id > 1 && $entityIsoName->name != "" )? true: false;
		$result = [ 'success' => $success ];
		return $result;
	}


}
