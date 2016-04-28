<?php namespace App\Http\Controllers;

use App;
use App\Chart;
use App\Setting;
use App\Http\Requests;
use App\Http\Controllers\Controller;

use Illuminate\Http\Request;
use Debugbar;
use DB;
use URL;

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
		if (!$chart)
			return App::abort(404, "No such chart");

		return $this->showChart($chart);
	}

	public function exportPNG($slug, Request $request) {
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

		$phantomjs = base_path() . "/node_modules/.bin/phantomjs";
		$rasterize = base_path() . "/phantomjs/rasterize.js";
		$target = $request->root() . "/" . $slug . ".export" . "?" . $request->getQueryString();
		$file = public_path() . "/exports/" . $slug . ".png" . "?" . $request->getQueryString();

		if (!file_exists($file)) {
			$command = $phantomjs . " " . $rasterize . " " . escapeshellarg($target) . " " . escapeshellarg($file) . " '" . $width . "px*" . $height . "px'" . " 2>&1";
			exec($command, $output, $retval);			

			if ($retval != 0)
           		return App::abort(406, json_encode($output));
		}


		return response()->file($file);
	}

	public function exportCSV($slug, Request $request) {
		$chart = Chart::where('slug', $slug)
					  ->orWhere('id', $slug)
					  ->first();

		if (!$chart)
			return App::abort(404, "No such chart");

		$config = json_decode($chart->config);

		// Allow overriding selected-countries with url param
		$countryStr = $request->input('country');
		if (!empty($countryStr)) {
			$countryCodes = explode(" ", $countryStr);
			$query = DB::table('entities')
				->select('id', 'name')
				->whereIn('code', $countryCodes);
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

		$rows = [];
		$headerRow = ['Country', 'Year'];
		foreach ($varIds as $id) {
			$headerRow[]= $variableNameById[$id];
		}
		$rows[]= $headerRow;

		$currentRow = null;

		// Now we pull out all the actual data
		$dataQuery = DB::table('data_values')
			->whereIn('data_values.fk_var_id', $varIds);
		
		if ($entityIds)
			$dataQuery = $dataQuery->whereIn('data_values.fk_ent_id', $entityIds);

		$dataQuery = $dataQuery
			->select('value', 'year',
					 'data_values.fk_var_id as var_id', 
					 'entities.id as entity_id', 'entities.name as entity_name',
					 'entities.code as entity_code')
			->join('entities', 'data_values.fk_ent_id', '=', 'entities.id')
			->orderBy('entities.name', 'DESC')
			->orderBy('year', 'ASC')
			->orderBy('fk_var_id', 'ASC');

		foreach ($dataQuery->get() as $result) {
			if (!$currentRow || $currentRow[0] != $result->entity_name || $currentRow[1] != $result->year) {
				if ($currentRow)
					$rows[]= $currentRow;

				// New row
				$currentRow = [$result->entity_name, $result->year];
				for ($i = 0; $i < sizeof($varIds); $i++) {
					$currentRow[]= "";
				}
			}

			$index = 2+array_search($result->var_id, $varIds);
			$currentRow[$index] = $result->value;
		}

		// Use memory file pointer so we can have fputcsv escape for us
		$fp = fopen('php://memory', 'w+');
		foreach ($rows as $row) {
			fputcsv($fp, $row);
		}
		rewind($fp);
		$csv = stream_get_contents($fp);
		fclose($fp); 
		return response($csv, 200)
				->header('Content-Type', 'text/csv')
				->header('Content-Disposition', 'attachment; filename="' . $chart->slug . '.csv' . '"');		
	}


	public function showChart(Chart $chart) 
	{
		$referer_s = \Request::header('referer'); 
		if ($referer_s) {
			$root = parse_url(\Request::root());
			$referer = parse_url($referer_s);
			if ($root['host'] == $referer['host'] && strlen($referer['path']) > 1 && !str_contains($referer_s, ".html") && !str_contains($referer_s, "wp-admin") && !str_contains($referer_s, "preview=true") && !str_contains($referer_s, "how-to") && !str_contains($referer_s, "grapher") && !str_contains($referer_s, "about")) {
				$chart->origin_url = "https://" . $root['host'] . $referer['path'];
				$chart->save();
			}
		}

		if ($chart) {
			$config = json_decode($chart->config);
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

			$query = \Request::getQueryString();			
			$imageUrl = \Request::root() . "/" . $chart->slug . ".png";
			if ($query != '')
				$imageUrl .= "?" . $query;

			$chartMeta->imageUrl = $imageUrl;

			return view( 'view.show', compact( 'chart', 'data', 'canonicalUrl', 'chartMeta' ));
		} else {
			return 'No chart found to view';
		}
	}
}
