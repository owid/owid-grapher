<?php namespace App\Http\Controllers;

use App\DataValue;
use App\Datasource;
use App\Entity;
use App\Http\Requests;
use App\Http\Controllers\Controller;

use Illuminate\Http\Request;

use Cache;

class ValuesController extends Controller {

	/**
	 * Display a listing of the resource.
	 *
	 * @return Response
	 */
	public function index()
	{
		//
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
	public function show($id)
	{
		//
	}

	/**
	 * Show the form for editing the specified resource.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function edit(DataValue $dataValue)
	{
		$entities = Entity::lists( 'name', 'id' );
		$datasources = Datasource::lists( 'name', 'id' );
			return view( 'values.edit', compact( 'dataValue', 'entities', 'datasources' ) );
	}

	/**
	 * Update the specified resource in storage.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function update(DataValue $dataValue, Request $request)
	{
		$input = array_except( $request->all(), [ '_method', '_token', 'time-label' ] );
		$dataValue->update( $input );

		Cache::flush();

		return redirect()->route( 'variables.show', $dataValue->fk_var_id)->with( 'message', 'Value updated.');
	}

	/**
	 * Remove the specified resource from storage.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function destroy(DataValue $dataValue)
	{	
		//delete itself
		$dataValue->delete();
		//delete time
		$deleteTime = $dataValue->time->delete();

		Cache::flush();
		
		return redirect()->route('variables.show', $dataValue->fk_var_id)->with('message', 'Value deleted.');
	}

}
