<?php namespace App\Commands;

use App\Commands\Command;
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

use Illuminate\Queue\SerializesModels;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Contracts\Bus\SelfHandling;
use Illuminate\Contracts\Queue\ShouldBeQueued;



class ImportCommand extends Command implements SelfHandling, ShouldBeQueued {

	use InteractsWithQueue, SerializesModels;

	public $validate_entities;
	public $data;
	public $userId;
	public $multivariant_dataset;
	public $variables;
	public $source_name;
	public $source_link;
	public $source_description;
	public $new_dataset;
	public $new_dataset_name;
	public $category_id;
	public $subcategory_id;
	public $new_dataset_description;
	public $new_dataset_tags;
	public $existing_dataset_id;
	public $variable_type;

	/**
	 * Create a new command instance.
	 *
	 * @return void
	 */
	public function __construct( $validate_entities, $data, $userId, $multivariant_dataset, $variables, $source_name, $source_link, $source_description, $new_dataset, $new_dataset_name, $category_id, $subcategory_id, $new_dataset_description, $new_dataset_tags, $existing_dataset_id, $variable_type)
	{
		$this->validate_entities = $validate_entities;
		$this->data = $data;
		$this->userId = $userId;
		$this->multivariant_dataset = $multivariant_dataset;
		$this->variables = $variables;
		$this->source_name = $source_name;
		$this->source_link = $source_link;
		$this->source_description = $source_description;
		$this->new_dataset = $new_dataset;
		$this->new_dataset_name = $new_dataset_name;
		$this->category_id = $category_id;
		$this->subcategory_id = $subcategory_id;
		$this->new_dataset_description = $new_dataset_description;
		$this->new_dataset_tags = $new_dataset_tags;
		$this->existing_dataset_id = $existing_dataset_id;
		$this->variable_type = $variable_type;

	}

	/**
	 * Execute the command.
	 *
	 * @return void
	 */
	public function handle()
	{	
		//set_time_limit( 600 ); 
		//ini_set('memory_limit', '256M');
		
		//bump up limits
		set_time_limit( 600 ); 
		ini_set('memory_limit', '256M');
		
		return;

		//will we be checking entities
		$entityCheck = ( $this->validate_entities == 'on' )? false: true;

		//create new file
		$inputFileData = [ 'raw_data' => $this->data, 'fk_user_id' => $this->userId ];
		$inputFile = InputFile::create( $inputFileData ); 
		$inputFileDataId = $inputFile->id;

		$multivariantDataset = $this->multivariant_dataset;
		$variables = $this->variables;
			
		if( !empty( $variables ) ) {

			$entityData = [];
			//creating new datasource, if there is some
			$sourceName = $this->source_name;
			if( !empty( $sourceName ) ) {
				$datasourceData = [ 'name' => $this->source_name, 'link' => $this->source_link, 'description' => $this->source_description ];
				$datasource = Datasource::create( $datasourceData );
			} else {
				//fake datasoure
				$datasource = new \stdClass;
				$datasource->id = null;
			}
			
			
			//create new dataset or pick existing one
			$datasetName = $this->new_dataset_name;
			$datasetData = [ 'name' => $datasetName, 'fk_dst_cat_id' => $this->category_id, 'fk_dst_subcat_id' => $this->subcategory_id, 'description' => $this->new_dataset_description, 'fk_dsr_id' => $datasource->id ];
			$dataset = Dataset::create( $datasetData );
			$datasetId = $dataset->id;
			
			//process possible tags
			$tagsInput = $this->new_dataset_tags;
			if( !empty( $tagsInput ) ) {
				$tagsArr = explode( ',', $tagsInput );
				foreach( $tagsArr as $tag ) {
					$tag = DatasetTag::create( [ 'name' => $tag ] );
					$tagId = $tag->id;
					$datasetTagLink = LinkDatasetsTags::create( [ 'fk_dst_id' => $datasetId, 'fk_dst_tags_id' => $tagId ] );
				}
			}

			//store inserted variables, for case of rolling back
			$inserted_variables = array();
			foreach( $variables as $variableJsonString ) {
				
				//convert back single out to actual single quote
				//$variableJsonString = str_replace( "'", "‘", $variableJsonString );
				
				//setting json_decode second param to false, to try to save memory 
				$variableObj = json_decode( $variableJsonString, false );
				$variableData = [ 'name' => $variableObj->name, 'fk_var_type_id' => $this->variable_type, 'fk_dst_id' => $datasetId, 'unit' => $variableObj->unit, 'description' => $variableObj->description, 'fk_dsr_id' => $datasource->id ];

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

					$entityData = [ 'name' => $countryValue->key, 'fk_ent_t_id' => 5, 'validated' => 0 ];

					if( $entityCheck ) {
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
							if( $this->new_dataset === '1' ) {
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
					$countryValues = $countryValue->values;

					//prepare vars for mass insert
					$times = [];
					$values = [];

					//TODO - get latest time for base timeId 
					$lastTime = Time::orderBy('id', 'desc')->first();
					$timeId = ( !empty( $lastTime  ) )? $lastTime->id: 0;

					foreach( $countryValues as $value ) {

						if( $this->hasValue( $value->x ) && $this->hasValue( $value->y ) ) {

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
							
							//using mass insert instead
							//$dataValue = DataValue::create( $dataValueData );
							$values[] = $dataValueData;

						}

					}

					//mass insertion
					Time::insert( $times );
					DataValue::insert( $values );
				
				}

			} 

		}
	}

	public function hasValue($value) {

		return ( !empty( $value ) || $value === "0" || $value === 0 )? true: false;

	}

}
