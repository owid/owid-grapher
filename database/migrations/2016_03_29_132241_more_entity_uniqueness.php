<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;
use App\Chart;

class MoreEntityUniqueness extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        DB::transaction(function() {            
            DB::statement("update entities set validated=0;");
            DB::statement("update entities inner join entity_iso_names on entity_iso_names.name=entities.name set entities.code=entity_iso_names.code, validated=1;");

            DB::statement("create temporary table unique_entities (select e.id as orig_id, e.code as code, (select min(id) from entities where entities.code=e.code) as uniq_id from entities as e where e.code != '');");

            $pairs = DB::select("select orig_id, uniq_id from unique_entities where orig_id != uniq_id;");
            $oldToUnique = [];
            foreach ($pairs as $pair) {
                $oldToUnique[$pair->orig_id] = $pair->uniq_id;
            }

            $charts = Chart::all();
            foreach ($charts as $chart) {
                $config = json_decode($chart->config);
                $countries = $config->{'selected-countries'};
                if (empty($countries)) continue;

                foreach ($countries as $country) {
                    if (array_key_exists($country->id, $oldToUnique)) {
                        echo("Updating chart config for " . $chart->id . " changing entity id from " . $country->id . " to " . $oldToUnique[$country->id] . "\n");
                        $country->id = $oldToUnique[$country->id];
                    }
                }

                $chart->config = json_encode($config);
                $chart->save();
            }

            DB::statement("update data_values as dv inner join unique_entities as e on e.orig_id=dv.fk_ent_id set dv.fk_ent_id=e.uniq_id;");
            DB::statement("delete from entities where entities.id in (select orig_id from unique_entities where orig_id != uniq_id);");

            Schema::table("entities", function($table) {
                $table->string('code')->nullable()->change();
            });

            DB::statement("update entities set code=NULL where code='';");

            Schema::table("entities", function($table) {
                $table->unique('code');
            });

            DB::statement("update entities inner join entity_iso_names on entity_iso_names.code=entities.code and entities.code IS NOT NULL set entities.name=entity_iso_names.name, validated=1;");            

            Schema::drop("entity_iso_names");
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
