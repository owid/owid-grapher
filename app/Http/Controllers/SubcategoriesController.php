<?php namespace App\Http\Controllers;

use App\DatasetSubcategory;

use App\Http\Requests;
use App\Http\Controllers\Controller;

use Illuminate\Http\Request;

class SubcategoriesController extends Controller {

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
	 * @param  DatasetSubcategory $subcategory
	 * @return Response
	 */
	public function edit(DatasetSubcategory $subcategory)
	{
		return view( 'subcategories.edit', compact( 'subcategory' ) );
	}

	/**
	 * Update the specified resource in storage.
	 *
	 * @param  DatasetSubcategory $subcategory
	 * @param  Request $request
	 * @return Response
	 */
	public function update(DatasetSubcategory $subcategory, Request $request)
	{
		$input = array_except( $request->all(), [ '_method', '_token' ] );
		$subcategory->update( $input );
		return redirect()->route( 'categories.show', $subcategory->fk_dst_cat_id)->with( 'message', 'Subcategory updated.');
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
