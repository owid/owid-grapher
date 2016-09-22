<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;
use App\Chart;

class CustomNumericColors extends Migration
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
                if (isset($config->{'map-config'}))
                    $mapConfig = $config->{'map-config'};
                else {
                    continue;
                }

                if (isset($mapConfig->customColorScheme)) {
                    $mapConfig->customNumericColors = $mapConfig->customColorScheme;
                    unset($mapConfig->customColorScheme);                    
                }

                if ($mapConfig->colorSchemeName == 'custom') {
                    $mapConfig->customColorsActive = true;
                } else {
                    $mapConfig->baseColorScheme = $mapConfig->colorSchemeName;
                }

                $chart->config = json_encode($config);
                $chart->save();
            }
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        //
    }
}
