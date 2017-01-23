<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class AddSlopeChartType extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        DB::statement("ALTER TABLE charts MODIFY COLUMN type ENUM('LineChart', 'ScatterPlot', 'StackedArea', 'MultiBar', 'HorizontalMultiBar', 'DiscreteBar', 'SlopeChart')");
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
