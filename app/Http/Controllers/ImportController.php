<?php namespace App\Http\Controllers;

use App\Dataset;
use App\DatasetCategory;
use App\DatasetSubcategory;
use App\VariableType;
use App\InputFile;
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

		$datasets = Dataset::all();
		$categories = DatasetCategory::all();
		$subcategories = DatasetSubcategory::all();
		$varTypes = VariableType::all();

		$data = [
			'datasets' => $datasets,
			'categories' => $categories,
			'subcategories' => $subcategories,
			'varTypes' => $varTypes
		];

		return view( 'import.index' )->with( 'data', $data );
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
			$inputFileData = [ 'raw_data' => $jsonString, 'fk_user_id' => 1 ];
			$inputFile = InputFile::create( $inputFileData ); 
			$inputFileDataId = $inputFile->id;

			//create new dataset or pick existing one
			if( $request->input( "new_dataset" ) === "1" ) {
				$datasetName = $request->input( 'new_dataset_name' );
				$datasetData = [ 'name' => $datasetName, 'fk_dst_cat_id' => $request->input( 'category_id' ), 'fk_dst_subcat_id' => $request->input( 'subcategory_id' ) ];
				$dataset = Dataset::create( $datasetData );
				$datasetId = $dataset->id;
			} else {
				$datasetId = $request->input( 'existing_dataset_id' );
				$dataset = Dataset::find( $datasetId );
				$datasetName = $dataset->name;
			}
			
			//create new variable
			$variableData = [ 'name' => $datasetName, 'fk_var_type_id' => $request->input( 'variable_type' ), 'fk_dst_id' => $datasetId ];
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
					$dataValueData = [ 'value' => $value->y, 'fk_time_id' => $timeId, 'fk_input_files_id' => $inputFileDataId, 'fk_var_id' => $variableId, 'fk_ent_id' => $entityId ];
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
