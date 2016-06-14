<?php namespace App\Http\Controllers;

use App;
use App\Chart;
use App\Setting;
use App\Http\Requests;
use App\Http\Controllers\Controller;
use Symfony\Component\HttpFoundation\StreamedResponse;

use Illuminate\Http\Request;
use Debugbar;
use DB;
use URL;
use Config;

class ViewController extends Controller {

	/**
	 * Display a listing of the resource.
	 *
	 * @return Response
	 */
	public function index()
	{
		return 'No chart selected to view';
	}

	public function testall()
	{
		$ids = DB::table('charts')->select('id')->where('origin_url', '!=', "")->lists('id');
		$charts = [];

		foreach ($ids as $id) {
			$charts[] = [
				'localUrl' => \Request::root() . "/view/" . $id,
				'liveUrl' => "http://ourworldindata.org/grapher/view/" . $id
			];
		}

		return view('testall')->with([ 'charts' => $charts ]);
	}

	public function show($slug)
	{
		$chart = Chart::where('slug', $slug)->orWhere('id', $slug)->first();		
		if (!$chart) {
			// Check and see if this was an old chart slug
			$redirect = DB::table('chart_slug_redirects')->select('chart_id')->where('slug', '=', $slug)->first();
			if ($redirect)
				$chart = Chart::find($redirect->chart_id);
			else
				return App::abort(404, "No such chart");
		}

		return $this->showChart($chart);
	}

	private function export($slug, Request $request, $format) {
		$chart = Chart::where('slug', $slug)
					  ->orWhere('id', $slug)
					  ->first();

		if (!$chart)
			return App::abort(404, "No such chart");

		$size = $request->input("size");
		if (!$size) $size = "1000x700";
		$split = explode("x", $size);
		$width = min(intval($split[0]), 3000);
		$height = min(intval($split[1]), 3000);

		if (isset($_SERVER['QUERY_STRING']))
			$file = Chart::export($slug, $_SERVER['QUERY_STRING'], $width, $height, $format);

		return response()->file($file);
	}

	public function exportPNG($slug, Request $request) {
		return $this->export($slug, $request, "png");
	}

	public function exportSVG($slug, Request $request) {
		return $this->export($slug, $request, "svg");
	}

	public function exportCSV($slug, Request $request) {
		$chart = Chart::where('slug', $slug)
					  ->orWhere('id', $slug)
					  ->first();

		if (!$chart)
			return App::abort(404, "No such chart");

		$config = json_decode($chart->config);

		// Allow url parameters to override the chart's default
		// selected countries configuration. We need to use the raw
		// query string for this because we want to distinguish between
		// %20 and +.
		preg_match("/country=([^&]+)/", Chart::getQueryString(), $matches);
		if ($matches) {
			$countryCodes = array_map(function($code) { return urldecode($code); }, explode("+", $matches[1]));

			$query = DB::table('entities')
				->select('id', 'name');

			if ($countryCodes[0] != "ALL") {
				$query = $query->whereIn('code', $countryCodes)
					->orWhere(function($query) use ($countryCodes) {
						$query->whereIn('name', $countryCodes);
					});
			}

			$config->{"selected-countries"} = $query->get();
		}

		$dims = json_decode($config->{"chart-dimensions"});
		$varIds = array_map(function($dim) { return $dim->variableId; }, $dims);

		// Grab the variable names for the header row
		$variableNameById = DB::table('variables')
			->whereIn('id', $varIds)
			->select('id', 'name')
			->lists('name', 'id');

		$entityNames = array_map(function($entity) { return $entity->name; }, $config->{"selected-countries"});
		$entityIds = DB::table('entities')
			->whereIn('name', $entityNames)
			->lists('id');

		// Now we pull out all the actual data
		$dataQuery = DB::table('data_values')
			->whereIn('data_values.fk_var_id', $varIds);
		
		if ($entityIds)
			$dataQuery = $dataQuery->whereIn('data_values.fk_ent_id', $entityIds);

		$dataQuery = $dataQuery
			->select('value', 'year',
					 'data_values.fk_var_id as var_id', 
					 'entities.id as entity_id', 'entities.name as entity_name',
					 'entities.code as entity_code');

		if ($request->input('year'))
			$dataQuery = $dataQuery->where("year", "=", $request->input('year'));

		$dataQuery = $dataQuery->join('entities', 'data_values.fk_ent_id', '=', 'entities.id')
			->orderBy('entities.name', 'ASC')
			->orderBy('year', 'ASC')
			->orderBy('fk_var_id', 'ASC');


		// MISPY: Streaming response to handle memory limitations when
		// exporting very large amounts of data
		$response = new StreamedResponse(function() use ($varIds, $variableNameById, $dataQuery) {
			$out = fopen('php://output', 'w');

			$headerRow = ['Country', 'Year'];
			foreach ($varIds as $id) {
				$headerRow[]= $variableNameById[$id];
			}
			fputcsv($out, $headerRow);

			$currentRow = null;

			foreach ($dataQuery->get() as $result) {
				if (!$currentRow || $currentRow[0] != $result->entity_name || $currentRow[1] != $result->year) {
					if ($currentRow)
						fputcsv($out, $currentRow);

					// New row
					$currentRow = [$result->entity_name, $result->year];
					for ($i = 0; $i < sizeof($varIds); $i++) {
						$currentRow[]= "";
					}
				}

				$index = 2+array_search($result->var_id, $varIds);
				$currentRow[$index] = $result->value;
			}

			// Final row
			fputcsv($out, $currentRow);
		}, 200, [
			"Content-Type" => "text/csv",
			"Content-Disposition" => 'attachment; filename="' . $chart->slug . '.csv' . '"'	
		]);

		return $response;
	}


