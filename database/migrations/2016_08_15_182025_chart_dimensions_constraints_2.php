<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class ChartDimensionsConstraints2 extends Migration
{
    public function up()
    {
        DB::statement("DELETE FROM chart_dimensions WHERE chartId NOT IN (SELECT id FROM charts)");
        DB::statement("ALTER TABLE chart_dimensions ADD CONSTRAINT chart_dimensions_chartid_foreign FOREIGN KEY (chartId) REFERENCES charts(id) ON DELETE CASCADE");
    }

    public function down() { }
}
