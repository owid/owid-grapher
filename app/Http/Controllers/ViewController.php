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
		$ids = DB::table('charts')->select('id')->where('last_referer_url', '!=', "")->lists('id');
		$charts = [];

		foreach ($ids as $id) {
			$charts[] = [
				'localUrl' => \Request::root() . "/view/" . $id,
				'liveUrl' => "http://ourworldindata.org/grapher/view/" . $id
			];
		}

		return view('testall')->with([ 'charts' => $charts ]);
	}

	/**
	 * Show the form for creating a new resource.
	 *
	 * @return Response
	 */
	public function create()
	{
		//
	}

	/**
	 * Store a newly created resource in storage.
	 *
	 * @return Response
	 */
	public function store()
	{
		//
	}

	/**
	 * Display the specified resource.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function showId($id)
	{	
		$chart = Chart::find( $id );
		if (!$chart)
			return App::abort(404, "No such chart");

		return $this->showChart($chart);
	}

	public function showSlug($slug)
	{
		$chart = Chart::where('slug', $slug)->first();		
		if (!$chart)
			return App::abort(404, "No such chart");

		return $this->showChart($chart);
	}

	public function showChart(Chart $chart) 
	{
		$referer_s = \Request::header('referer'); 
		if ($referer_s) {
			$root = parse_url(\Request::root());
			$referer = parse_url($referer_s);
			if ($root['host'] == $referer['host'] && !str_contains($referer_s, "/grapher/") && !str_contains($referer_s, "wp-admin") && !str_contains($referer_s, "preview=true") && !str_contains($referer_s, "how-to-our-world-in-data")) {
				$chart->last_referer_url = $root['scheme'] . "://" . $root['host'] . $referer['path'];
				$chart->save();
			}
		}

		if( $chart ) {
			$data = new \StdClass;
			$logoUrl = Setting::where( 'meta_name', 'logoUrl' )->first();
			$data->logoUrl = ( !empty( $logoUrl ) )? url('/') .'/'. $logoUrl->meta_value: '';
			$canonicalUrl = URL::to($chart->slug);			
			return view( 'view.show', compact( 'chart', 'data', 'canonicalUrl' ));
		} else {
			return 'No chart found to view';
		}
	}

	/**
	 * Show the form for editing the specified resource.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function edit($id)
	{
		//
	}

	/**
	 * Update the specified resource in storage.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function update($id)
	{
		//
	}

	/**
	 * Remove the specified resource from storage.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function destroy($id)
	{
		//
	}

}
