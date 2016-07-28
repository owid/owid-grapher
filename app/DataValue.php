<?php namespace App;

use Illuminate\Database\Eloquent\Model;

class DataValue extends Model {
	protected $guarded = ['id'];
	protected $touches = ['variable'];
	protected $table = 'data_values';

	public function variable() {
		return $this->hasOne('App\Variable', 'id', 'fk_var_id');
	}

	public function entity() {
		return $this->hasOne( 'App\Entity', 'id', 'fk_ent_id' );
	}

	public function source() {
		return $this->hasOne( 'App\Source', 'id', 'fk_dsr_id' );
	}

	public function scopeGrid($query)
    {
        return $query->leftJoin( 'entities', 'data_values.fk_ent_id', '=', 'entities.id' )->select( \DB::raw( 'data_values.*, entities.name' ) );
    }

}
