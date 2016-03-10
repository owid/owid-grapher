<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;
use App\Chart;

class AddChartSlug extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('charts', function ($table) {
            $table->text('slug');            
        });

        $charts = Chart::all();
        foreach ($charts as $chart) {
            $s = strtolower($chart->name);
            $s = preg_replace('/\s*\*.+\*/', '', $s);
            $s = preg_replace('/[^\w- ]+/', '', $s);
            $s = preg_replace('/ +/', '-', trim($s));
            $chart->slug = $s;
            $chart->save();
        }

    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('charts', function ($table) {
            $table->dropColumn('slug');
        });
    }
}
