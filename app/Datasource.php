<?php namespace App;

use Illuminate\Database\Eloquent\Model;

class Datasource extends Model {

	protected $guarded = ['id'];
	
	public function datasets()
    {
    	return $this->hasMany( 'App\Dataset', 'fk_dsr_id', 'id' );
    }

    public function variables()
    {
    	return $this->hasMany( 'App\Variable', 'fk_dsr_id', 'id' );
    }

    public function values()
    {
    	return $this->hasMany( 'App\DataValue', 'fk_dsr_id', 'id' );
    }

}
