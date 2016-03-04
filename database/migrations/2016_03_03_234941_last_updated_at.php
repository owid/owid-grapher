<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;
use App\Chart;

class LastUpdatedAt extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {        
        Schema::table('charts', function ($table) {
            $table->dropForeign('charts_updated_by_foreign');
            $table->renameColumn('updated_by', 'last_edited_by');
            $table->foreign('last_edited_by')->references('name')->on('users');
            $table->timestamp('last_edited_at');
        });

        foreach (Chart::all() as $chart) {
            $chart->last_edited_at = $chart->updated_at;
            $chart->save();
        }
    }
}
