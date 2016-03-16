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
		$data = new \StdClass;
		$data->variables = Variable::with('Dataset')->get();
		$data->categories = DatasetCategory::all();
		$data->subcategories = DatasetSubcategory::all();
		$data->chartTypes = ChartType::lists( 'name', 'id' );
		$data->logos = Logo::lists( 'name', 'url' );
		//$logoUrl = Setting::where( 'meta_name', 'logoUrl' )->first();
		//$data->logoUrl = ( !empty( $logoUrl ) )? url('/') .'/'. $logoUrl->meta_value: '';

		Cache::flush();

		return view('charts.create')->with( 'data', $data );
	}

	/**
	 * Store a newly created resource in storage.
	 *
	 * @return Response
	 */
	public function store(Request $request)
	{
		$data = Input::all();
		
		if( $request->ajax() )
		{
			//todo validation
			
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

			return ['success' => true, 'data' => [ 'id' => $chart->id, 'viewUrl' => route( 'view', $chart->id ) ] ];

		}

	}

	/**
	 * Display the specified resource.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function show( Chart $chart, Request $request )
	{
		if( $request->ajax() ) {
			return $this->config($chart->id);
		} else {
			$data = new \StdClass;
			$data->variables = Variable::with('Dataset')->get();
			$data->categories = DatasetCategory::all();
			$data->subcategories = DatasetSubcategory::all();
			$data->chartTypes = ChartType::lists( 'name', 'id' );
			$data->logos = Logo::lists( 'name', 'url' );
			//$logoUrl = Setting::where( 'meta_name', 'logoUrl' )->first();
			//$data->logoUrl = ( !empty( $logoUrl ) )? url('/') .'/'. $logoUrl->meta_value: '';
			return view('charts.show', compact( 'chart' ) )->with( 'data', $data );
		}
	}

	public function config( $chartId ) {
		$chart = Chart::find( $chartId );
		if (!$chart)
			return App::abort(404, "No such chart");

		$config = json_decode($chart->config);
		$config->id = $chart->id;
		$config->{"chart-notes"} = $chart->notes;
		$config->{"chart-slug"} = $chart->slug;
		$config->{"data-entry-url"} = $chart->last_referer_url;

		//possibly there could logo query parameter
		if( !empty( $config ) && !empty( Input::get('logo') ) ) {
			//there's logo query parameter, we want to display chart with different logo
			//find logo by name
			$logo = Logo::where('name','=',Input::get('logo'))->first();
			if( !empty( $logo ) ) {
				//override logo in config with logo from query parameter
				$config->logo = $logo->url;
			}
		}

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
		$config = json_decode( $chart->config );
		if( $request->ajax() ) {
			return response()->json( $config );
		} else {
			$data = new \StdClass;
			$data->variables = Variable::with('Dataset')->get();
			$data->categories = DatasetCategory::all();
			$data->subcategories = DatasetSubcategory::all();
			$data->chartTypes = ChartType::lists( 'name', 'id' );
			$data->logos = Logo::lists( 'name', 'url' );
			//$logoUrl = Setting::where( 'meta_name', 'logoUrl' )->first();
			//$data->logoUrl = ( !empty( $logoUrl ) )? url('/') .'/'. $logoUrl->meta_value: '';
			return view('charts.edit', compact( 'chart' ) )->with( 'data', $data );
		}
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
		$chartName = $data[ "chart-name" ];
		$notes = $data["chart-notes"];
		$slug = $data["chart-slug"];
		unset($data["chart-notes"]);
		unset($data["chart-slug"]);
		$chart->notes = $notes;		
		$chart->slug = $slug;
		$json = json_encode( $data );
		$newData = new \stdClass();
		$newData->config = $json;
		$newData->name = $chartName;
		$user = \Auth::user();
		$chart->last_edited_at = Carbon::now();
		$chart->last_edited_by = $user->name;
		$chart->fill( [ 'name' => $chartName, 'config' => $json ] );
		
		$chart->save();

		Cache::flush();

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
