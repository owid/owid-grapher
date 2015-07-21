<?php namespace App;

use Illuminate\Database\Eloquent\Model;

class Chart extends Model {

	protected $guarded = ['id'];

	/**
	*	DATA PROCESSING FUNCTIONS
	**/

	public static function formatDataForChartType( $chartType, $data, $dimensionsByKey, $times, $groupByVariable = false ) {

		$normalizedData = [];
		
		switch( $chartType ) {
			case 3:
				$normalizedData = ( !$groupByVariable )? Chart::formatDataForStackBarChart( $data, $dimensionsByKey, $times, $groupByVariable ): Chart::formatDataForStackBarChartByVariable( $data, $dimensionsByKey, $times, $groupByVariable );
				break;
		}

		return $normalizedData;

	}

	/**
	*	STACK CHART
	**/

	public static function formatDataForStackBarChart( $dataByEntity, $dimensionsByKey, $times, $groupByVariable ) {

		$normalizedData = [];
		
		//start stack bar chart
		//need to sort times first, sort by key
		ksort( $times );
		
		//main array, where we store data
		$arr = [];

		//format data for stack bar chart, need to always have time for all times
		foreach( $times as $time=>$timeValue ) {

			//array where we store data for all properties for all entities for given time 
			$entitiesArr = [];

			//flag whether for given time, there's enough relevant data
			$hasData = true;

			//loop through entities
			foreach( $dataByEntity as $entityData ) {

				//array where we store data for all properties for given entity for given time 
				$entityTimeArr = [];

				//for each dimension
				foreach( $dimensionsByKey as $dimension ) {

					if( !empty( $entityData[ "values" ][ $dimension->property ] ) ) {

						$value = Chart::getValue( $dimension, $time, $entityData[ "values" ][ $dimension->property ] );
						if( $value ) {
							$entityTimeArr[ $dimension->property ] = $value; 
						} else {
							//for stack bar chart, we need to have data for all properties
							$hasData = false;
							break 2;
						}
						
					} else {

						$hasData = false;
						break 2;

					}

				}

				//if we have all data for given property and time, store it
				if( $hasData ) {
					$entitiesArr[ $entityData[ "id" ] ] = $entityTimeArr;
				}

			} 

			//if data for all entities, store it in the main array
			if( $hasData ) {

				$arr[] = $entitiesArr;
				//$i++;

			}

		}

		foreach( $dataByEntity as $entityData ) {
				
			$entity = array(
				"id" => $entityData[ "id" ],
				"key" => $entityData[ "key" ],
				"values" => []
			);
			$normalizedData[ $entityData[ "id" ] ] = $entity;

		}

		//loop through all found times with data for all entities
		foreach( $arr as $time=>$singleTimeArr ) {

			//loop through all single times
			foreach( $singleTimeArr as $entityId=>$values ) {

				//fetch what we already have for entity
				$entityArr;
				if( array_key_exists( $entityId, $normalizedData ) ) {
					//we don't have anything for entity, create object and put it into main result array
					$entityArr = $normalizedData[ $entityId ];
				} else {
					//something weird, bail
					continue;
				}

				//loop through all properties
				$entityValues = [];
				foreach( $values as $property=>$value ) {
					$entityValues[ $property ] = $value;
				}
				$entityValues[ "x" ] = $time;
				$entityArr[ "values" ][] = $entityValues;
				
				//reupdate 
				$normalizedData[ $entityId ] = $entityArr;

			}
			
		}

		return $normalizedData;

	}

	public static function formatDataForStackBarChartByVariable( $dataByVariable, $dimensionsByKey, $times ) {

		//need to sort times first, sort by key
		ksort( $times );
		
		//main array, where we store data
		$arr = [];

		foreach( $times as $time=>$timeValue ) {

			$timeArr = [];
			$timeArr[ "time" ] = $time;

			//flag whether for given time, there's enough relevant data
			$hasData = true;

			foreach( $dataByVariable as $variableId=>$variableData ) {

				if( array_key_exists( $time, $variableData ) ) {
				
					$value = $variableData[ $time ];
					$timeArr[ $variableId ] = $value;
					
				} else {

					//don't have data for this time and variable, we can bail on entire time, cause stack bar chart needs data for all variables
					$hasData = false;
					break 2;

				}
			
			}

			//if data for all entities, store it in the main array
			if( $hasData ) {

				$arr[] = $timeArr;
			
			}

		}
		
		$variablesByKey = [];
		foreach( $dimensionsByKey as $dimension ) {

			$variable = array(
				"id" => $dimension->variableId,
				"key" => $dimension->variableName,
				"values" => []
			);
			$variablesByKey[ "id-" .$variable[ "id" ] ] = $variable; 

		}

		foreach( $arr as $time=>$singleTimeArr ) {

			//loop through all single times
			foreach( $singleTimeArr as $variableId=>$value ) {
				if( $variableId !== "time" ) {
					$variablesByKey[ "id-" .$variableId ][ "values" ][] = array( "x" => floatval( $singleTimeArr[ "time" ] ), "y" => floatval( $value ) );
				}
			}

		}

		return $variablesByKey;

	}	

	/**
	*	UTILS
	**/

	public static function getValue( $dimension, $time, $values ) {

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
				$value = Chart::lookAround( $dimension, $time, $values );
			}
		}

		return $value;

	}

	public static function lookAround( $dimension, $time, $values ) {

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

}
