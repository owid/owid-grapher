<?php namespace App\Http\Controllers;

use App\DatasetCategory;

use App\Http\Requests;
use App\Http\Controllers\Controller;

use Illuminate\Http\Request;

class CategoriesController extends Controller {

	/**
	 * Display a listing of the resource.
	 *
	 * @return Response
	 */
	public function index()
	{
		$categories = DatasetCategory::all();
		return view( 'categories.index', compact('categories') );
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
	public function store( Request $request )
	{
		DatasetCategory::create($request->all());
		return redirect()->route( 'categories.index' )->with( 'message', 'Category created.');
	
	}

	/**
	 * Display the specified resource.
	 *
	 * @param  Category $category
	 * @return Response
	 */
	public function show(DatasetCategory $category)
	{
		return view( 'categories.show', compact('category') );
	}

	/**
	 * Show the form for editing the specified resource.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function edit(DatasetCategory $category)
	{
		return view( 'categories.edit', compact( 'category' ) );
	}

	/**
	 * Update the specified resource in storage.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function update(DatasetCategory $category, Request $request)
	{
		$input = array_except( $request->all(), [ '_method', '_token' ] );
		$category->update( $input );
		return redirect()->route( 'categories.show', $category->id)->with( 'message', 'Category updated.');
	}

	/**
	 * Remove the specified resource from storage.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function destroy(DatasetCategory $category)
	{
		//delete itself
		$category->subcategories()->delete();
		$category->delete();
		
		return redirect()->route('categories.index')->with('message', 'Category deleted.');
	}

}
