<?php namespace App;

use Illuminate\Database\Eloquent\Model;

class Chart extends Model {

	protected $guarded = ['id'];

	/**
	*	DATA PROCESSING FUNCTIONS
	**/

	public static function formatDataForChartType( $chartType, $data, $dimensionsByKey, $times, $groupByVariable = false, $mainDimension = false, $otherDimIds = false, $entity = false ) {

		$normalizedData = [];
		
		switch( $chartType ) {
			case "1":
			case "4":
			case "5":
				$normalizedData = Chart::formatDataForLineChart( $data, $dimensionsByKey, $times, $groupByVariable, $mainDimension );
				break;
			case "2":
				$normalizedData = Chart::formatDataForScatterPlotChart( $data, $dimensionsByKey, $times, $groupByVariable, $mainDimension, $otherDimIds );
				break;
			case "3":
				$normalizedData = ( !$groupByVariable )? Chart::formatDataForStackBarChart( $data, $dimensionsByKey, $times, $groupByVariable ): Chart::formatDataForStackBarChartByVariable( $data, $dimensionsByKey, $times, $entity );
				break;
			case "6":
				$normalizedData = Chart::formatDataForDiscreteBarChart( $data, $dimensionsByKey, $times, $groupByVariable, $mainDimension, $otherDimIds );
				break;
			case "9999":
				//map case - has only one dimension
				$dimension = reset( $dimensionsByKey );
				$normalizedData = Chart::formatDataForMap( $data, $dimension, $times );
				break;
		}

		return $normalizedData;

	}

	/**
	*	LINE CHART
	**/

	public static function formatDataForLineChart( $dataByEntity, $dimensionsByKey, $times, $groupByVariable, $mainDimension ) {
		
		$normalizedData = [];

		foreach( $dataByEntity as $entityData ) {
					
			$arr = array(
				"id" => $entityData[ "id" ],
				"key" => $entityData[ "key" ],
				"entity" => $entityData[ "entity" ],
				"values" => []
			);

			//main values
			//do we have some values for given entity at all?
			if( !array_key_exists( $mainDimension->property, $entityData[ "values" ] ) ) {
				//nope, bail on this entity
				continue;
			}

			$mainValues = $entityData[ "values" ][ $mainDimension->property ];
			$i = 0;
			
			//depending on the mode, continue with the rest
			foreach( $mainValues as $time=>$mainValue ) {

				//array where we store data for all properties for given time 
				$timeArr = [];

				//flag whether for given time, there's enough relevant data
				$hasData = true;

				//take value from 
				$timeArr[ $mainDimension->property ] = $mainValue;
				//store time as one dimension, usefull for popup for scatter plot
				$timeArr[ "time" ] = $time;

				//insert other properties for given main property
				foreach( $dimensionsByKey as $otherDimension ) {

					//skip main dimension
					if( $otherDimension == $mainDimension ) {
						continue;
					}
					//skip categorical properties (color/shape)
					if( $otherDimension->property === "color" || $otherDimension->property === "shape" ) {
						continue;
					}

					$value = false;
					//retrieve value for property
					//has property any values at all?
					if( !empty( $entityData[ "values" ][ $otherDimension->property ] ) ) {
						
						//try to find value for given dimension, entity and time
						if( array_key_exists( $otherDimension->property, $entityData[ "values" ] ) ) {

							$value = Chart::getValue( $otherDimension, $time, $entityData[ "values" ][ $otherDimension->property ] );
							if( Chart::hasValue( $value ) ) {
								$timeArr[ $otherDimension->property ] = $value[ "value" ]; 
							} else {
								$hasData = false;
							}
							
						} else {
							$hasData = false;
						}
					
					} 

					if( !$value ) {
						$hasData = false;
						$value = 0;
					}
					$timeArr[ $otherDimension->property ] = $value;
					
				}

				//linechart, has only one dimension
				$timeArr[ "x" ] = $time;
				
				//if is valid array, insert
				if( $hasData ) {

					//are we matching agains entity and time, or only against entity
					$arr[ "values" ][ $i ] = $timeArr;
					$i++;

				} 
				
			}

			$normalizedData[ $entityData[ "id" ] ] = $arr;
			
		}

		return $normalizedData;

	}

