<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;
use App\Chart;

class ChartDimensionsDestringify extends Migration
{
    public function up()
    {
        DB::transaction(function() {
            $charts = Chart::all();
            foreach ($charts as $chart) {
                $config = json_decode($chart->config);
                if (!isset($config->{'chart-dimensions'}))
                    $config->{'chart-dimensions'} = [];
                else if (is_string($config->{'chart-dimensions'}))
                    $config->{'chart-dimensions'} = json_decode($config->{'chart-dimensions'});
                $chart->config = json_encode($config);
                $chart->save();
            }
        });
    }
}
