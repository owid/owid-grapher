<?php namespace App\Http\Controllers;

use Input;
use App\Chart;
use App\Variable;
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
		$variables = Variable::lists( 'name', 'id' );
		$data = new \StdClass;
		$data->variables = $variables;
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
			return view('charts.show', compact( 'chart' ) );
		}
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
			$variables = Variable::lists( 'name', 'id' );
			$data = new \StdClass;
			$data->variables = $variables;
			$data->config = $config;
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
		//
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