	/**
	* SCATTER PLOT
	**/
	
	public static function formatDataForScatterPlotChart( $dataByEntity, $dimensionsByKey, $times, $groupByVariable, $mainDimension, $otherDimIds ) {

		$normalizedData = [];

		foreach( $dataByEntity as $entityData ) {
			
			$arr = array(
				"id" => $entityData[ "id" ],
				"key" => $entityData[ "key" ],
				"entity" => $entityData[ "entity" ],
				"values" => []
			);

			//main values
			//do we have some values for given entity at all?
			if( !array_key_exists( $mainDimension->property, $entityData[ "values" ] ) ) {
				//nope, bail on this entity
				continue;
			}

			$mainValues = $entityData[ "values" ][ $mainDimension->property ];
			$i = 0;

			//settings for parameters
			$defaultPeriod = "all";
			$period = ( isset( $mainDimension->period ) )? $mainDimension->period: $defaultPeriod; 
			
			//depending on the mode, continue with the rest
			if( $period === "single" ) {
				
				//only getting one value per country per specify value
				$hasData = true;
				$timeArr = [];

				foreach( $dimensionsByKey as $dimension ) {

					//skip categorical properties (color/shape)
					if( $dimension->property === "color" || $dimension->property === "shape" ) {
						continue;
					}

					$defaultMode = "specific";
					$defaultYear = 2000;
					$mode = ( isset( $dimension->mode ) )? $dimension->mode: $defaultMode; 

					if( $mode === "specific" ) {
					
						$time = ( isset( $dimension->targetYear ) )? $dimension->targetYear: $defaultYear;
					
					} else if( $mode === "latest" ) {
					
						//need to fetch latest year for given property

						//do we have some values for given entity and property at all?
						if( isset( $entityData[ "values" ][ $dimension->property ] ) ) {
							$allYears = array_keys( $entityData[ "values" ][ $dimension->property ] );
							$latestYear = max( $allYears );
							$time = $latestYear;
						} else {
							$hasData = false;
							continue;
						}
					
					}

					//store time if main property
					/*if( $dimension->variableId === $mainDimension->variableId ) {
						$timeArr[ "time" ] = $time;
					}*/

					//try to find value for given dimension, entity and time
					if( array_key_exists( $dimension->property, $entityData[ "values" ] ) ) {
						$value = Chart::getValue( $dimension, $time, $entityData[ "values" ][ $dimension->property ] );
						if( Chart::hasValue( $value ) ) {
							$timeArr[ $dimension->property ] = $value[ "value" ];
							//for scatter plot, we need to store exact time
							$timeArr = Chart::storeExactTime( $timeArr, $value );
						} else {
							$hasData = false;
						}
						
					} else {
						$hasData = false;
					}

				}

				$arr[ "values" ][ 0 ] = $timeArr;
				if( $hasData ) {
					$normalizedData[ $entityData[ "id" ] ] = $arr;
				}
			
			} else {

				//case when getting data for whole range of values
				foreach( $mainValues as $time=>$mainValue ) {

					//array where we store data for all properties for given time 
					$timeArr = [];

					//flag whether for given time, there's enough relevant data
					$hasData = true;

					//take value from 
					$timeArr[ $mainDimension->property ] = $mainValue;
					//store time as one dimension, usefull for popup for scatter plot
					//$timeArr[ "time" ] = $time;

					//insert other properties for given main property
					foreach( $otherDimIds as $otherDimId ) {

						$otherDimension = $dimensionsByKey[ $otherDimId ];

						//skip categorical properties (color/shape)
						if( $otherDimension->property === "color" || $otherDimension->property === "shape" ) {
							continue;
						}

						$value = false;
						//retrieve value for property
						//has property any values at all?
						if( !empty( $entityData[ "values" ][ $otherDimension->property ] ) ) {
							
							$defaultMode = "closest";
							$mode = ( isset( $otherDimension->mode ) )? $otherDimension->mode: $defaultMode;
							
							if( $mode === "latest" ) {
								$allYears = array_keys( $entityData[ "values" ][ $otherDimension->property ] );
								$latestYear = max( $allYears );
								$time = $latestYear;
							}

							//try to find value for given dimension, entity and time
							if( array_key_exists( $otherDimension->property, $entityData[ "values" ] ) ) {

								$value = Chart::getValue( $otherDimension, $time, $entityData[ "values" ][ $otherDimension->property ] );
								if( Chart::hasValue( $value ) ) {
									$timeArr[ $otherDimension->property ] = $value[ "value" ]; 
									//for scatter plot, we need to store exact time
									$timeArr = Chart::storeExactTime( $timeArr, $value );
								} else {
									//temp
									//$value = 0;
									$hasData = false;
								}
								
							} else {
								$hasData = false;
							}
						
						} 

						if( !$value ) {
							$hasData = false;
							$value = 0;
						}
						$timeArr[ $otherDimension->property ] = $value;
						
					}

					//if is valid array, insert
					if( $hasData ) {

						$arr[ "values" ][ $i ] = $timeArr;
						$i++;

					} 
					
				}

				$normalizedData[ $entityData[ "id" ] ] = $arr;
				
			}

		}

		return $normalizedData;

	}
				
	
	/**
	*	STACK AREA CHART
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

					//skip categorical properties (color/shape)
					if( $dimension->property === "color" || $dimension->property === "shape" ) {
						continue;
					}

					if( !empty( $entityData[ "values" ][ $dimension->property ] ) ) {

						$value = Chart::getValue( $dimension, $time, $entityData[ "values" ][ $dimension->property ] );
						if( Chart::hasValue( $value ) ) {
							$entityTimeArr[ $dimension->property ] = $value[ "value" ]; 
							//also store time, useful for legend
							$entityTimeArr[ "time" ] = $time;
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

				$arr[ $time ] = $entitiesArr;
				//$i++;

			} 

		}

		foreach( $dataByEntity as $entityData ) {
				
			$entity = array(
				"id" => $entityData[ "id" ],
				"key" => $entityData[ "key" ],
				"entity" => $entityData[ "entity" ],
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

	public static function formatDataForStackBarChartByVariable( $dataByVariable, $dimensionsByKey, $times, $entity ) {

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
				"entity" => $entity,
				"values" => []
			);
			$variablesByKey[ "id-" .$variable[ "id" ] ] = $variable; 

		}

		foreach( $arr as $time=>$singleTimeArr ) {

			//loop through all single times
			foreach( $singleTimeArr as $variableId=>$value ) {
				if( $variableId !== "time" ) {
					$variablesByKey[ "id-" .$variableId ][ "values" ][] = array( "x" => floatval( $singleTimeArr[ "time" ] ), "y" => floatval( $value ), "time" => floatval( $singleTimeArr[ "time" ] ) );

				}
			}

		}

		return $variablesByKey;

	}

	/**
	*	DISCRETE BAR CHART
	**/

