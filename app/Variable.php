<?php namespace App;

use Illuminate\Database\Eloquent\Model;

class Variable extends Model {

	protected $guarded = ['id'];
	
	public function data() {
		return $this->hasMany( 'App\DataValue', 'fk_var_id' );
	}

	public function dataset() {
		return $this->belongsTo( 'App\Dataset', 'fk_dst_id' );
	}

	public function datasource() {
		return $this->hasOne( 'App\Datasource', 'id', 'fk_dsr_id' );
	}

	public function saveData( $data ) {
		$this->data()->saveMany( $data );
	}

	public function scopeUpdateSource( $query, $variableId, $newDatasourceId ) {
		if( !empty( $newDatasourceId ) ) {
			$variable = Variable::find( $variableId );
			//is it event necessary to update source?
			if( $variable->fk_dsr_id != $newDatasourceId ) {
				//it is update both variable source all sources of all variable values
				$variable->fk_dsr_id = $newDatasourceId;
				$variable->save();
				//update all variable values
				DataValue::where( 'fk_var_id', $variable->id )->update( array( 'fk_dsr_id' => $newDatasourceId ) );
			}
		}
	}

	public function scopeGetSources( $query, $datasourcesIds ) {

		return $query
			->leftJoin( 'datasets', 'variables.fk_dst_id', '=', 'datasets.id' )
			->leftJoin( 'datasources', 'variables.fk_dsr_id', '=', 'datasources.id' )
			->whereIn( 'variables.fk_dsr_id', $datasourcesIds )
			->select( \DB::raw( 'datasources.*, datasets.name as dataset_name, variables.id as var_id, variables.name as var_name, variables.description as var_desc, variables.unit as var_unit, variables.created_at as var_created' ) )
			->groupBy( 'datasources.id' ); 

	}

	public function scopeGetSource( $query, $variableId ) {

		return $query
			->leftJoin( 'datasets', 'variables.fk_dst_id', '=', 'datasets.id' )
			->leftJoin( 'datasources', 'variables.fk_dsr_id', '=', 'datasources.id' )
			->where( 'variables.id', '=', $variableId )
			->select( \DB::raw( 'datasources.*, datasets.name as dataset_name, variables.id as var_id, variables.name as var_name, variables.description as var_desc, variables.unit as var_unit, variables.created_at as var_created' ) )
			->groupBy( 'datasources.id' ); 

	}

}
