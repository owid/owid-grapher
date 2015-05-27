<?php namespace App\Http\Controllers;

use DB;
use App\Variable;
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
			$values = $variable->data;
			return view( 'variables.show', compact('variable','values') );
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
