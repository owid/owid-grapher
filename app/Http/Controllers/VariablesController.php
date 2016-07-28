<?php namespace App\Http\Controllers;

use DB;
use Input;
use App\Source;
use App\Variable;
use App\Entity;
use App\DataValue;
use App\Http\Requests;
use App\Http\Controllers\Controller;

use Illuminate\Http\Request;

use Cache;

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
			
			$source = DataValue::grid()->where( 'fk_var_id', '=', $variable->id ); 
			
			//$source = DataValue::with( array('Entity','Time') )->where( 'fk_var_id', '=', $variable->id ); 
			
			$entityList = DataValue::where( 'fk_var_id', '=', $variable->id )->lists('fk_var_id');
			$entities = Entity::whereIn( 'id', $entityList );
			
			//datagrid & filter
			$filter = \DataFilter::source( $source );
			$filter->attributes(array('class'=>'form-inline'));
			$filter->add('value','Value', 'text');
			
			$entitiesList = Entity::lists('name', 'name');
			$entitiesList[''] = 'All';
			
			$filter->add('Entities.name','Entity','select')->options( $entitiesList );
			$filter->add('year','Time', 'text');
			$filter->submit('search');
			$filter->build();
			
			$grid = \App\Components\BatchDataGrid::source( $filter );
			$grid->add( 'id', 'ID', true)->style( 'width:100px' );
			$grid->add( 'value', 'Value', true);
			$grid->add( 'name', 'Entity', true);
			$grid->add( 'year', 'Time', true);
			$grid->add( 'description', 'Description' );
			$grid->add( '<a href="' .route( 'values.index' ). '/{{$id}}/edit">Edit</a>', 'Edit' );
			$grid->paginate( 50 );
			
			//is csv export?
			if( Input::has( 'export' ) && Input::get( 'export' ) == 'csv' ) {
				return $grid->buildCSV('export_variable', 'Y-m-d.His'); 
			}

			//construct csv export url
			$exportUrl = $request->fullUrl() . (str_contains($request->fullUrl(), '?') ? '&' : '?') . 'export=csv';
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
		$sources = Source::lists( 'name', 'id' );
		return view( 'variables.edit', compact( 'variable', 'sources' ) );
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
		//need to update data value sources?
		if( $request->has( "fk_dsr_id" ) ) {
			Variable::updateSource( $variable->id, $request->get( "fk_dsr_id" ) );
		}
		$variable->update( $input );

		Cache::flush();

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
		try {
			$variable->delete();			
		} catch (\Exception $e) {
			$msg = $e->errorInfo[2];
			if (str_contains($msg, "chart_dimensions_variableid_foreign"))
				$msg = "Variable cannot be deleted while a chart still needs it. Delete charts or change their variables first.";
			return redirect()->route('variables.show', $variable->id)->with('message', $msg)->with('message-class', 'error');
		}

		$variable->delete();
		Cache::flush();
		return redirect()->route('datasets.show', $variable->fk_dst_id)->with('message', 'Variable deleted.');
	}

	public function batchDestroy(Variable $variable, Request $request)
	{	
		if ($request->has('value_ids')) {
			$valueIds = $request->get('value_ids');
			$idsArr = json_decode($valueIds);
			DataValue::destroy($idsArr);

			Cache::flush();

			return redirect()->route('variables.show', $variable->id)->with('message', 'Values deleted.')->with( 'message-class', 'success' );
		}
		return redirect()->route('variables.show', $variable->id);
	
	}

	public function updateSource(Variable $variable, $newSourceId) {

		if( !empty( $newSourceId ) ) {
			//is it event necessary to update source?
			if( $variable->fk_dsr_id != $newSourceId ) {
				//it is update both variable source all sources of all variable values
				$variable->fk_dsr_id = $newSourceId;
				$variable->save();
				//update all variable values
				DataValue::where( 'fk_var_id', $variable->id )->update( array( 'fk_dsr_id' => $newSourceId ) );

				Cache::flush();
		
			}
		}

	}

}
