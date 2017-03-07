<?php namespace App\Http\Controllers;

use App\Dataset;
use App\Source;
use App\Chart;
use App\DatasetCategory;
use App\DatasetSubcategory;
use App\Http\Requests;
use App\Http\Controllers\Controller;
use Symfony\Component\HttpFoundation\StreamedResponse;

use Illuminate\Http\Request;

use Cache;
use DB;
use Carbon\Carbon;

class DatasetsController extends Controller {

	/**
	 * Display a listing of the resource.
	 *
	 * @return Response
	 */
	public function index()
	{
		$datasets = Dataset::with('variables')
			->where('namespace', '=', 'owid')
			->orderBy('created_at', 'desc')->get();
		return view('datasets.index', [ 'datasets' => $datasets ]);
	}

	/**
	 * Show the form for creating a new resource.
	 *
	 * @return Response
	 */
	public function create()
	{
		//
	}

	/**
	 * Store a newly created resource in storage.
	 *
	 * @return Response
	 */
	public function store()
	{
		//
	}

	/**
	 * Display the specified resource.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function show(Dataset $dataset)
	{	
		// Find all the charts associated with this dataset
		$charts = [];
		foreach ($dataset->variables as $variable) {
			foreach ($variable->charts as $chart) {				
				if (!array_where($charts, function($key, $value) use ($chart) { return $value->id == $chart->id; })) {
					$charts[]= $chart;
				}
			}
		}
		
		return view('datasets.show', compact('dataset', 'charts'));
	}

	public function showJson(Dataset $dataset) {
		$data = [
			'name' => $dataset->name,
			'description' => $dataset->description,
			'categoryId' => $dataset->fk_dst_cat_id,
			'subcategoryId' => $dataset->fk_dst_subcat_id,
			'variables' => []
		];

		$variables = [];
		foreach ($dataset->variables()->with('source')->with('charts')->get() as $var) {
			$source = $var->source;

			$sourcedata = [
				'id' => $source->id,
				'name' => $source->name,
				'description' => $source->description
			];

			$chartdata = [];
			foreach ($var->charts as $chart) {
				$chartdata[]= [
					'id' => $chart->id,
					'name' => $chart->name					
				];
			}

			$vardata = [			
				'id' => $var->id,	
				'name' => $var->name,
				'unit' => $var->unit,
				'description' => $var->description,
				'coverage' => $var->coverage,
				'timespan' => $var->timespan,
				'source' => $sourcedata,
				'charts' => $chartdata
			];

			$data['variables'][] = $vardata;
		}

		return $data;
	}


	/**
	 * Show the form for editing the specified resource.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function edit(Dataset $dataset)
	{
		$sources = Source::lists( 'name', 'id' );
		$categories = DatasetCategory::all()->lists( 'name', 'id' );
		$subcategories = DatasetSubcategory::all()->lists( 'name', 'id' );
		return view('datasets.edit', compact('dataset', 'categories', 'subcategories', 'sources'));
	}

	/**
	 * Update the specified resource in storage.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function update(Dataset $dataset, Request $request)
	{
		$input = array_except( $request->all(), [ '_method', '_token' ] );
		$dataset->update( $input );

		Cache::flush();

		return redirect()->route( 'datasets.show', $dataset->id)->with( 'message', 'Dataset updated.');
	}

	/**
	 * Delete a dataset and its associated variables.
	 */
	public function destroy(Dataset $dataset, Request $request)
	{	
		try {
			$dataset->delete();			
		} catch (\Exception $e) {
			$msg = $e->errorInfo[2];
			if (str_contains($msg, "chart_dimensions_variableid_foreign"))
				$msg = "Dataset cannot be deleted while a chart still needs it. Delete charts or change their variables first.";
			return redirect()->route('datasets.show', $dataset->id)->with('message', $msg)->with('message-class', 'error');
		}

		Cache::flush();		
		return redirect()->route('datasets.index')->with('message', 'Dataset deleted.');
	}

	/**
	 * Export the entire dataset to CSV, in a format compatible with multivar import.
	 */
	public function exportCSV(Dataset $dataset, Request $request) {
		set_time_limit(10);
		ini_set('memory_limit', '256M');
		
		$varIds = $dataset->variables->lists('id')->all();

		// Grab the variable names for the header row
		$variableNameById = DB::table('variables')
			->whereIn('id', $varIds)
			->select('id', 'name')
			->lists('name', 'id');

		// Now we pull out all the actual data
		$dataQuery = DB::table('data_values')
			->whereIn('data_values.fk_var_id', $varIds);

		$dataQuery = $dataQuery
			->select('value', 'year',
					 'data_values.fk_var_id as var_id', 
					 'entities.id as entity_id', 'entities.name as entity_name',
					 'entities.code as entity_code');

		$dataQuery = $dataQuery->join('entities', 'data_values.fk_ent_id', '=', 'entities.id')
			->orderBy('entities.name', 'ASC')
			->orderBy('year', 'ASC')
			->orderBy('fk_var_id', 'ASC');

		// MISPY: Streaming response to handle memory limitations when
		// exporting very large amounts of data
		$response = new StreamedResponse(function() use ($varIds, $variableNameById, $dataQuery) {
			$out = fopen('php://output', 'w');

			$headerRow = ['Country', 'Year'];
			foreach ($varIds as $id) {
				$headerRow[]= $variableNameById[$id];
			}
			fputcsv($out, $headerRow);

			$currentRow = null;

			foreach ($dataQuery->get() as $result) {
				if (!$currentRow || $currentRow[0] != $result->entity_name || $currentRow[1] != $result->year) {
					if ($currentRow)
						fputcsv($out, $currentRow);

					// New row
					$currentRow = [$result->entity_name, $result->year];
					for ($i = 0; $i < sizeof($varIds); $i++) {
						$currentRow[]= "";
					}
				}

				$index = 2+array_search($result->var_id, $varIds);
				$currentRow[$index] = $result->value;
			}

			// Final row
			fputcsv($out, $currentRow);
		}, 200, [
			"Content-Type" => "text/csv",
			"Content-Disposition" => 'attachment; filename="' . $dataset->name . '.csv' . '"'	
		]);

		return $response;
	}
}
