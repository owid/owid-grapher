<?php namespace App;

use Illuminate\Database\Eloquent\Model;

class Entity extends Model {

	protected $guarded = ['id'];

	public function type() {
		return $this->hasOne( 'App\EntityType', 'id', 'fk_ent_t_id' );
	}

}
