<?php namespace App\Http\Controllers;

use Input;
use App\Chart;
use App\Setting;
use App\Variable;
use App\DatasetCategory;
use App\DatasetSubcategory;
use App\ChartType;
use App\Logo;

use App\Http\Requests;
use App\Http\Controllers\Controller;

use Illuminate\Http\Request;

use Cache;
use Carbon\Carbon;
use Debugbar;
use DB;

class ChartsController extends Controller {

	/**
	 * Display a listing of the resource.
	 *
	 * @return Response
	 */
	public function index()
	{
		$charts = Chart::orderBy("last_edited_at", "desc")->get();
		return view( 'charts.index', compact('charts') );
	}

	/**
	 * Show the form for creating a new resource.
	 *
	 * @return Response
	 */
	public function create()
	{
		Cache::flush();
		$data = $this->editorData();
		return view('charts.create')->with('data', $data);
	}

	public function editorData() {
		$data = new \StdClass;
		$data->chartTypes = ChartType::lists( 'name', 'id' );
		$data->logos = Logo::lists( 'name', 'url' );

		$query = DB::table("variables")
			->join('datasets', 'variables.fk_dst_id', '=', 'datasets.id')
			->join('dataset_categories', 'datasets.fk_dst_cat_id', '=', 'dataset_categories.id')
			->join('dataset_subcategories', 'datasets.fk_dst_subcat_id', '=', 'dataset_subcategories.id')
			->orderBy('dataset_categories.id', 'ASC')
			->orderBy('dataset_subcategories.id', 'ASC')
			->select('variables.name', 'variables.id', 'variables.unit', 'datasets.name as dataset',
					 'dataset_categories.name as category', 'dataset_subcategories.name as subcategory');

		$optgroups = [];
		foreach ($query->get() as $result) {
			if (!isset($optgroups[$result->subcategory])) {
				$optgroup = new \StdClass;
				$optgroup->name = $result->subcategory;
				$optgroup->variables = [];
				$optgroups[$result->subcategory] = $optgroup;
			}

			if ($result->name != $result->dataset) 
				$result->name = $result->dataset . " - " . $result->name;
			$optgroups[$result->subcategory]->variables[]= $result;
		}
		$data->optgroups = $optgroups;
		return $data;		
	}

	/**
	 * Store a newly created resource in storage.
	 *
	 * @return Response
	 */
	public function store(Request $request)
	{
		$data = Input::all();
		
		$chartName = $data["chart-name"];
		$slug = $data["chart-slug"];
		$notes = $data["chart-notes"];
		unset($data["chart-notes"]);
		unset($data["chart-slug"]);
		$json = json_encode( $data );
		
		$user = \Auth::user();
		$chart = Chart::create([ 
			'config' => $json, 'name' => $chartName, 'slug' => $slug, 'notes' => $notes,
			'last_edited_at' => Carbon::now(), 'last_edited_by' => $user->name ] );

		Cache::flush();

		return ['success' => true, 'data' => [ 'id' => $chart->id, 'viewUrl' => route( 'view', $chart->id )]];
	}

	/**
	 * Display the specified resource.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function show(Chart $chart, Request $request)
	{
		if ($request->ajax())
			return $this->config($chart->id);
		else
			return redirect()->to('view/' . $chart->id);
	}

	public function config( $chartId ) {
		$chart = Chart::find( $chartId );
		if (!$chart)
			return App::abort(404, "No such chart");

		$config = Chart::getConfigWithUrl($chart);
		
		return response()->json($config);
	}

	/**
	 * Show the form for editing the specified resource.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function edit( Chart $chart, Request $request )
	{
		$data = $this->editorData();
		return view('charts.edit', compact('chart'))->with('data', $data);
	}

	/**
	 * Update the specified resource in storage.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function update( Chart $chart )
	{	
		$data = Input::all();
		$chartName = $data["chart-name"];
		$chart->name = $data["chart-name"];
		$chart->notes = $data["chart-notes"];
		$chart->slug = $data["chart-slug"];
		unset($data["chart-notes"]);
		unset($data["chart-slug"]);

		$json = json_encode($data);
		$user = \Auth::user();
		$chart->last_edited_at = Carbon::now();
		$chart->last_edited_by = $user->name;
		$chart->fill( [ 'name' => $chartName, 'config' => $json ] );
		
		$chart->save();

		Cache::flush();

		// Purge exported png files so we can regenerate them
		$files = glob(public_path() . "/exports/" . $chart->slug . ".*");
		foreach ($files as $file) {
			unlink($file);
		}


		return ['success' => true, 'data' => [ 'id' => $chart->id, 'viewUrl' => route( 'view', $chart->id ) ] ];
	}

	/**
	 * Remove the specified resource from storage.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function destroy( Chart $chart )
	{
		$chart->delete();

		Cache::flush();
		
		return redirect()->route( 'charts.index' )->with( 'message', 'Chart deleted.' );
	}

}
