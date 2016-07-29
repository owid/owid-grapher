<?php namespace App;

use Illuminate\Database\Eloquent\Model;

class Variable extends Model {
	protected $guarded = ['id'];
	protected $touches = ['dataset'];

	public function data() {
		return $this->hasMany('App\DataValue', 'fk_var_id');
	}
	public function dataset() {
		return $this->belongsTo('App\Dataset', 'fk_dst_id');
	}
	public function source() {
		return $this->hasOne('App\Source', 'id', 'sourceId');
	}
	public function dimensions() {
		return $this->hasMany('App\ChartDimension', 'variableId');
	}
	public function charts() {
		return $this->belongsToMany('App\Chart', 'chart_dimensions', 'variableId', 'chartId');
	}

	public function scopeUpdateSource( $query, $variableId, $newSourceId ) {
		if( !empty( $newSourceId ) ) {
			$variable = Variable::find( $variableId );
			//is it event necessary to update source?
			if( $variable->sourceId != $newSourceId ) {
				//it is update both variable source all sources of all variable values
				$variable->sourceId = $newSourceId;
				$variable->save();
				//update all variable values
				DataValue::where( 'fk_var_id', $variable->id )->update( array( 'sourceId' => $newSourceId ) );
			}
		}
	}

	public function scopeGetSources( $query, $sourcesIds ) {
		return $query
			->leftJoin( 'datasets', 'variables.fk_dst_id', '=', 'datasets.id' )
			->leftJoin( 'sources', 'variables.sourceId', '=', 'sources.id' )
			->whereIn( 'variables.sourceId', $sourcesIds )
			->select( \DB::raw( 'sources.*, datasets.name as dataset_name, variables.id as var_id, variables.name as var_name, variables.description as var_desc, variables.unit as var_unit, variables.created_at as var_created' ) )
			->groupBy( 'sources.id' ); 
	}

	public function scopeGetSource( $query, $variableId ) {
		return $query
			->leftJoin( 'datasets', 'variables.fk_dst_id', '=', 'datasets.id' )
			->leftJoin( 'sources', 'variables.sourceId', '=', 'sources.id' )
			->where( 'variables.id', '=', $variableId )
			->select( \DB::raw( 'sources.*, datasets.name as dataset_name, variables.id as var_id, variables.name as var_name, variables.description as var_desc, variables.unit as var_unit, variables.created_at as var_created' ) )
			->groupBy( 'sources.id' ); 
	}

}
