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
use App\Setting;

use App\Http\Requests;
use App\Http\Controllers\Controller;

use Illuminate\Http\Request;

use DB;
use App\Commands\ImportCommand;
use Carbon\Carbon;

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
		$sourceTemplate = Setting::where( 'meta_name', 'sourceTemplate' )->first();

		$data = [
			'datasets' => $datasets,
			'datasources' => $datasources,
			'variables' => $variables,
			'categories' => $categories,
			'subcategories' => $subcategories,
			'varTypes' => $varTypes,
			'sourceTemplate' => $sourceTemplate
		];	

		return view( 'import.index' )->with( 'data', $data );
	}

	/**
	 * Import a collection of variables
	 */
	public function variables(Request $request) {
		$input = $request->all();

		DB::transaction(function() use ($input) {
			// First, we create the dataset object itself
			$dataset = $input['dataset'];
			$entities = $input['entities'];
			$years = $input['years'];

			if (isset($dataset['id']))
				$datasetId = $dataset['id'];			
			else {
				$datasetProps = [
					'name' => $dataset['name'],
					'description' => $dataset['description'],					
					'fk_dst_cat_id' => $dataset['categoryId'],
					'fk_dst_subcat_id' => $dataset['subcategoryId'],
					'fk_dsr_id' => $dataset['sourceId']
				];

				$datasetId = Dataset::create($datasetProps);
			}

			// Now map the entity names we've been given to ids, and
			// create any new ones that aren't in the database
			$entityNames = array_unique($entities);

			$entityNameToId = DB::table('entities')
				->select('id', 'name')
				->whereIn('name', $entityNames)
				->lists('id', 'name');

			$newEntities = [];
			foreach ($entityNames as $name) {
				if (isset($entityNameToId[$name])) continue;
				$newEntities[] = [ 'name' => $name, 'fk_ent_t_id' => 5 ];
			}

			if (!empty($newEntities)) {
				DB::table('entities')->insert($newEntities);
				$lastId = DB::getPdo()->lastInsertId();
				$firstId = $lastId - sizeof($newEntities);
				for ($id = $firstId; $id < $lastId; $id++) {
					$name = $newEntities[$id-$firstId]['name'];
					$entityNameToId[$name] = $id;
				}
			}
		});

		return [ 'success' => true ];
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

	/** temp **/
	/*public function test(Request $request) {

		$start = microtime(true);
		
		//$this->dispatch( new TestQueuedCommand() );
		\Queue::push(new TestQueuedCommand());

		$time_elapsed_secs = microtime(true) - $start;
		
		return $time_elapsed_secs;

		//$this->dispatchFrom( 'App\Commands\TestCommand', $request );
		
		//\Queue::push(new TestCommand($request->get('id')));

		return $request->get('id');
	}*/


	public function hasValue($value) {

		return ( !empty( $value ) || $value === "0" || $value === 0 )? true: false;

	}

	public function inputfile(Request $request) {

		try {
			
			$rawData = ( $request->has( 'rawData' ) )? $request->get( 'rawData' ): '';
			$userId = ( $request->has( 'userId' ) )? $request->get( 'userId' ): '';

			$inputFileData = [ 'raw_data' => $rawData, 'fk_user_id' => $userId ];
			$inputFile = InputFile::create( $inputFileData ); 
			$inputFileDataId = $inputFile->id;
			return [ 'success' => true, 'data' => [ 'inputFileId' => $inputFileDataId ] ];

		} catch( Exception $e ) {

			return ['success' => false];
		
		}

	}

	public function datasource(Request $request) {

		try {
			
			$sourceName = ( $request->has( 'name' ) )? $request->get( 'name' ): '';
			$sourceLink = ( $request->has( 'link' ) )? $request->get( 'link' ): '';
			$sourceDescription = ( $request->has( 'description' ) )? $request->get( 'description' ): '';

			if( !empty( $sourceName ) ) {
				$datasourceData = [ 'name' => $sourceName, 'link' => $sourceLink, 'description' => $sourceDescription ];
				$datasource = Datasource::create( $datasourceData );
				$datasourceId = $datasource->id;
				return [ 'success' => true, 'data' => [ 'datasourceId' => $datasourceId ] ];
			}

			return [ 'success' => false ];

		} catch( Exception $e ) {

			return ['success' => false ];
		
		}

	}

	public function dataset(Request $request) {

		try {
			
			if( $request->input( 'new_dataset' ) === '1' ) {
			
				//creating new dataset
				$datasetName = ( $request->has( 'name' ) )? $request->get( 'name' ): '';
				$datasetTags = ( $request->has( 'datasetTags' ) )? $request->get( 'datasetTags' ): '';
				$datasetDescription = ( $request->has( 'description' ) )? $request->get( 'description' ): '';
				$datasourceId = ( $request->has( 'datasourceId' ) )? $request->get( 'datasourceId' ): '';
				$datasetCategoryId = ( $request->has( 'categoryId' ) )? $request->get( 'categoryId' ): '';
				$datasetSubcategoryId = ( $request->has( 'subcategoryId' ) )? $request->get( 'subcategoryId' ): '';

				$datasetData = [ 'name' => $datasetName, 'fk_dst_cat_id' => $datasetCategoryId, 'fk_dst_subcat_id' => $datasetSubcategoryId, 'description' => $datasetDescription, 'fk_dsr_id' => $datasourceId ];
				$dataset = Dataset::create( $datasetData );
				$datasetId = $dataset->id;
					
				//process possible tags
				if( !empty( $datasetTags ) ) {
					$tagsArr = explode( ',', $datasetTags );
					foreach( $tagsArr as $tag ) {
						$tag = DatasetTag::create( [ 'name' => $tag ] );
						$tagId = $tag->id;
						$datasetTagLink = LinkDatasetsTags::create( [ 'fk_dst_id' => $datasetId, 'fk_dst_tags_id' => $tagId ] );
					}
				}

			} else {
				
				//existing dataset - do nothing for now
				$datasetId = $request->input( 'existing_dataset_id' );
				
			}

			return [ 'success' => true, 'data' => [ 'datasetId' => $datasetId ] ];

		} catch( Exception $e ) {

			return ['success' => false ];
		
		}
		
	}


	public function variable(Request $request) {

		try {

			$variableObj = $request->all();
			
			$varId = ( $request->has( 'varId' ) )? $request->get( 'varId' ): '';
			$varName = ( $request->has( 'name' ) )? $request->get( 'name' ): '';
			$varType = ( $request->has( 'variableType' ) )? $request->get( 'variableType' ): 1;
			$varUnit = ( $request->has( 'unit' ) )? $request->get( 'unit' ): '';
			$varDescription = ( $request->has( 'description' ) )? $request->get( 'description' ): '';

			$datasetId = ( $request->has( 'datasetId' ) )? $request->get( 'datasetId' ): '';
			$datasourceId = ( $request->has( 'datasourceId' ) )? $request->get( 'datasourceId' ): '';
			
			//$variableObj = json_decode( $variableJsonString, false );
			$variableData = [ 'name' => $varName, 'fk_var_type_id' => $varType, 'fk_dst_id' => $datasetId, 'unit' => $varUnit, 'description' => $varDescription, 'fk_dsr_id' => $datasourceId, 'uploaded_by' => \Auth::user()->name, 'uploaded_at' => Carbon::now() ];

			//update of existing variable or new variable
			if( empty( $varId ) ) {
				//new variable
				$variable = Variable::create( $variableData ); 
			} else {
				//update variable
				$variable = Variable::find( $varId );
				if( !empty( $variable ) ) {
					$variable->fill( $variableData );
					$variable->save();
				} else {
					//not found existing variable
					return [ 'success' => false ];
				}
			}
			$variableId = $variable->id;

			return [ 'success' => true, 'data' => [ 'variableId' => $variableId ] ];

		} catch( Exception $e ) {

			return ['success' => false ];
		
		}

	}

	public function entity(Request $request) {
		
		try {

			$name = $request->get('name');
			$entityCheck = ( $request->has( 'entityCheck' ) )? $request->get( 'entityCheck' ): false;
			$inputFileDataId = ( $request->has( 'inputFileId' ) )? $request->get( 'inputFileId' ): '';
			$datasourceId = ( $request->has( 'datasourceId' ) )? $request->get( 'datasourceId' ): '';
			$variableId = ( $request->has( 'variableId' ) )? $request->get( 'variableId' ): '';
			
			$entityData = [ 'name' => $name, 'fk_ent_t_id' => 5, 'validated' => 0 ];

			if( $entityCheck ) {
				//entity validation (only if not multivariant dataset)
				//find corresponding iso code
				$entityIsoName = EntityIsoName::match( $entityData['name'] )->first();
				if(!$entityIsoName) {
					return redirect()->route( 'import' )->with( 'message', 'Error non-existing entity in dataset.' )->with( 'message-class', 'error' );
				}
				//enter standardized info
				$entityData['name'] = $entityIsoName->name;
				$entityData['code'] = $entityIsoName->code;
				$entityData['validated'] = 1;
			}
						
			//find try finding entity in db
			if( isset( $entityIsoName ) ) {
				$entity = Entity::where( 'code', $entityIsoName->code )->first();
			} else {
				//not standardized data
				$entity = Entity::where( 'code', $entityData['name'] )->orWhere( 'name', $entityData['name'] )->first();
			}
			
			if( !$entity ) {
				//entity haven't found in database, so insert it
				$entity = Entity::create( $entityData ); 
			}

			//check to override validation if stored in db not validated and now is validate
			if( $entity->validated == 0 && $entityData[ 'validated' ] === 1 ) {
				$entity->validated = 1;
				$entity->save();
			}

			$entityId = $entity->id;
			$countryValues = $request->get( "values" );//$countryValue->values;

			//prepare vars for mass insert
			$times = [];
			$values = [];

			//TODO - get latest time for base timeId 
			$lastTime = Time::orderBy('id', 'desc')->first();
			$timeId = ( !empty( $lastTime  ) )? $lastTime->id: 0;

			foreach( $countryValues as $value ) {
				
				if( isset( $value[ 'x' ] ) && isset( $value[ 'y' ] ) && $this->hasValue( $value[ 'x' ] ) && $this->hasValue( $value[ 'y' ] ) ) {

					$timeId++;

					//create time
					$timeObj = $value[ 'x' ];
					$timeValue = [ 
						'startDate' => ( isset($timeObj['sd']) )? $timeObj['sd']: "", 
						'endDate' => ( isset($timeObj['ed']) )? $timeObj['ed']: "", 
						'date' =>  ( isset($timeObj['d']) )? $timeObj['d']: "", 
						'label' =>  ( isset($timeObj['l']) )? $timeObj['l']: ""
					];
					//convert timedomain 
					$fk_ttype_id = 1;
					if( !empty($timeObj['td']) ) {
						$ttQuery = TimeType::query();
						$fk_ttype_id = $ttQuery->whereRaw( 'LOWER(`name`) like ?', [$timeObj['td']] )->first()->id;
					} 	
					$timeValue['fk_ttype_id'] = $fk_ttype_id;

					//using mass insert instead
					//$time = Time::create( $timeValue );
					//$timeId = $time->id;
					$times[] = $timeValue;

					//create value
					$dataValueData = [ 'value' => $value['y'], 'fk_time_id' => $timeId, 'fk_input_files_id' => $inputFileDataId, 'fk_var_id' => $variableId, 'fk_ent_id' => $entityId, 'fk_dsr_id' => $datasourceId ];
					
					//using mass insert instead
					//$dataValue = DataValue::create( $dataValueData );
					$values[] = $dataValueData;

				}

			}

			//mass insertion
			Time::insert( $times );
			DataValue::insert( $values );

			return ['success' => true ];
		
		} catch( Exception $e ) {

			return ['success' => false ];
		
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
