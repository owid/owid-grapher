<?php namespace App;

use Illuminate\Database\Eloquent\Model;
use Input;
use DB;
use Log;

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

	/**
	 * Shell out to phantomjs to take a screenshot of our chart 
	 *
	 * @param string $slug The chart slug to export.
	 * @param int $width Desired width in pixels of the exported image.
	 * @param int $height Desired height in pixels of the exported image. 
	 * @return string Path to exported file.
	 */
	public static function exportPNG($slug, $query, $width, $height) {
		$phantomjs = base_path() . "/node_modules/.bin/phantomjs";
		$rasterize = base_path() . "/phantomjs/rasterize.js";
		$target = \Request::root() . "/" . $slug . ".export" . "?" . $query;
		$file = public_path() . "/exports/" . $slug . ".png" . "?" . $query;

		if (!file_exists($file)) {
			$command = $phantomjs . " " . $rasterize . " " . escapeshellarg($target) . " " . escapeshellarg($file) . " '" . $width . "px*" . $height . "px'" . " 2>&1";
			Log::info($command);
			exec($command, $output, $retval);

			if ($retval != 0)
           		return App::abort(406, json_encode($output));
		}

		return $file;
	}

	public static function exportPNGAsync($slug, $query, $width, $height) {
		$phantomjs = base_path() . "/node_modules/.bin/phantomjs";
		$rasterize = base_path() . "/phantomjs/rasterize.js";
		$target = \Request::root() . "/" . $slug . ".export" . "?" . $query;
		$file = public_path() . "/exports/" . $slug . ".png" . "?" . $query;
		$tmpfile = $file . "#tmp";

		if (!file_exists($file) && !file_exists($tmpfile)) {
			// Create a temporary marker file so we don't double up on requests
			touch($tmpfile);
			$command = $phantomjs . " " . $rasterize . " " . escapeshellarg($target) . " " . escapeshellarg($file) . " '" . $width . "px*" . $height . "px'" . " >/dev/null 2>/dev/null &";
			Log::info($command);
			exec($command);
		}
	}

}
