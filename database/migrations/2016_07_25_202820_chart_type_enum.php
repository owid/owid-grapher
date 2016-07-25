<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class ChartTypeEnum extends Migration
{
    public function up() {
        DB::statement("ALTER TABLE charts ADD COLUMN type ENUM('LineChart', 'ScatterPlot', 'StackedArea', 'MultiBar', 'HorizontalMultiBar', 'DiscreteBar')");
    }

    public function down() {
        DB::statement("ALTER TABLE charts DROP COLUMN type");
    }
}
