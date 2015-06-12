<?php namespace App\Http\Controllers;

use App\License;
use App\Http\Requests;
use App\Http\Controllers\Controller;

use Illuminate\Http\Request;

class LicensesController extends Controller {

	/**
	 * Display a listing of the resource.
	 *
	 * @return Response
	 */
	public function index()
	{
		$licenses = License::all();
		return view( 'licenses.index', compact('licenses') );
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
	 * @param  License  $license
	 * @return Response
	 */
	public function show(License $license)
	{
		return view( 'licenses.show', compact('license') );
	}

	/**
	 * Show the form for editing the specified resource.
	 *
	 * @param  License $license
	 * @return Response
	 */
	public function edit(License $license)
	{
		return view( 'licenses.edit', compact( 'license' ) );
	}

	/**
	 * Update the specified resource in storage.
	 *
	 * @param  License $license
	 * @return Response
	 */
	public function update(License $license, Request $request)
	{
		$input = array_except( $request->all(), [ '_method', '_token' ] );
		$license->update( $input );
		return redirect()->route( 'licenses.show', $license->id)->with( 'message', 'License updated.')->with( 'message-class', 'success' );
	}

	/**
	 * Remove the specified resource from storage.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function destroy($id)
	{
		//
	}

}
