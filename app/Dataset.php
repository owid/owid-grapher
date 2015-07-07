<?php namespace App;

use Illuminate\Database\Eloquent\Model;

class Dataset extends Model {

	protected $guarded = ['id'];

	public function variables() {
		return $this->hasMany( 'App\Variable', 'fk_dst_id' );
	}
	public function category() {
		return $this->hasOne( 'App\DatasetCategory', 'id', 'fk_dst_cat_id' );
	}
	public function subcategory() {
		return $this->hasOne( 'App\DatasetSubcategory', 'id', 'fk_dst_subcat_id' );
	}
	public function datasource() {
		return $this->hasOne( 'App\Datasource', 'id', 'fk_dsr_id' );
	}
	public function tags() {
		return $this->hasMany( 'App\LinkDatasetsTags', 'fk_dst_id' );
	}

	public function scopeUpdateSource( $query, $datasetId, $newDatasourceId ) {
		if( !empty( $newDatasourceId ) ) {
			$dataset = Dataset::find( $datasetId );
			//is it event necessary to update source?
			if( $dataset->fk_dsr_id != $newDatasourceId ) {
				
				//get all variables
				$variables = $dataset->variables;
				foreach( $variables as $variable ) {
					Variable::updateSource( $variable->id, $newDatasourceId );
				}
				
			}
		}
	}
}
