<?php namespace App;

use Illuminate\Database\Eloquent\Model;

class EntityIsoName extends Model {

	//
	public function scopeMatch( $query, $value ) {
		//return $query->whereRaw('iso2 LIKE ? OR iso3 LIKE ? OR cow3 LIKE ? OR name LIKE ?', array( $value, $value, $value, $value ) );
		$query->where('iso2', 'LIKE', $value );
		$query->orWhere('iso3', 'LIKE', $value );
		$query->orWhere('cow3', 'LIKE', $value );
		$query->orWhere('name', 'LIKE', $value );
		return $query;
	}

}
