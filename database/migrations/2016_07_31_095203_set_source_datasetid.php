<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;
use App\Source;

class SetSourceDatasetid extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        DB::transaction(function() {
            // Deduplicate identical sources
            foreach (Source::all() as $source) {
                $samename = Source::where('name', '=', $source->name)->get();
                foreach ($samename as $other) {
                    if ($other->description == $source->description) {
                        DB::statement("UPDATE variables SET sourceId=? WHERE sourceId=?", [$source->id, $other->id]);
                    }
                }
            }

            // Delete any sources which are no longer in use by variables
            DB::statement("DELETE FROM sources WHERE sources.id NOT IN (SELECT variables.sourceId FROM variables)");

            // Rename any remaining conflicts
            $rows = DB::select("SELECT name FROM sources GROUP BY name HAVING COUNT(name) > 1");
            foreach ($rows as $row) {
                $i = 0;
                foreach (Source::where('name', '=', $row->name)->get() as $source) {
                    $i += 1;
                    $source->name = $source->name . " (" . $i . ")";
                    $source->save();
                }
            }


            DB::statement("UPDATE sources JOIN variables ON variables.sourceId=sources.id SET sources.datasetId=variables.fk_dst_id;");   
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
