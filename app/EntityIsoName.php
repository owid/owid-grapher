<?php namespace App;

use Illuminate\Database\Eloquent\Model;

class EntityIsoName extends Model {

	//
	public function scopeMatch( $query, $value ) {
		return $query->whereRaw('code LIKE ? OR name LIKE ?', array( $value, $value  ) );
	}

}
