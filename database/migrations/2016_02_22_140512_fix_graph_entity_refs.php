<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;
use App\Chart;
use App\DataValue;
use App\Entity;
class FixGraphEntityRefs extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {

        $charts = Chart::all();
        foreach ($charts as $chart) {
            $config = json_decode($chart->config);
            $countries = $config->{'selected-countries'};
            if (empty($countries)) continue;

            foreach ($countries as $country) {
                if ($country->id == "341") {
                    echo("Updating chart config for " . $chart->id . "\n");
                    $country->id = $newEntId;
                    $country->name = "World";
                }
            }

            $chart->config = json_encode($config);
            $chart->save();
        }

        DataValue::where('fk_ent_id', 341)->update(array('fk_ent_id' => 355));
        Entity::where('id', 341)->delete();
    }
}
