<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class MoveTimesToDataValues extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        DB::transaction(function() {
            Schema::table('data_values', function($table) {
                if (!Schema::hasColumn('data_values', 'year'))
                    $table->integer('year');
            });

            DB::statement("UPDATE data_values JOIN times ON data_values.fk_time_id=times.id SET data_values.year = times.label;");                

            Schema::table('data_values', function($table) {
                $table->dropForeign('data_values_fk_time_id_foreign');
                $table->dropColumn('fk_time_id');
            });
            Schema::drop('entity_geometries');
            Schema::drop('entity_metas');
            Schema::drop('times');
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
