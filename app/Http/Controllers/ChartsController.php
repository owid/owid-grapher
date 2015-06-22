<?php namespace App\Http\Controllers;

use Input;
use App\Chart;
use App\Setting;
use App\Variable;
use App\DatasetCategory;
use App\DatasetSubcategory;
use App\ChartType;

use App\Http\Requests;
use App\Http\Controllers\Controller;

use Illuminate\Http\Request;

class ChartsController extends Controller {

	/**
	 * Display a listing of the resource.
	 *
	 * @return Response
	 */
	public function index()
	{
		$charts = Chart::all();
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
		$logoUrl = Setting::where( 'meta_name', 'logoUrl' )->first();
		$data->logoUrl = ( !empty( $logoUrl ) )? url('/') .'/'. $logoUrl->meta_value: '';
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
			
			$chartName = $data[ "chart-name" ];
			$json = json_encode( $data );
			
			$chart = Chart::create( [ 'config' => $json, 'name' => $chartName ] );
			
			return ['success' => true, 'data' => [ 'id' => $chart->id, 'viewUrl' => route( 'view', $chart->id ) ] ];

			/*$u = new User;
			$u->username = $data['username'];
			$u->password = Hash::make(Input::get( $data['password']));
			//if success
			if($u->save()){
				return 1;
			}
			//if not success
			else{
			return 0;
			*/

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
			$config = json_decode( $chart->config );
			return response()->json( $config );
		} else {
			$data = new \StdClass;
			$data->variables = Variable::with('Dataset')->get();
			$data->categories = DatasetCategory::all();
			$data->subcategories = DatasetSubcategory::all();
			$data->chartTypes = ChartType::lists( 'name', 'id' );
			$logoUrl = Setting::where( 'meta_name', 'logoUrl' )->first();
			$data->logoUrl = ( !empty( $logoUrl ) )? url('/') .'/'. $logoUrl->meta_value: '';
			return view('charts.show', compact( 'chart' ) )->with( 'data', $data );
		}
	}

	public function config( $chartId ) {
		$chart = Chart::find( $chartId );
		$config = ( $chart )? json_decode( $chart->config ): false;
		return response()->json( $config );
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
			$logoUrl = Setting::where( 'meta_name', 'logoUrl' )->first();
			$data->logoUrl = ( !empty( $logoUrl ) )? url('/') .'/'. $logoUrl->meta_value: '';
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
		$json = json_encode( $data );
		
		$newData = new \stdClass();
		$newData->config = $json;
		$newData->name = $chartName;
		
		$chart->fill( [ 'name' => $chartName, 'config' => $json ] );
		$chart->save();
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
		return redirect()->route( 'charts.index' )->with( 'message', 'Chart deleted.' );
	}

}
