<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class RemoveChartTypesTable extends Migration
{
    public function up()
    {
        DB::statement("DROP TABLE IF EXISTS chart_type_dimensions");
        DB::statement("DROP TABLE IF EXISTS chart_types");
    }
}
