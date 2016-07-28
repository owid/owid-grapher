<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class RedoSources extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        DB::transaction(function() {
            DB::statement("RENAME TABLE datasources TO sources");
            DB::statement("ALTER TABLE sources ADD COLUMN datasetId INT");
        });      
    }
}
