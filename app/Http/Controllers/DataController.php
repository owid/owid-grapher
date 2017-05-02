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

class DataController extends Controller {
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
					 'entities.displayName as entity_displayName',
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
					$entityKey[floatval($result->entity_id)] = [ 'name' => ($result->entity_displayName ? $result->entity_displayName : $result->entity_name), 'code' => $result->entity_code ];
			}

			fwrite($out, "\r\n");
			fwrite($out, json_encode($entityKey));
		}, 200, [
			"Content-Type" => "text/plain",
			"Cache-Control" => Chart::getQueryString() ? "max-age=31536000 public" : "no-cache"
		]);

		return $response;
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
}
