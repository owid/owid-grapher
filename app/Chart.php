<?php namespace App;

use Illuminate\Database\Eloquent\Model;
use Input;
use DB;
use Log;

class Chart extends Model {
	protected $guarded = ['id'];
	protected $dates = ['created_at', 'updated_at', 'last_edited_at'];
	protected $casts = [
		'published' => 'boolean'
	];

	public function dimensions() {
		return $this->hasMany('App\ChartDimension', 'chartId')->orderBy('order');
	}

	public function variables() {
		return $this->belongsToMany('App\Variable', 'chart_dimensions', 'chartId', 'variableId');
	}

	public function showType() {
		$config = json_decode($this->config);

		$type = "Unknown";
		if ($this->type == "LineChart")
			$type = "Line Chart";
		else if ($this->type == "ScatterPlot")
			$type = "Scatter Plot";
		else if ($this->type == "StackedArea")
			$type = "Stacked Area";
		else if ($this->type == "MultiBar")
			$type = "Multi Bar";
		else if ($this->type == "HorizontalMultiBar")
			$type = "Horizontal Multi Bar";
		else if ($this->type == "DiscreteBar")
			$type = "Discrete Bar";

		if (isset($config->{"default-tab"}) && $config->{"default-tab"} == "map") {
			if (in_array("chart", $config->{"tabs"}))
				return "Map + " . $type;
			else
				return "Map";
		} else {
			if (in_array("map", $config->{"tabs"}))
				return $type . " + Map";
			else
				return $type;
		}
	}

	// HACK (Mispy): Tests don't set $_SERVER['QUERY_STRING']
	public static function getQueryString() {
		if (isset($_SERVER['QUERY_STRING']))
			return $_SERVER['QUERY_STRING'];
		else
			return "";
	}

	public static function getConfigWithUrl($chart) {
		$config = json_decode($chart->config);
		$config->id = $chart->id;
		$config->{"chart-name"} = $chart->name;
		$config->{"chart-type"} = $chart->type;
		$config->{"chart-notes"} = $chart->notes;
		$config->{"chart-slug"} = $chart->slug;
		$config->{"data-entry-url"} = $chart->origin_url;
		$config->{"published"} = $chart->published;
		$config->{"chart-dimensions"} = $chart->dimensions->toArray();

		// Allow url parameters to override the chart's default
		// selected countries configuration. We need to use the raw
		// query string for this because we want to distinguish between
		// %20 and +.
		preg_match("/country=([^&]+)/", Chart::getQueryString(), $matches);
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
	 * Shell out to phantomjs to take a screenshot of our chart + download the svg
	 *
	 * @param string $slug The chart slug to export.
	 * @param int $width Desired width in pixels of the exported image.
	 * @param int $height Desired height in pixels of the exported image. 
	 * @param string $format Either "svg" or "png". Both will be saved, only affects return
	 * @return string Path to exported file.
	 */
	public static function export($slug, $query, $width, $height, $format) {
		$phantomjs = base_path() . "/phantomjs/phantomjs";
		$rasterize = base_path() . "/phantomjs/rasterize.js";
		$target = \Request::root() . "/" . $slug . ".export" . "?" . $query;
		$queryHash = hash('md5', $query);
		$pngFile = public_path() . "/exports/" . $slug . "-" . $queryHash . ".png";		
		$returnFile = public_path() . "/exports/" . $slug . "-" . $queryHash . "." . $format;	

		if (!file_exists($returnFile)) {
			$command = $phantomjs . " " . $rasterize . " " . escapeshellarg($target) . " " . escapeshellarg($pngFile) . " '" . $width . "px*" . $height . "px'" . " 2>&1";
			Log::info($command);
			exec($command, $output, $retval);

			if ($retval != 0)
           		return \App::abort(406, json_encode($output));
		}


		return $returnFile;
	}

	public static function exportPNGAsync($slug, $query, $width, $height) {
		$phantomjs = base_path() . "/phantomjs/phantomjs";
		$rasterize = base_path() . "/phantomjs/rasterize.js";
		$target = \Request::root() . "/" . $slug . ".export" . "?" . $query;
		$queryHash = hash('md5', $query);
		$file = public_path() . "/exports/" . $slug . "-" . $queryHash . ".png";
		$tmpfile = $file . "#tmp";

		if (!file_exists($file) && !file_exists($tmpfile)) {
			// Create a temporary marker file so we don't double up on requests
			touch($tmpfile);
			$command = $phantomjs . " " . $rasterize . " " . escapeshellarg($target) . " " . escapeshellarg($file) . " '" . $width . "px*" . $height . "px'" . " >/dev/null 2>/dev/null &";
			Log::info($command);
			exec($command);
		}
	}

	// We're using a null/true boolean so that the uniqueness index doesn't
	// try to verify slugs for unpublished charts
	public function setPublishedAttribute($value) {
		if ($value) {
			$this->attributes['published'] = true;
		} else {
			$this->attributes['published'] = null;
		}
	}

	public function getPublishedAttribute($value) {
		return !!$value;
	}
}
