<?php namespace App;

use Illuminate\Database\Eloquent\Model;

class Source extends Model {
	protected $guarded = ['id'];
    protected $touches = ['variables'];
	
    public function variables()
    {
    	return $this->hasMany( 'App\Variable', 'fk_dsr_id', 'id' );
    }

    public function values()
    {
    	return $this->hasMany( 'App\DataValue', 'fk_dsr_id', 'id' );
    }

}
