<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class ChangeChartDimensionsUniqueIndex extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        DB::statement("ALTER TABLE `chart_dimensions` DROP FOREIGN KEY chart_dimensions_variableid_foreign");
        DB::statement("ALTER TABLE `chart_dimensions` DROP FOREIGN KEY chart_dimensions_chartid_foreign");
        DB::statement("ALTER TABLE `chart_dimensions` DROP INDEX unique_index");
        DB::statement("ALTER TABLE `chart_dimensions` ADD CONSTRAINT chart_dimensions_variableid_foreign FOREIGN KEY (variableId) REFERENCES variables(id)");
        DB::statement("ALTER TABLE `chart_dimensions` ADD CONSTRAINT chart_dimensions_chartid_foreign FOREIGN KEY (chartId) REFERENCES charts(id)");
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
