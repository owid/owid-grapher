<?php namespace App;

use Illuminate\Database\Eloquent\Model;
use Input;
use DB;
use Log;

class ChartDimension extends Model {
	public $timestamps = false;
	protected $guarded = array();

    // HACK (Mispy): Bug with some versions of PHP(?) where integers come back
    // as strings from the database.
    protected $casts = [
        'chartId' => 'integer',
        'variableId' => 'integer',
        'order' => 'integer',
        'tolerance' => 'integer',
        'targetYear' => 'integer',
        'isProjection' => 'boolean'
    ];

	public function chart() {
		return $this->belongsTo('App\Chart', 'chartId');
	}
}