	public function showChart(Chart $chart) 
	{
		$referer_s = \Request::header('referer'); 
		if ($referer_s) {
			$root = parse_url(\Request::root());
			$referer = parse_url($referer_s);
			if ($root['host'] == $referer['host'] && strlen($referer['path']) > 1 && !str_contains($referer_s, ".html") && !str_contains($referer_s, "wp-admin") && !str_contains($referer_s, "preview=true") && !str_contains($referer_s, "how-to") && !str_contains($referer_s, "grapher") && !str_contains($referer_s, "about") && !str_contains($referer_s, "roser/")) {
				$chart->origin_url = "https://" . $root['host'] . $referer['path'];
				$chart->save();
			}
		}

		if ($chart) {
			$config = Chart::getConfigWithUrl($chart);
			$data = new \StdClass;
			$logoUrl = Setting::where( 'meta_name', 'logoUrl' )->first();
			$data->logoUrl = ( !empty( $logoUrl ) )? url('/') .'/'. $logoUrl->meta_value: '';
			$canonicalUrl = URL::to($chart->slug);			

			// Make metadata for twitter embed cards!
			$chartMeta = new \StdClass;

			// Replace the chart title placeholders with generic equivalents for now
			$title = $config->{"chart-name"};
			$title = preg_replace("/, \*time\*/", " over time", $title);
			$title = preg_replace("/\*time\*/", "over time", $title);	
			$chartMeta->title = $title;

			// Description is required by twitter
			if (isset($config->{"chart-subname"}))
				$chartMeta->description = $config->{"chart-subname"};
			else 
				$chartMeta->description = "An interactive visualization from Our World In Data.";

			$query = Chart::getQueryString();

			$baseUrl = \Request::root() . "/" . $chart->slug;
			$canonicalUrl = $baseUrl;
			$imageUrl = $baseUrl . ".png";
			if ($query != '') {
				$canonicalUrl .= "?" . $query;
				$imageUrl .= "?" . $query;
			}

			$chartMeta->imageUrl = $imageUrl;
			$chartMeta->canonicalUrl = $canonicalUrl;

			// Give the image exporter a head start on the request for imageUrl
			if (!str_contains(\Request::path(), ".export"))
				Chart::exportPNGAsync($chart->slug, Chart::getQueryString() . "&size=1000x700", 1000, 700);


			// Create a cache tag we can send along to the client. This uniquely identifies a particular
			// combination of dataset variables, and is sent along to DataController when the chart requests
			// all of its data. Allows us to reduce chart loading times by caching most of the data in
			// CloudFlare or the browser.
			$variableCacheTag = strval($chart->updated_at) . ' + ' . Config::get('owid.commit');
			$dims = json_decode($config->{"chart-dimensions"});
			$varIds = array_pluck($dims, "variableId");

			$varTimestamps = DB::table("variables")
				->whereIn("id", $varIds)
				->select("updated_at")
				->lists("updated_at");

			$variableCacheTag .= implode(" + ", $varTimestamps);
			$variableCacheTag = hash("md5", $variableCacheTag);
			$config->variableCacheTag = $variableCacheTag;

			return response()
					->view('view.show', compact('chart', 'config', 'data', 'canonicalUrl', 'chartMeta'));
		} else {
			return 'No chart found to view';
		}
	}

	// Redirect to the most recent visualization, for use on the home page
	public function latest() {
		$slug = DB::table("charts")
			->orderBy("created_at", "DESC")
			->whereNotNull("origin_url")
			->select("slug")
			->first()->slug;

		$query = Chart::getQueryString();

		return redirect()->to("/" . $slug . ($query ? "?" : "") . $query);
	}
}
