<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class MoveSourcesFromDatasetsToVariables extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        DB::transaction(function() {
            DB::statement("ALTER TABLE datasets DROP FOREIGN KEY datasets_fk_dsr_id_foreign");
            DB::statement("ALTER TABLE datasets DROP COLUMN fk_dsr_id");
        });
    }
}
