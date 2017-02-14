<?php namespace App\Http\Controllers;

use App;
use App\Chart;
use App\Setting;
use App\Http\Requests;
use App\Http\Controllers\Controller;
use App\Logo;
use Symfony\Component\HttpFoundation\StreamedResponse;

use Illuminate\Http\Request;
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

	public function testall(Request $request)
	{
		$type = strtolower($request->input('type'));
		$tab = $request->input('tab');
		$page = $request->input('page');
		$compare = $request->input('compare') == '1';

		if (!$tab && $type == 'map') {
			$tab = 'map';
		} else if (!$tab && $type) {
			$tab = 'chart';
		}

		if (!$page)
			$page = 1;

		$chartsPerPage = 5;

		$query = Chart::where('published', '=', true)->where('origin_url', '!=', "");
		if ($type && $type != 'map')	
			$query = $query->where('type', '=', $type);

		$urls = [];
		$count = 0;
		foreach ($query->get() as $chart) {
			$config = json_decode($chart->config);
			$tabs = $config->tabs;

			if ($type == 'map' && !in_array('map', $tabs)) {
				continue;
			} else if ($type && !in_array('chart', $tabs)) {
				continue;
			}

			$count += 1;
			$localUrl = \Request::root() . "/" . $chart->slug;
			$liveUrl = "https://ourworldindata.org/grapher/" . $chart->slug;
			$localUrlPng = $localUrl . '.png';
			$liveUrlPng = $liveUrl . '.png';

			if ($tab) {
				$localUrl .= "?tab=" . $tab;
				$liveUrl .= "?tab=" . $tab;
				$localUrlPng .= "?tab=" . $tab;
				$liveUrlPng .= "?tab=" . $tab;
			}

			$urls[] = [
				'localUrl' => $localUrl,
				'liveUrl' => $liveUrl,
				'localUrlPng' => $localUrlPng,
				'liveUrlPng' => $liveUrlPng
			];
		}

		$numPages = ceil($count/$chartsPerPage);

		$nextPageUrl = null;
		if ($page < $numPages)
			$nextPageUrl = $request->fullUrlWithQuery(['page' => $page+1]);		

		$prevPageUrl = null;
		if ($page > 1)
			$prevPageUrl = $request->fullUrlWithQuery(['page' => $page-1]);			

		$urls = array_slice($urls, ($page-1)*$chartsPerPage, $chartsPerPage);

		return view('testall')->with(compact('urls', 'nextPageUrl', 'prevPageUrl', 'compare'));
	}

	public function show($slug)
	{
		$chart = Chart::findWithRedirects($slug);

		if (!$chart)
			return App::abort(404, "No such chart");

		return $this->showChart($chart);
	}

	private function export($slug, Request $request, $format) {
		$chart = Chart::findWithRedirects($slug);

		if (!$chart)
			return App::abort(404, "No such chart");

		$size = $request->input("size");
		if (!$size) $size = "1200x800";
		$split = explode("x", $size);
		$width = min(intval($split[0]), 3000);
		$height = min(intval($split[1]), 3000);

		$file = Chart::export($slug, $_SERVER['QUERY_STRING'], $width, $height, $format);

		return response()->file($file,
					['Cache-Control' => $request->input('v') ? 'public, max-age=31536000' : 'public, max-age=7200, s-maxage=604800',
					 'Content-Disposition' => 'attachment']);
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

		$dims = array_filter($config->{"chart-dimensions"}, function($dim) { return $dim->property == 'x' || $dim->property == 'y'; });
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

			$headerRow = ['Entity', 'Year'];
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
			if ($root['host'] == $referer['host'] && strlen($referer['path']) > 1 && !str_contains($referer_s, ".html") && !str_contains($referer_s, "wp-admin") && !str_contains($referer_s, "preview=true") && !str_contains($referer_s, "how-to") && !str_contains($referer_s, "grapher") && !str_contains($referer_s, "about") && !str_contains($referer_s, "roser/") && !str_contains($referer_s, "slides") && !str_contains($referer_s, 'blog')) {
				$origin_url = "https://" . $root['host'] . $referer['path'];
				if ($chart->origin_url != $origin_url) {
					$chart->origin_url = $origin_url;
					$chart->save();
				}
			}
		}

		if ($chart) {
			$config = Chart::getConfigWithUrl($chart);
			$data = new \StdClass;
			$canonicalUrl = URL::to($chart->slug);

			// Make metadata for Twitter and Facebook embed cards!
			$chartMeta = new \StdClass;

			// Replace the chart title placeholders with generic equivalents for now
			// This is because the real titles are calculated cilent-side
			$title = $config->{"title"};
			$title = preg_replace("/, \*time\*/", " over time", $title);
			$title = preg_replace("/\*time\*/", "over time", $title);	
			$chartMeta->title = $title;

			// Description is required by twitter
			if (!empty($config->{"subtitle"}))
				$chartMeta->description = $config->{"subtitle"};
			else 
				$chartMeta->description = "An interactive visualization from Our World In Data.";

			$query = Chart::getQueryString();

			$baseUrl = \Request::root() . "/" . $chart->slug;
			$canonicalUrl = $baseUrl;
			if ($query != '') {
				$canonicalUrl .= "?" . $query;
			}
			$chartMeta->canonicalUrl = $canonicalUrl;

			// Give the image exporter a head start on the request for imageUrl
			// This isn't a strong cachebuster (Cloudflare caches these meta tags) but it should help it get through eventually
			$imageQuery = $query . ($query ? "&" : "") . "size=1200x800&v=" . $chart->makeCacheTag();
			if (!str_contains(\Request::path(), ".export")) {
				Chart::exportPNGAsync($chart->slug, $imageQuery, 1200, 800);
			}

			$chartMeta->imageUrl = $baseUrl . ".png?" . $imageQuery;
			$resp = response()->view('view.show', compact('chart', 'canonicalUrl', 'chartMeta', 'query'));
					
			if (str_contains(\Request::path(), ".export")) {
				// We don't cache the export urls, just the resulting pngs
				$resp->header('Cache-Control', 'no-cache');				
			} else {
				$resp->header('Cache-Control', 'public, max-age=0, s-maxage=604800');
			}

			return $resp;
		} else {
			return 'No chart found to view';
		}
	}

	// Get the main config information for a chart
	// This is the only request whose urls are invalidated on Cloudflare when the chart is 
	// edited, so it is responsible for version stamping everything else.
	public function config($chartId) {
		$chart = Chart::find($chartId);
		$config = Chart::getConfigWithUrl($chart);
		$config->variableCacheTag = $chart->makeCacheTag();

		return response('App.loadChart(' . json_encode($config) . ')')
			->header('Content-Type', 'application/javascript')
			->header('Cache-Control', 'public, max-age=0, s-maxage=604800');
	}

	// Redirect to the most recent visualization, for use on the home page
	public function latest() {
		$slug = DB::table("charts")
			->orderBy("created_at", "DESC")
			->where("starred", "=", true)
			->whereNotNull("published")
			->select("slug")
			->first()->slug;

		$query = Chart::getQueryString();

		return redirect()->to("/" . $slug . ($query ? "?" : "") . $query);
	}

	// Get a logo by name
	public function logo($logoName) {
		$logo = Logo::where('name', '=', $logoName)->first();
		return redirect()->to($logo->url);
	}
}
