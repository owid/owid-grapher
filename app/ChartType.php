<?php namespace App;

use Illuminate\Database\Eloquent\Model;

class ChartType extends Model {

	public function dimensions() {
		return $this->hasMany( 'App\ChartTypeDimension', 'fk_chart_type_id' );
	}

}