	public static function formatDataForDiscreteBarChart( $dataByEntity, $dimensionsByKey, $times, $groupByVariable, $mainDimension, $otherDimIds ) {

		$normalizedData = [];
		
		foreach( $dataByEntity as $entityData ) {
			
			$arr = array(
				"id" => $entityData[ "id" ],
				"key" => $entityData[ "key" ],
				"entity" => $entityData[ "entity" ],
				"values" => []
			);

			//main values
			//do we have some values for given entity at all?
			if( !array_key_exists( $mainDimension->property, $entityData[ "values" ] ) ) {
				//nope, bail on this entity
				continue;
			}
				
			//only getting one value per country per specify value
			$hasData = true;
			$timeArr = [];

			foreach( $dimensionsByKey as $dimension ) {

				//skip categorical properties (color/shape)
				if( $dimension->property === "color" || $dimension->property === "shape" ) {
					continue;
				}

				$defaultYear = 2000;
				$time = ( isset( $dimension->targetYear ) )? $dimension->targetYear: $defaultYear;
				$timeArr[ "time" ] = $time;
				//discrete bar chart needs key 
				$timeArr[ "id" ] = $entityData[ "id" ];
				$timeArr[ "x" ] = $entityData[ "key" ];

				//try to find value for given dimension, entity and time
				if( array_key_exists( $dimension->property, $entityData[ "values" ] ) ) {

					$value = Chart::getValue( $dimension, $time, $entityData[ "values" ][ $dimension->property ] );
					if( Chart::hasValue( $value ) ) {
						$timeArr[ $dimension->property ] = $value[ "value" ]; 
					} else {
						$hasData = false;
					}
					
				} else {
					$hasData = false;
				}

			}

			$arr[ "values" ][ 0 ] = $timeArr;
			if( $hasData ) {
				$normalizedData[ $entityData[ "id" ] ] = $arr;
			}
			
		}

		return $normalizedData;

	}


