<?php namespace App\Http\Controllers;

use App\Datasource;
use App\Http\Requests;
use App\Http\Controllers\Controller;

use Illuminate\Http\Request;

class DatasourcesController extends Controller {

	/**
	 * Display a listing of the resource.
	 *
	 * @return Response
	 */
	public function index()
	{
		$datasources = Datasource::all();
		return view( 'datasources.index', compact('datasources') );
	}

	/**
	 * Show the form for creating a new resource.
	 *
	 * @return Response
	 */
	public function create()
	{
		return view( 'datasources.create' );
	}

	/**
	 * Store a newly created resource in storage.
	 *
	 * @return Response
	 */
	public function store(Request $request)
	{
		Datasource::create($request->all());
		return redirect()->route( 'datasources.index' )->with( 'message', 'Source created.');
	}

	/**
	 * Display the specified resource.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function show(Datasource $datasource)
	{
		return view( 'datasources.show', compact( 'datasource' ) );
	}

	/**
	 * Show the form for editing the specified resource.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function edit(Datasource $datasource)
	{
		return view( 'datasources.edit', compact( 'datasource' ) );
	}

	/**
	 * Update the specified resource in storage.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function update(Datasource $datasource, Request $request)
	{
		$input = array_except( $request->all(), [ '_method', '_token' ] );
		$datasource->update( $input );
		return redirect()->route( 'datasources.show', $datasource->id)->with( 'message', 'Source updated.');
	}

	/**
	 * Remove the specified resource from storage.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function destroy(Datasource $datasource, Request $request)
	{	
		//check depedencies first
		if( $datasource->datasets()->count() > 0 ) {
			return redirect()->route('datasources.index')->with('message', 'Some datasets are linked to this source, so you cannot delete it.')->with( 'message-class', 'error' );;
		}
		if( $datasource->variables()->count() > 0 ) {
			return redirect()->route('datasources.index')->with('message', 'Some variables are linked to this source, so you cannot delete it.')->with( 'message-class', 'error' );;
		}
		if( $datasource->values()->count() > 0 ) {
			return redirect()->route('datasources.index')->with('message', 'Some values are linked to this source, so you cannot delete it.')->with( 'message-class', 'error' );;
		}
		
		//no dependencies, delete
		$datasource->delete();
		
		return redirect()->route('datasources.index')->with('message', 'Source deleted.');
	}

}
