<?php namespace App\Http\Controllers;

use App\Dataset;
use App\Datasource;
use App\DatasetCategory;
use App\DatasetSubcategory;
use App\Http\Requests;
use App\Http\Controllers\Controller;

use Illuminate\Http\Request;

use Cache;
use DB;
use Carbon\Carbon;

class DatasetsController extends Controller {

	/**
	 * Display a listing of the resource.
	 *
	 * @return Response
	 */
	public function index()
	{
		$variables = DB::table('variables')
			->select('variables.id', 'variables.name', 'variables.uploaded_at', 'variables.uploaded_by',
					 'datasets.id as dataset_id', 'datasets.name as dataset_name',
					 'datasources.id as source_id', 'datasources.name as source_name')
			->join('datasets', 'variables.fk_dst_id', '=', 'datasets.id')
			->join('datasources', 'variables.fk_dsr_id', '=', 'datasources.id')
			->orderBy('datasets.created_at', 'desc')
			->get();

		return view('datasets.index', compact('variables'));
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
	public function show(Dataset $dataset)
	{
		return view( 'datasets.show', compact('dataset') );
	}

	/**
	 * Show the form for editing the specified resource.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function edit(Dataset $dataset)
	{
		$datasources = Datasource::lists( 'name', 'id' );
		$categories = DatasetCategory::all()->lists( 'name', 'id' );
		$subcategories = DatasetSubcategory::all()->lists( 'name', 'id' );
		return view( 'datasets.edit', compact( 'dataset', 'categories', 'subcategories', 'datasources' ) );
	}

	/**
	 * Update the specified resource in storage.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function update(Dataset $dataset, Request $request)
	{
		$input = array_except( $request->all(), [ '_method', '_token' ] );
		//need to update data value sources?
		if( $request->has( "fk_dsr_id" ) ) {
			Dataset::updateSource( $dataset->id, $request->get( "fk_dsr_id" ) );
		}
		$dataset->update( $input );

		Cache::flush();

		return redirect()->route( 'datasets.show', $dataset->id)->with( 'message', 'Dataset updated.');
	}

	/**
	 * Remove the specified resource from storage.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function destroy(Dataset $dataset, Request $request)
	{	

		$dataset->delete();
		Cache::flush();		
		return redirect()->route('datasets.index')->with('message', 'Dataset deleted.');
	}

}