	/**
	*	MAP
	**/

	public static function formatDataForMap( $dataByEntity, $dimension, $times ) {

		$normalizedData = [];
		foreach( $dataByEntity as $entityData ) {
			
			$arr = array(
				"id" => $entityData[ "id" ],
				"key" => $entityData[ "key" ],
				"entity" => $entityData[ "entity" ],
				"values" => []
			);

			//main values
			//do we have some values for given entity at all?
			if( !array_key_exists( $dimension->property, $entityData[ "values" ] ) ) {
				//nope, bail on this entity
				continue;
			}

			$mainValues = $entityData[ "values" ][ $dimension->property ];
			$i = 0;

			//only getting one value per country per specify value
			$hasData = true;

			//if user chose not to get interpolated data, zero out tolerance
			if( $dimension->mode == "no-interpolation" ) {
				$dimension->tolerance = 0;
			}

			$defaultYear = 1960;
			$time = ( isset( $dimension->targetYear ) )? $dimension->targetYear: $defaultYear;
			
			$value = Chart::getValue( $dimension, $time, $entityData[ "values" ][ $dimension->property ] );
			if( Chart::hasValue( $value ) ) {
				$timeArr[ $dimension->property ] = $value[ "value" ];
				//map needs exact time
				$arr = Chart::storeExactTime( $arr, $value ); 
			} else {
				$hasData = false;
			}
			
			$arr[ "values" ] = [ $value[ "value" ] ];
			if( $hasData ) {
				$normalizedData[ $entityData[ "id" ] ] = $arr;
			}
			
		}

		return $normalizedData;

	}

	/**
	*	UTILS
	**/

	public static function getValue( $dimension, $time, $values ) {

		//different logic whether time is single or interval
		$firstKey = ( isset( $values ) )? key( $values ): "";

		if( strpos( $firstKey, "-" ) === false && strpos( $time, "-" ) === false ) {
			$value = Chart::getSingleTimeValue( $dimension, $time, $values );
		} else {
			$value = Chart::getIntervalTimeValue( $dimension, $time, $values );
		}

		return $value;

	}

	public static function getSingleTimeValue( $dimension, $time, $values ) {

		//do we have value for exact time
		if( array_key_exists( $time, $values ) ) {
			
			if( $dimension->mode === "latest" && isset( $dimension->maximumAge ) ) {
				//for latest, we a have to check the latest avaiable data is not too old
				$nowTime = date( "Y" );
				$oldestAllowedTime = $nowTime - $dimension->maximumAge;
				if( $time < $oldestAllowedTime ) {
					//latest available time is too old, bail
					return;
				}
			} 

			//return exact time of data as well, in case it was needed 
			$value = [ "time" => $time, "value" => $values[ $time ] ];
			
		} else {
			//no we don't, try to around in recent years
			if( $dimension->mode !== "latest" ) {
				$value = Chart::lookAround( $dimension, $time, $values );
			}
		}

		return $value;

	}

