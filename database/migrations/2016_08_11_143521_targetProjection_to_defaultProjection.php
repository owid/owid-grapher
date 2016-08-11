<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;
use App\Chart;

class TargetProjectionToDefaultProjection extends Migration
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

                if (!isset($config->{'map-config'}->defaultProjection))
                    $config->{'map-config'}->defaultProjection = $config->{'map-config'}->projection;

               $chart->config = json_encode($config);
               $chart->save();
            }
        });
    }
}
