<?php namespace App\Http\Controllers;

use DB;
use Input;
use App\Variable;
use App\Entity;
use App\DataValue;
use App\Http\Requests;
use App\Http\Controllers\Controller;

use Illuminate\Http\Request;

class VariablesController extends Controller {

	/**
	 * Display a listing of the resource.
	 *
	 * @return Response
	 */
	public function index()
	{
		$variables = Variable::all();
		return view( 'variables.index', compact('variables') );
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
	public function show( Variable $variable, Request $request )
	{
		if( $request->ajax() )
		{
			//use query builder instead of eloquent
			$rawData = DB::table( 'data_values' )
				->join( 'entities', 'data_values.fk_ent_id', '=', 'entities.id' )
				->join( 'times', 'data_values.fk_time_id', '=', 'times.id' )
				->where( 'data_values.fk_var_id', $variable->id )
				->get();
			
			$data = [];
			$index = 1;

			foreach( $rawData as $d ) {

				if( !array_key_exists( $d->name, $data ) ) {
					$obj = new \StdClass;
					$obj->id = $index;
					$obj->key = $d->name;
					$obj->values = [];
					$data[ $d->name ] = $obj;
					$index++;
				}
				$data[ $d->name ]->values[] = [ "x" => intval($d->label), "y" => intval($d->value) ];

			}
			return ['success' => true, 'data' => [ 'variable' => $variable, 'data' => $data ] ];
		} else {
			
			//data
			$values = $variable->data;
			$source = DataValue::with( array('Entity','Time') )->where( 'fk_var_id', '=', $variable->id ); 
			$entityList = DataValue::where( 'fk_var_id', '=', $variable->id )->lists('fk_var_id');
			$entities = Entity::whereIn( 'id', $entityList );

			//datagrid & filter
			$filter = \DataFilter::source( $source );
			$filter->attributes(array('class'=>'form-inline'));
			$filter->add('value','Value', 'text');
			//$filter->add('Entity.name','Entity', 'text');
			//$filter->add('Entity.name','Entity','select')->options($entities->lists('name','name'));
			$filter->add('Entity.name','Entity','select')->options( Entity::lists('name', 'name'));
			$filter->add('Time.label','Time', 'text');
			//$filter->add('Time.label','Time','daterange')->format('m/d/Y', 'en');
        	$filter->submit('search');
			$filter->build();

			$grid = \App\Components\BatchDataGrid::source( $filter );
			$grid->add( 'id', 'ID', true)->style( 'width:100px' );
			$grid->add( 'value', 'Value', true);
			$grid->add( 'Entity.name', 'Entity', true);
			$grid->add( 'Time.label', 'Time', true);
			$grid->add( 'description', 'Description' );

			//$grid->checkbox('title','Title');

			$grid->add( '<a href="' .route( 'values.index' ). '/{{$id}}/edit">Edit</a>', 'Edit' );
			//$grid->paginate(10);

			//is csv export?
			if( Input::has( 'export' ) && Input::get( 'export' ) == 'csv' ) {
				return $grid->buildCSV('export_variable', 'Y-m-d.His'); 
			}

			//construct csv export url
			$exportUrl = $request->fullUrl() .'&export=csv';
			
			return view( 'variables.show', compact( 'variable', 'values', 'grid', 'filter', 'exportUrl' ) );
		}
	}

	/**
	 * Show the form for editing the specified resource.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function edit(Variable $variable)
	{
		return view( 'variables.edit', compact( 'variable' ) );
	}

	/**
	 * Update the specified resource in storage.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function update(Variable $variable, Request $request)
	{
		$input = array_except( $request->all(), [ '_method', '_token' ] );
		$variable->update( $input );
		return redirect()->route( 'variables.show', $variable->id)->with( 'message', 'Variable updated.');
	}

	/**
	 * Remove the specified resource from storage.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function destroy(Variable $variable, Request $request)
	{
		//delete data
		$variable->data()->delete();
		//delete itself
		$variable->delete();
		
		return redirect()->route('datasets.show', $variable->fk_dst_id)->with('message', 'Variable deleted.');
	}

}
