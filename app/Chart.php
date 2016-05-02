<?php namespace App;

use Illuminate\Database\Eloquent\Model;
use Input;
use DB;

class Chart extends Model {

	protected $guarded = ['id'];
	protected $dates = ['created_at', 'updated_at', 'last_edited_at'];

	public static function getConfigWithUrl($chart) {
		$config = json_decode($chart->config);
		$config->id = $chart->id;
		$config->{"chart-notes"} = $chart->notes;
		$config->{"chart-slug"} = $chart->slug;
		$config->{"data-entry-url"} = $chart->origin_url;

		// Allow url parameters to override the chart's default
		// selected countries configuration. We need to use the raw
		// query string for this because we want to distinguish between
		// %20 and +.
		preg_match("/country=([^&]+)/", $_SERVER['QUERY_STRING'], $matches);
		if ($matches) {
			$countryCodes = array_map(function($code) { return urldecode($code); }, explode("+", $matches[1]));
			$query = DB::table('entities')
				->select('id', 'name')
				->whereIn('code', $countryCodes)
				->orWhere(function($query) use ($countryCodes) {
					$query->whereIn('name', $countryCodes);
				});

			$config->{"selected-countries"} = $query->get();			
		}

		// Remove any invalid variables from the chart config
		$dims = json_decode($config->{"chart-dimensions"});
		$varIds = array_map(function($d) { return $d->variableId; }, $dims);
		$existingIds = DB::table("variables")->select('id')->whereIn('id', $varIds)->lists('name', 'id');
		if (sizeof($existingIds) != sizeof($varIds)) {		
			$config->{"chart-dimensions"} = "[]";
			$config->{"form-config"}->{"variables-collection"} = [];
		}

		//possibly there could logo query parameter
		if (!empty($config) && !empty(Input::get('logo'))) {
			//there's logo query parameter, we want to display chart with different logo
			//find logo by name
			$logo = Logo::where('name', '=', Input::get('logo'))->first();
			if( !empty( $logo ) ) {
				//set logo in config with logo from query parameter
				$config->{"second-logo"} = $logo->url;
			}
		}

		return $config;		
	}
}
