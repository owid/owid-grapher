<?php namespace App\Http\Controllers;

use App\Datasource;
use App\Dataset;
use App\DatasetCategory;
use App\DatasetSubcategory;
use App\DatasetTag;
use App\LinkDatasetsTags;
use App\VariableType;
use App\InputFile;
use App\Variable;
use App\Time;
use App\TimeType;
use App\DataValue;
use App\EntityIsoName;
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
		$datasources = Datasource::all();
		$variables = Variable::all();
		$categories = DatasetCategory::all();
		$subcategories = DatasetSubcategory::all();
		$varTypes = VariableType::all();

		$data = [
			'datasets' => $datasets,
			'datasources' => $datasources,
			'variables' => $variables,
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
		//bump up limits
		set_time_limit( 600 ); 
		ini_set('memory_limit', '256M');

		$v = \Validator::make( $request->all(), [
			'variable_type' => 'required'
		] );
		if( $v->fails() ) {
			return redirect()->back()->withErrors($v->errors());
		}

		//create new file
		$inputFileData = [ 'raw_data' => $request->input( 'data' ), 'fk_user_id' => \Auth::user()->id ];
		$inputFile = InputFile::create( $inputFileData ); 
		$inputFileDataId = $inputFile->id;

		$multivariantDataset = $request->input( 'multivariant_dataset' );
		$variables = $request->input( 'variables' );
		
		if( !empty( $variables ) ) {

			$entityData = [];
			//either fetch existing datasource or new one 
			if( !empty( $request->input( 'datasource_id' ) ) ) {
				//fetching existing one
				$datasource = Datasource::find( $request->input( 'datasource_id' ) );
			} else {

				//creating new datasource, if there is some
				if( !empty( $request->input( 'source_name' ) ) ) {
					$datasourceData = [ 'name' => $request->input( 'source_name' ), 'link' => $request->input( 'source_link' ), 'description' => $request->input( 'source_description' ) ];
					$datasource = Datasource::create( $datasourceData );
				} else {
					//fake datasoure
					$datasource = new \stdClass;
					$datasource->id = null;
				}
					
			}
			
			//create new dataset or pick existing one
			if( $request->input( 'new_dataset' ) === '1' ) {
				$datasetName = $request->input( 'new_dataset_name' );

				$datasetData = [ 'name' => $datasetName, 'fk_dst_cat_id' => $request->input( 'category_id' ), 'fk_dst_subcat_id' => $request->input( 'subcategory_id' ), 'description' => $request->input( 'new_dataset_description' ), 'fk_dsr_id' => $datasource->id ];
				$dataset = Dataset::create( $datasetData );
				$datasetId = $dataset->id;
				
				//process possible tags
				$tagsInput = $request->input( 'new_dataset_tags' );
				if( !empty( $tagsInput ) ) {
					$tagsArr = explode( ',', $tagsInput );
					foreach( $tagsArr as $tag ) {
						$tag = DatasetTag::create( [ 'name' => $tag ] );
						$tagId = $tag->id;
						$datasetTagLink = LinkDatasetsTags::create( [ 'fk_dst_id' => $datasetId, 'fk_dst_tags_id' => $tagId ] );
					}
				}

			} else {
				$datasetId = $request->input( 'existing_dataset_id' );
				$dataset = Dataset::find( $datasetId );
				$datasetName = $dataset->name;
			}
			//store inserted variables, for case of rolling back
			$inserted_variables = array();
			foreach( $variables as $variableJsonString ) {
				
				//convert back single out to actual single quote
				//$variableJsonString = str_replace( "'", "‘", $variableJsonString );
				
				//setting json_decode second param to false, to try to save memory 
				$variableObj = json_decode( $variableJsonString, false );
				$variableData = [ 'name' => $variableObj->name, 'fk_var_type_id' => $request->input( 'variable_type' ), 'fk_dst_id' => $datasetId, 'unit' => $variableObj->unit, 'description' => $variableObj->description, 'fk_dsr_id' => $datasource->id ];

				//update of existing variable or new variable
				if( !isset( $variableObj->id ) ) {
					//new variable
					$variable = Variable::create( $variableData ); 
				} else {
					//update variable
					$variable = Variable::find( $variableObj->id );
					$variable->fill( $variableData );
					$variable->save();
				}
				$variableId = $variable->id;

				$inserted_variables[] = $variable;
				$variableValues = $variableObj->values;
				foreach( $variableValues as $countryValue ) {

					$entityData = [ 'name' => $countryValue->key, 'fk_ent_t_id' => 5 ];

					//entity validation (only if not multivariant dataset)
					//find corresponding iso code
					$entityIsoName = EntityIsoName::match( $entityData['name'] )->first();
					if(!$entityIsoName) {
						//!haven't found corresponding country, throw an error!
						
						//rollback everything first
						foreach($inserted_variables as $inserted_var) {
							$inserted_var->data()->delete();
							$inserted_var->delete();
						}
						//is new dataset
						if( $request->input( 'new_dataset' ) === '1' ) {
							$dataset = Dataset::find( $datasetId );
							//delete itself
							$dataset->delete();
						}
						\Log::error( 'Error non-existing entity in dataset.' );
						\Log::error( $entityData['name'] );
						return redirect()->route( 'import' )->with( 'message', 'Error non-existing entity in dataset.' )->with( 'message-class', 'error' );

					}
					//enter standardized info
					$entityData['name'] = $entityIsoName->name;
					$entityData['code'] = $entityIsoName->iso3;
					
					//find try finding entity in db
					$entity = Entity::where( 'code', $entityIsoName->iso3 )->first();
					if( !$entity ) {
						//entity haven't found in database, so insert it
						$entity = Entity::create( $entityData ); 
					}
					$entityId = $entity->id;
					$countryValues = $countryValue->values;

					//prepare vars for mass insert
					$times = [];
					$values = [];

					//TODO - get latest time for base timeId 
					$lastTime = Time::orderBy('id', 'desc')->first();
					$timeId = ( !empty( $lastTime  ) )? $lastTime->id: 0;

					foreach( $countryValues as $value ) {

						if( !empty( $value->x ) && !empty( $value->y ) ) {

							$timeId++;

							//create time
							$timeObj = $value->x;
							$timeValue = [ 
								'startDate' => ( isset($timeObj->sd) )? $timeObj->sd: "", 
								'endDate' => ( isset($timeObj->ed) )? $timeObj->ed: "", 
								'date' =>  ( isset($timeObj->d) )? $timeObj->d: "", 
								'label' =>  ( isset($timeObj->l) )? $timeObj->l: ""
							];
							//convert timedomain 
							$fk_ttype_id = 1;
							if( !empty($timeObj->td) ) {
								$ttQuery = TimeType::query();
								$fk_ttype_id = $ttQuery->whereRaw( 'LOWER(`name`) like ?', [$timeObj->td] )->first()->id;
							} 	
							$timeValue['fk_ttype_id'] = $fk_ttype_id;

							//using mass insert instead
							//$time = Time::create( $timeValue );
							//$timeId = $time->id;
							$times[] = $timeValue;

							//create value
							$dataValueData = [ 'value' => $value->y, 'fk_time_id' => $timeId, 'fk_input_files_id' => $inputFileDataId, 'fk_var_id' => $variableId, 'fk_ent_id' => $entityId, 'fk_dsr_id' => $datasource->id ];
							//$dataValue = DataValue::create( $dataValueData );
							$values[] = $dataValueData;

						}

					}

					Time::insert( $times );
					DataValue::insert( $values );
				
				}

			} 

			return redirect()->route( 'datasets.index' )->with( 'message', 'Insertion complete' )->with( 'message-class', 'success' );

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
