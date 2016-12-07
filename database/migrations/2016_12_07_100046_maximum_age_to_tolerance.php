<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class MaximumAgeToTolerance extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        DB::statement("UPDATE chart_dimensions SET chart_dimensions.tolerance=chart_dimensions.maximumAge WHERE chart_dimensions.mode='latest';");
        DB::statement("UPDATE chart_dimensions SET chart_dimensions.targetYear=NULL WHERE chart_dimensions.mode='latest';");
        DB::statement("ALTER TABLE chart_dimensions DROP COLUMN maximumAge;");
        DB::statement("ALTER TABLE chart_dimensions DROP COLUMN mode;");
    }
}
