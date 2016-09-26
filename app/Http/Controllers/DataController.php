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
use Symfony\Component\HttpFoundation\StreamedResponse;

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

	/**
	 * Primary endpoint for mass retrieval of data for one or more variables
	 */
	public function variables($var_ids_str, Request $request) {
		set_time_limit(10);
		ini_set('memory_limit', '256M');

		$var_ids = array_map("floatval", explode("+", $var_ids_str));
		$meta = [];
		$meta['variables'] = [];
		$meta['license'] = License::find(1)->first();

		// First we make a query to get the general variable info
		// name, sources, etc. Mainly used by the sources tab
		$variableQuery = DB::table('variables')
			->whereIn('variables.id', $var_ids)
			->join('datasets', 'variables.fk_dst_id', '=', 'datasets.id')
			->leftJoin('sources', 'variables.sourceId', '=', 'sources.id')
			->select('variables.id as var_id', 'variables.name as var_name',
					 'variables.description as var_desc', 'variables.unit as var_unit',
					 'variables.created_at',
					 'sources.name as source_name', 'sources.description as source_desc',
					 'datasets.name as dataset_name');

		foreach ($variableQuery->get() as $result) {
			$source = [];
			$source['name'] = $result->source_name;
			$source['description'] = $result->source_desc;

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
			$meta['variables'][$result->var_id] = $var;
		}

		// Now we pull out all the actual data
		$dataQuery = DB::table('data_values')
			->whereIn('data_values.fk_var_id', $var_ids)
			->select('value', 'year',
					 'data_values.fk_var_id as var_id', 
					 'entities.id as entity_id', 'entities.name as entity_name',
					 'entities.code as entity_code')
			->join('entities', 'data_values.fk_ent_id', '=', 'entities.id')
			->orderBy('var_id', 'ASC')
			->orderBy('year', 'ASC');

		$response = new StreamedResponse(function() use ($dataQuery, $meta) {
			$out = fopen('php://output', 'w');
			fwrite($out, json_encode($meta));

			$entityKey = [];
			$var_id = null;
			foreach ($dataQuery->get() as $result) {
				if ($result->var_id != $var_id) {
					$var_id = $result->var_id;
					fwrite($out, "\r\n" . $var_id);
				}

				fwrite($out, ";");
				fwrite($out, $result->year);
				fwrite($out, ",");
				fwrite($out, $result->entity_id);
				fwrite($out, ",");
				fwrite($out, $result->value);

				if (!isset($entityKey[floatval($result->entity_id)]))
					$entityKey[floatval($result->entity_id)] = [ 'name' => $result->entity_name, 'code' => $result->entity_code ];
			}

			fwrite($out, "\r\n");
			fwrite($out, json_encode($entityKey));
		}, 200, [
			"Content-Type" => "text/plain",
			"Cache-Control" => Chart::getQueryString() ? "max-age=31536000 public" : "no-cache"
		]);

		return $response;
	}


/*	public function downloadCsv( $data ) {
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
	
	}*/

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
}