	public static function getIntervalTimeValue( $dimension, $time, $values ) {

		//loop through all values, deconstruct their keys to start/end years and see if $time falls in between
		foreach( $values as $key => $value ) {

			//is value within interval
			$timeArr = explode( "-", $key );
			if( count( $timeArr ) == 2 ) {
				$timeMin = floatval( $timeArr[ 0 ] );
				$timeMax = floatval( $timeArr[ 1 ] );
			} else {
				$timeMin = floatval( $key );
				$timeMax = $timeMin;
			}

			//is target year with interval
			$targetYearArr = explode( "-", $time );
			if( count( $targetYearArr ) == 2 ) {
				$targetYearMin = floatval( $targetYearArr[ 0 ] ); 
				$targetYearMax = floatval( $targetYearArr[ 1 ] ); 
			} else {
				$targetYearMin = $time; 
				$targetYearMax = $time; 
			}

			//does time of interest fall between interval
			if( $targetYearMin >= $timeMin && $timeMax <= $targetYearMax ) {
				//return exact time of data as well, in case it was needed 
				return [ "value" => $value, "time" => $targetYearMin ." – ". $targetYearMax ];
			}

		}
		
		return false;

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
				//return exact time of data as well, in case it was needed 
				return [ "value" => $value, "time" => $currTime ];
			}

			//nothing forward, trying going backward
			$currTime = $origTime - $currLen;
			//break if found value
			if( array_key_exists( $currTime, $values ) ) {
				$value = $values[ $currTime ]; 
				//return exact time of data as well, in case it was needed 
				return [ "value" => $value, "time" => $currTime ];
			}

		}
	}

	public static function hasValue($value) {
		return ( isset( $value ) && isset( $value["value"] ) )? true: false;
		//return ( !empty( $value ) || $value === "0" || $value === 0 )? true: false;
	}

	public static function getValueForCategory( $property, &$categoricalData, $value ) {

		$colors = [ "#aec7e8", "#ff7f0e", "#1f77b4", "#ffbb78", "#2ca02c", "#98df8a", "#d62728", "#ff9896", "#9467bd", "#c5b0d5", "#8c564b", "c49c94", "e377c2", "f7b6d2", "7f7f7f", "c7c7c7", "bcbd22", "dbdb8d", "17becf", "9edae5", "1f77b4" ];
		$shapes = [ "circle", "cross", "triangle-up", "triangle-down", "diamond", "square" ];

		//get existing data for given property
		$existingData = &$categoricalData[ $property ];
		if( !array_key_exists( $value, $existingData ) ) {

			$valueIndex = count( $existingData );
			$existingData[ $value ] = $valueIndex;
		
		} else {
			
			$valueIndex = $existingData[ $value ];
			
		}

		if( $property === "color" ) {
			
			$valueIndex = $valueIndex % count( $colors );
			$result = $colors[ $valueIndex ];
		
		} else if( $property === "shape" ) {
			
			$valueIndex = $valueIndex % count( $shapes );
			$result = $shapes[ $valueIndex ];
		
		}
		
		return $result;		

	}

	public static function storeExactTime( $timeArr, $value ) {
		//for scatter plot, we need to store exact time
		if( !empty( $timeArr ) && !empty( $value ) && !empty( $value[ "time" ] ) ) {
			if( empty( $timeArr[ "time" ] ) ) {
				//there isn't anything stored for time yet
				$timeArr[ "time" ] = $value[ "time" ];
			} else {
				//there's time stored already, if not the same add it to string
				if( $timeArr[ "time" ] !== $value[ "time" ] ) {
					$timeArr[ "time" ] .= ", " .$value[ "time" ];
				}
			}
		}
		return $timeArr;
	}

}
