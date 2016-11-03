<?php namespace App;

use Illuminate\Database\Eloquent\Model;
use Input;
use DB;
use Log;
use Config;

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

			$oldSelectedCountries = $config->{"selected-countries"};
			$config->{"selected-countries"} = $query->get();
			foreach ($config->{"selected-countries"} as $entity) {
				// Preserve custom colors
				foreach ($oldSelectedCountries as $oldEntity) {
					if (isset($oldEntity->color) && $oldEntity->name == $entity->name)
						$entity->color = $oldEntity->color;
				}
			}
		}

		return $config;		
	}

	public static function findWithRedirects($slug) {
		$chart = Chart::whereNotNull('published')->where(function($query) use ($slug) {
			$query->where('slug', $slug)
				  ->orWhere('id', $slug);
		})->first();

		if (!$chart) {
			// Check and see if this was an old chart slug
			$redirect = DB::table('chart_slug_redirects')->select('chart_id')->where('slug', '=', $slug)->first();
			if ($redirect)
				$chart = Chart::whereNotNull('published')->whereId($redirect->chart_id)->first();
		}

		return $chart;		
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
		if (env('APP_ENV', 'production') == 'local') return;
		
		$phantomjs = base_path() . "/phantomjs/phantomjs";
		$rasterize = base_path() . "/phantomjs/rasterize.js";
		$target = \Request::root() . "/" . $slug . ".export" . "?" . $query;
		$queryHash = hash('md5', $query);
		$file = public_path() . "/exports/" . $slug . "-" . $queryHash . ".png";
		$tmpfile = $file . "#tmp";

		if (!file_exists($file) && !file_exists($tmpfile)) {
			// Create a temporary marker file so we don't double up on requests
			touch($tmpfile);
			$command = "(" . $phantomjs . " " . $rasterize . " " . escapeshellarg($target) . " " . escapeshellarg($file) . " '" . $width . "px*" . $height . "px'" . " >/dev/null 2>/dev/null; rm " . $tmpfile . ";) &";
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

	public function getUrl() {
		return env('APP_URL') . '/' . $this->slug;
	}

	public function makeCacheTag() {
		// Create a cache tag we can send along to the client. This uniquely identifies a particular
		// combination of dataset variables, and is sent along to DataController when the chart requests
		// all of its data. Allows us to reduce chart loading times by caching most of the data in
		// Cloudflare or the browser.
		$variableCacheTag = strval($this->updated_at) . ' + ' . Config::get('owid.commit');
		$config = json_decode($this->config);
		$dims = $config->{"chart-dimensions"};
		$varIds = array_pluck($dims, "variableId");

		$varTimestamps = DB::table("variables")
			->whereIn("id", $varIds)
			->select("updated_at")
			->lists("updated_at");

		$variableCacheTag .= implode(" + ", $varTimestamps);
		$variableCacheTag = hash("md5", $variableCacheTag);		
		return $variableCacheTag;
	}
}
