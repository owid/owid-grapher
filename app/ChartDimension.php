<?php namespace App;

use Illuminate\Database\Eloquent\Model;
use Input;
use DB;
use Log;

class ChartDimension extends Model {
	public $timestamps = false;
	protected $guarded = array();

	public function chart() {
		return $this->belongsTo('App\Chart', 'chartId');
	}
}
