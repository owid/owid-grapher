<?php namespace App;

use Illuminate\Database\Eloquent\Model;

class Source extends Model {
	protected $guarded = ['id'];
    protected $touches = ['variables'];
	
    public function variables()
    {
    	return $this->hasMany( 'App\Variable', 'sourceId', 'id' );
    }
}
