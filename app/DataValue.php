<?php namespace App;

use Illuminate\Database\Eloquent\Model;

class DataValue extends Model {

	protected $guarded = ['id'];
	protected $table = 'data_values';

	public function entity() {
		return $this->hasOne( 'App\Entity', 'id', 'fk_ent_id' );
	}

	public function time() {
		return $this->hasOne( 'App\Time', 'id', 'fk_time_id' );
	}

	public function datasource() {
		return $this->hasOne( 'App\Datasource', 'id', 'fk_dsr_id' );
	}

	public function scopeGrid($query)
    {
        return $query->leftJoin( 'entities', 'data_values.fk_ent_id', '=', 'entities.id' )->leftJoin( 'times', 'data_values.fk_time_id', '=', 'times.id' )->select( \DB::raw( 'data_values.*, times.label, entities.name' ) );
    }

}
