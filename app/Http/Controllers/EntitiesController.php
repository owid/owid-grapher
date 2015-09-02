<?php namespace App\Http\Controllers;

use App\Entity;
use App\Http\Requests;
use App\Http\Controllers\Controller;

use Illuminate\Http\Request;

use Cache;

class EntitiesController extends Controller {

	/**
	 * Display a listing of the resource.
	 *
	 * @return Response
	 */
	public function index()
	{
		$entities = Entity::all();

		$grid = \DataGrid::source('entities');
		$grid->add( 'id', 'ID', true)->style( 'width:100px' );
        $grid->add( 'name', 'Name', true);
		$grid->add( '<a href="' .route( 'entities.index' ). '/{{$id}}">View</a>', 'View' );
		$grid->add( '<a href="' .route( 'entities.index' ). '/{{$id}}/edit">Edit</a>', 'Edit');
        $grid->paginate(10);

		return view( 'entities.index', compact('grid') );

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
		return 'store';
	}

	/**
	 * Display the specified resource.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function show(Entity $entity)
	{	
		return view( 'entities.show', compact( 'entity' ) );
	}

	/**
	 * Show the form for editing the specified resource.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function edit(Entity $entity)
	{
		return view( 'entities.edit', compact( 'entity' ) );
	}

	/**
	 * Update the specified resource in storage.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function update(Entity $entity, Request $request)
	{
		$input = array_except( $request->all(), [ '_method', '_token' ] );
		$entity->update( $input );

		Cache::flush();

		return redirect()->route( 'entities.show', $entity->id)->with( 'message', 'Entity updated.');
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
		Cache::flush();
	}

}
