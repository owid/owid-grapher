<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class AddCoverageAndTimespanToVariables extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        DB::transaction(function() {
            DB::statement("ALTER TABLE variables ADD COLUMN coverage VARCHAR(255) NOT NULL DEFAULT ''");
            DB::statement("ALTER TABLE variables ADD COLUMN timespan VARCHAR(255) NOT NULL DEFAULT ''");
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
