<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class ChartDimensionsConstraints extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        DB::statement("ALTER TABLE chart_dimensions ENGINE=InnoDB");
        DB::statement("DELETE FROM chart_dimensions WHERE variableId NOT IN (SELECT id FROM variables)");
        DB::statement("ALTER TABLE chart_dimensions ADD CONSTRAINT chart_dimensions_variableid_foreign FOREIGN KEY (variableId) REFERENCES variables(id)");
    }

    public function down() { }

}
