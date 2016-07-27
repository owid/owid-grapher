<?php namespace App;

use Illuminate\Database\Eloquent\Model;

class Dataset extends Model {
	protected $guarded = ['id'];

	public function variables() {
		return $this->hasMany('App\Variable', 'fk_dst_id');
	}
	public function dimensions() {
		
	}
	public function category() {
		return $this->hasOne('App\DatasetCategory', 'id', 'fk_dst_cat_id');
	}
	public function subcategory() {
		return $this->hasOne('App\DatasetSubcategory', 'id', 'fk_dst_subcat_id');
	}
	public function tags() {
		return $this->hasMany('App\LinkDatasetsTags', 'fk_dst_id');
	}
}
