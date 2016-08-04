<?php namespace App\Http\Controllers;

use App\Dataset;
use App\Source;
use App\Chart;
use App\DatasetCategory;
use App\DatasetSubcategory;
use App\Http\Requests;
use App\Http\Controllers\Controller;

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
				'name' => $var->name,
				'unit' => $var->unit,
				'description' => $var->description,
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
	 * Remove the specified resource from storage.
	 *
	 * @param  int  $id
	 * @return Response
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

}
