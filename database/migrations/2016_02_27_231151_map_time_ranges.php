<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;
use App\Chart;

class MapTimeRanges extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        DB::transaction(function() {
            $charts = Chart::all();
            foreach ($charts as $chart) {
                $config = json_decode($chart->config);
                if (!isset($config->{'map-config'})) continue;

                $interval = $config->{'map-config'}->timeInterval;
                if ($interval && $interval != 1) {
                    $timeRanges = [array("startYear" => "first", "endYear" => "last", "interval" => $interval)];
                    var_dump($timeRanges);
                    $config->{'map-config'}->timeRanges = $timeRanges;
                }

               $chart->config = json_encode($config);
               $chart->save();
            }
        });
    }
}
