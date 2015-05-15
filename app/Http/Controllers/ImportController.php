<?php namespace App\Http\Controllers;

use App\Variable;
use App\Time;
use App\DataValue;
use App\Entity;

use App\Http\Requests;
use App\Http\Controllers\Controller;

use Illuminate\Http\Request;

class ImportController extends Controller {

	/**
	 * Display a listing of the resource.
	 *
	 * @return Response
	 */
	public function index()
	{
		/*$variable = Variable::find( 1 );
		$data = [
			new DataValue( [ 'value' => 'fads', 'description' => 'Description 1', 'fk_input_files_id' => 1 ] ),
			new DataValue( [ 'value' => 'adsf', 'description' => 'Description 2', 'fk_input_files_id' => 1 ] ) 
		];
		$variable->saveData( $data );*/
		return view( 'import.index' );
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
	public function store(Request $request)
	{
		/*$variable = Variable::find( 1 );
		$data = [
			new DataValue( [ 'value' => 'fads', 'description' => 'Description 1', 'fk_input_files_id' => 1 ] ),
			new DataValue( [ 'value' => 'adsf', 'description' => 'Description 2', 'fk_input_files_id' => 1 ] ) 
		];
		$variable->saveData( $data );*/
		
		$jsonString = $request->input( 'data' );
		if( !empty( $jsonString ) ) {
			
			$entityData = [];
			$json = json_decode( $jsonString );

			//create new file

			//create new variable
			$variableData = [ 'name' => $request->input( 'variable_name' ), 'fk_var_type_id' => 2 ];
			$variable = Variable::create( $variableData ); 
			$variableId = $variable->id;

			foreach( $json as $countryValue ) {

				//for now, always just create entities
				$entityData = [ 'name' => $countryValue->key, 'fk_ent_t_id' => 5 ];
				$entity = Entity::create( $entityData ); 
				$entityId = $entity->id;

				$countryValues = $countryValue->values;
				foreach( $countryValues as $value ) {

					//create time
					$timeValue = [ 'fromTime' => \DateTime::createFromFormat( 'Y', $value->x ), 'toTime' => \DateTime::createFromFormat( 'Y', $value->x ), 'label' => $value->x ];
					$time = Time::create( $timeValue );
					$timeId = $time->id;

					//create value
					$dataValueData = [ 'value' => $value->y, 'fk_time_id' => $timeId, 'fk_input_files_id' => 1, 'fk_var_id' => $variableId, 'fk_ent_id' => $entityId ];
					$dataValue = DataValue::create( $dataValueData );

				}

			}

			return redirect()->route( 'variables.index' )->with( 'message', 'Insertion complete.' );

		}
		
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
	public function edit($id)
	{
		//
	}

	/**
	 * Update the specified resource in storage.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function update($id)
	{
		//
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
