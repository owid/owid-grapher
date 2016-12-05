<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use DB;
use Carbon\Carbon;

class CloudflareInvalidate extends Command
{
    protected $signature = 'cf:invalidate';
    protected $description = 'Invalidate cloudflare cache fully';

    public function __construct() {
        parent::__construct();
    }


    public function handle() {
        $slugs = DB::table('charts')->select('slug')->lists('slug');
        $urls = [];

        foreach ($slugs as $slug) {
            $urls[]= "https://ourworldindata.org/grapher/" . $slug;
            $urls[]= "https://ourworldindata.org/grapher/" . $slug . "?tab=chart";
            $urls[]= "https://ourworldindata.org/grapher/" . $slug . "?tab=map";
            $urls[]= "https://ourworldindata.org/grapher/" . $slug . ".export";
        }

        $cache = new \Cloudflare\Zone\Cache(env('CLOUDFLARE_EMAIL'), env('CLOUDFLARE_KEY'));
        $count = 0;
        $total = count($urls);
        while (count($urls) > 0) {
            $nextBatch = array_slice($urls, 0, 30);
            $urls = array_slice($urls, 30);

            $cache->purge_files(env('CLOUDFLARE_ZONE_ID'), $nextBatch);                        
            $count += count($nextBatch);
            var_dump($count . "/" . $total);
        }
    }
}
