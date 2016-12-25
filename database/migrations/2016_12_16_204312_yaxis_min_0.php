<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;
use App\Chart;

class YaxisMin0 extends Migration
{
    public function up()
    {
        DB::transaction(function() {
            $charts = Chart::all();
            foreach ($charts as $chart) {
                $config = json_decode($chart->config);

                if (empty($config->{'y-axis'}))
                    $config->{'y-axis'} = (object)[];

                if (empty($config->{'y-axis'}->{'axis-min'}))
                    $config->{'y-axis'}->{'axis-min'} = 0;

                $chart->config = json_encode($config);
                $chart->save();
            }
        });
    }
}
