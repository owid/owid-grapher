<?php namespace App\Http\Controllers;

use App\ApiKey;
use App\Http\Requests;
use App\Http\Controllers\Controller;

use Illuminate\Http\Request;

class ApiKeysController extends Controller {

	/**
	 * Display a listing of the resource.
	 *
	 * @return Response
	 */
	public function index()
	{
		$grid = \DataGrid::source( 'api_keys' );
		$grid->add( 'id', 'ID', true )->style( 'width:100px' );
        $grid->add( 'name', 'Name', true );
        $grid->add( 'value', 'Value', true );
		$grid->add( '<a href="' .route( 'apiKeys.index' ). '/{{$id}}">View</a>', 'View' );
		$grid->paginate(10);
        return view( 'apiKeys.index', compact( 'grid' ) );
	}

	public function create()
	{
		return view( 'apiKeys.create' );
	}

	/**
	 * Store a newly created resource in storage.
	 *
	 * @return Response
	 */
	public function store( Request $request )
	{
		$data = \Input::all();
		
		$name = $data[ 'name' ];
		$value = $data[ 'value' ];
		$apiKey = ApiKey::create( [ 'name' => $name, 'value' => $value ] );
			
		return redirect()->route( 'apiKeys.index' )->with( 'message', 'API key created.' )->with( 'message-class', 'success' );

	}

	/**
	 * Display the specified resource.
	 *
	 * @param  ApiKey $apiKey
	 * @return Response
	 */
	public function show( ApiKey $apiKey, Request $request )
	{
		return view( 'apiKeys.show', compact( 'apiKey' ) );
	}

	/**
	 * Show the form for editing the specified resource.
	 *
	 * @param  ApiKey $apiKey
	 * @return Response
	 */
	public function edit( ApiKey $apiKey, Request $request )
	{
		return view( 'apiKeys.edit', compact( 'apiKey' ) );
	}

	/**
	 * Update the specified resource in storage.
	 *
	 * @param  ApiKey $apiKey
	 * @return Response
	 */
	public function update( ApiKey $apiKey )
	{	
		$input = \Input::all();
		$name = $input[ 'name' ];
		$value = $input[ 'value' ];
		$apiKey->fill( [ 'name' => $name, 'value' => $value ] );
		$apiKey->save();

		return redirect()->route( 'apiKeys.show', $apiKey->id )->with( 'message', 'API key udpated.' )->with( 'message-class', 'success' );
	}

	/**
	 * Remove the specified resource from storage.
	 *
	 * @param  ApiKey $apiKey
	 * @return Response
	 */
	public function destroy( ApiKey $apiKey )
	{
		$apiKey->delete();
		return redirect()->route( 'apiKeys.index' )->with( 'message', 'API key deleted.' )->with( 'message-class', 'success' );
	}

}
