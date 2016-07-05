<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class DatasetCreatedAtAuto extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        DB::statement("ALTER TABLE datasets MODIFY COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    }
}