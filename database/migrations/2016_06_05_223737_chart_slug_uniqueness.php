<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class ChartSlugUniqueness extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table("charts", function($table) {
            DB::statement('ALTER TABLE charts MODIFY COLUMN slug VARCHAR(255)');
            $table->unique('slug');
        });        
    }
}
